'use strict';
/**
 * Sync CE rules from local SQLite to Turso cloud.
 * Uses INSERT OR IGNORE so existing Turso rows are preserved.
 */
const { createClient } = require('@libsql/client');
const betterSqlite = require('better-sqlite3');
const path = require('path');

const localDb = betterSqlite(path.join(__dirname, '..', 'database', 'cpd_tracker.db'));
const turso = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

async function main() {
  // Get all rules from local SQLite
  const rules = localDb.prepare('SELECT * FROM cpd_requirement_rules ORDER BY created_at').all();
  console.log(`Local DB has ${rules.length} CE rules. Syncing to Turso...`);

  const cols = Object.keys(rules[0]);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO cpd_requirement_rules (${cols.join(', ')}) VALUES (${placeholders})`;

  let inserted = 0;
  let skipped = 0;
  const fkFailed = [];

  // Insert one by one so FK failures don't abort the whole batch
  for (const rule of rules) {
    try {
      const r = await turso.execute({
        sql,
        args: cols.map(c => rule[c] ?? null)
      });
      if (r.rowsAffected > 0) {
        inserted++;
        process.stdout.write(`  ✓ ${rule.rule_id}\n`);
      } else {
        skipped++;
      }
    } catch (e) {
      if (e.message.includes('FOREIGN KEY') || e.message.includes('UNIQUE')) {
        fkFailed.push({ rule_id: rule.rule_id, err: e.message.slice(0, 80) });
      } else {
        console.error('  FAIL', rule.rule_id, e.message.slice(0, 80));
      }
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} already existed`);
  localDb.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
