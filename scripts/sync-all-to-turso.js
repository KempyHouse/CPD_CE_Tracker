'use strict';
/**
 * Full sync: push all local authorities → roles → rules to Turso.
 * Uses INSERT OR IGNORE on the primary key so existing Turso rows are untouched.
 * Run order matters: authorities first, then roles, then rules.
 */
const { createClient } = require('@libsql/client');
const betterSqlite = require('better-sqlite3');
const path = require('path');

const local = betterSqlite(path.join(__dirname, '..', 'database', 'cpd_tracker.db'), { readonly: true });
const turso = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

async function syncTable(tableName, pkCol) {
  // Get local rows
  const rows = local.prepare(`SELECT * FROM ${tableName}`).all();
  if (!rows.length) { console.log(`  ${tableName}: no local rows`); return { ins: 0, skip: 0 }; }

  // Get existing PKs from Turso
  const existing = await turso.execute(`SELECT ${pkCol} FROM ${tableName}`);
  const existingSet = new Set(existing.rows.map(r => r[pkCol]));

  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;

  let ins = 0, skip = 0, fail = 0;
  const toInsert = rows.filter(r => !existingSet.has(r[pkCol]));
  console.log(`  ${tableName}: ${rows.length} local, ${existingSet.size} in Turso, ${toInsert.length} to insert`);

  // Batch insert in groups of 10
  const BATCH = 10;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const stmts = batch.map(row => ({ sql, args: cols.map(c => row[c] ?? null) }));
    try {
      const results = await turso.batch(stmts, 'write');
      results.forEach(r => { if (r.rowsAffected > 0) ins++; else skip++; });
    } catch (e) {
      console.error(`    BATCH FAIL [${i}–${i+batch.length}]:`, e.message.slice(0, 100));
      // Fall back to one-by-one
      for (const row of batch) {
        try {
          const r = await turso.execute({ sql, args: cols.map(c => row[c] ?? null) });
          if (r.rowsAffected > 0) ins++; else skip++;
        } catch (e2) {
          console.error(`    ROW FAIL ${row[pkCol]}:`, e2.message.slice(0, 80));
          fail++;
        }
      }
    }
  }
  return { ins, skip, fail };
}

async function syncRulesKeybased() {
  // For rules we must use key-based mapping because UUIDs may differ
  const localRules = local.prepare(`
    SELECT r.*, ro.role_key, a.authority_key
    FROM cpd_requirement_rules r
    JOIN professional_roles ro ON r.role_id = ro.role_id
    JOIN registration_authorities a ON r.authority_id = a.authority_id
    ORDER BY a.authority_key, ro.role_key
  `).all();

  // Build Turso lookup maps
  const authRes = await turso.execute('SELECT authority_id, authority_key FROM registration_authorities');
  const authMap = {};
  authRes.rows.forEach(r => { authMap[r.authority_key] = r.authority_id; });

  const roleRes = await turso.execute(`
    SELECT ro.role_id, ro.role_key, a.authority_key
    FROM professional_roles ro JOIN registration_authorities a ON ro.authority_id = a.authority_id
  `);
  const roleMap = {};
  roleRes.rows.forEach(r => { roleMap[`${r.authority_key}::${r.role_key}`] = r.role_id; });

  const existingRules = await turso.execute('SELECT DISTINCT role_id FROM cpd_requirement_rules');
  const hasRule = new Set(existingRules.rows.map(r => r.role_id));

  const { randomUUID } = require('crypto');
  const skipCols = new Set(['rule_id', 'authority_id', 'role_id', 'role_key', 'authority_key']);
  const dataCols = Object.keys(localRules[0]).filter(c => !skipCols.has(c));

  let ins = 0, skip = 0, missing = 0;
  for (const rule of localRules) {
    const mapKey = `${rule.authority_key}::${rule.role_key}`;
    const tursoRoleId = roleMap[mapKey];
    const tursoAuthId = authMap[rule.authority_key];
    if (!tursoRoleId || !tursoAuthId) { missing++; continue; }
    if (hasRule.has(tursoRoleId)) { skip++; continue; }

    const newId = randomUUID();
    const cols = ['rule_id', 'authority_id', 'role_id', ...dataCols];
    const vals = [newId, tursoAuthId, tursoRoleId, ...dataCols.map(c => rule[c] ?? null)];
    try {
      await turso.execute({ sql: `INSERT INTO cpd_requirement_rules (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, args: vals });
      hasRule.add(tursoRoleId);
      ins++;
      process.stdout.write(`    ✓ ${mapKey}\n`);
    } catch (e) {
      console.error(`    FAIL ${mapKey}:`, e.message.slice(0, 80));
    }
  }
  return { ins, skip, missing };
}

async function main() {
  console.log('\n=== Full Turso Sync ===\n');

  console.log('1. Authorities');
  const a = await syncTable('registration_authorities', 'authority_id');
  console.log(`   → inserted ${a.ins}, skipped ${a.skip}${a.fail ? ', failed '+a.fail : ''}`);

  console.log('\n2. Professional Roles');
  const r = await syncTable('professional_roles', 'role_id');
  console.log(`   → inserted ${r.ins}, skipped ${r.skip}${r.fail ? ', failed '+r.fail : ''}`);

  console.log('\n3. CE Rules (key-based)');
  const ru = await syncRulesKeybased();
  console.log(`   → inserted ${ru.ins}, skipped(had rule) ${ru.skip}, not-in-turso ${ru.missing}`);

  console.log('\n=== Done ===');
  local.close();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
