#!/usr/bin/env node
/**
 * scripts/import-to-turso.js — v3 (reads SQLite directly, imports in dependency order)
 * Reads the local SQLite DB via better-sqlite3 and sends each table to Turso
 * in a safe dependency order so FK constraints are never violated.
 *
 * Usage: TURSO_URL=... TURSO_AUTH_TOKEN=... node scripts/import-to-turso.js
 */
'use strict';
const { createClient } = require('@libsql/client');
const Database = require('better-sqlite3');
const path = require('path');

const TURSO_URL        = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Set TURSO_URL and TURSO_AUTH_TOKEN env vars first.');
  process.exit(1);
}

// Table dependency order — parents before children
const TABLE_ORDER = [
  'countries',
  'registration_authorities',
  'professional_roles',
  'practitioners',
  'cpd_requirement_rules',
  'mandatory_topic_rules',
  'registrations',
  'cpd_cycles',
  'cpd_activities',
  'pdp_goals',
  'team_members',
];

const dbPath = path.join(__dirname, '..', 'database', 'cpd_tracker.db');
const local  = new Database(dbPath, { readonly: true });
const turso  = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN });

function escapeVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function importTable(table) {
  // Get schema from SQLite
  const schema = local.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table);
  if (!schema || !schema.sql) { console.log(`  ⚠️  ${table}: no schema, skipping`); return; }

  const rows = local.prepare(`SELECT * FROM "${table}"`).all();
  if (!rows.length) { console.log(`  ✅ ${table}: empty, skipped`); return; }

  const cols = Object.keys(rows[0]);

  // Drop and recreate
  try { await turso.execute(`DROP TABLE IF EXISTS "${table}"`); } catch { /* ignore */ }
  await turso.execute(schema.sql);

  // Insert in batches of 30
  const BATCH = 30;
  let ok = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const stmts = chunk.map(row => ({
      sql: `INSERT OR REPLACE INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(c => escapeVal(row[c])).join(',')})`,
    }));
    try {
      await turso.batch(stmts, 'write');
      ok += chunk.length;
    } catch {
      for (const s of stmts) {
        try { await turso.execute(s.sql); ok++; }
        catch (e2) { console.error(`\n    ❌ ${s.sql.substring(0, 60)} → ${e2.message}`); }
      }
    }
  }
  console.log(`  ✅ ${table}: ${ok}/${rows.length} rows`);
}

async function main() {
  console.log('\n🚀 Importing into Turso (dependency order)...\n');

  // Disable FK checks first
  try { await turso.execute('PRAGMA foreign_keys = OFF'); } catch { /* Turso may ignore this */ }

  for (const table of TABLE_ORDER) {
    await importTable(table);
  }

  // Re-enable FK checks
  try { await turso.execute('PRAGMA foreign_keys = ON'); } catch { /* ignore */ }

  // Verify
  console.log('\n📊 Final verification:');
  for (const table of TABLE_ORDER) {
    try {
      const r = await turso.execute(`SELECT COUNT(*) as n FROM "${table}"`);
      const n = r.rows[0][0];
      const icon = n > 0 ? '✅' : '⚠️ ';
      console.log(`  ${icon} ${table}: ${n} rows`);
    } catch (e) { console.log(`  ❌ ${table}: ${e.message}`); }
  }

  local.close();
  console.log('\n🎉 Done!');
}

main().catch(e => { console.error('Fatal:', e.message); local.close(); process.exit(1); });
