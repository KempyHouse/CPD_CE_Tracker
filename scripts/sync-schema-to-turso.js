'use strict';
/**
 * Compare local SQLite and Turso column schemas for cpd_requirement_rules,
 * then ALTER TABLE on Turso to add any missing columns.
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
  // Local columns
  const localCols = localDb.prepare('PRAGMA table_info(cpd_requirement_rules)').all()
    .map(c => ({ name: c.name, type: c.type || 'TEXT' }));
  console.log('Local columns:', localCols.length);

  // Turso columns
  const tursoRes = await turso.execute('PRAGMA table_info(cpd_requirement_rules)');
  const tursoCols = new Set(tursoRes.rows.map(r => r.name));
  console.log('Turso columns:', tursoCols.size);

  // Find missing
  const missing = localCols.filter(c => !tursoCols.has(c.name));
  console.log('\nMissing from Turso:', missing.map(c => c.name + ' ' + c.type).join(', ') || 'none');

  if (missing.length === 0) {
    console.log('No schema differences!');
    localDb.close();
    return;
  }

  // Add missing columns to Turso
  console.log('\nAdding missing columns to Turso...');
  for (const col of missing) {
    const ddl = `ALTER TABLE cpd_requirement_rules ADD COLUMN ${col.name} ${col.type || 'TEXT'}`;
    try {
      await turso.execute(ddl);
      console.log(' ✓', col.name);
    } catch (e) {
      console.log(' SKIP', col.name, '—', e.message.slice(0, 60));
    }
  }

  console.log('\nSchema sync done. Now run sync-rules-to-turso.js');
  localDb.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
