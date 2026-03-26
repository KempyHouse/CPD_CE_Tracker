#!/usr/bin/env node
/**
 * scripts/export-to-sql.js
 *
 * Exports the local SQLite database to a .sql file for import into Turso.
 *
 * Usage:
 *   node scripts/export-to-sql.js [output-path]
 *
 * Then import into Turso:
 *   turso db shell cpdtracker < cpd_tracker_export.sql
 */
'use strict';
const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const dbPath  = path.join(__dirname, '..', 'database', 'cpd_tracker.db');
const outPath = process.argv[2] || path.join(__dirname, '..', 'cpd_tracker_export.sql');

const db = new Database(dbPath, { readonly: true });

const lines = [];
lines.push('-- CPD/CE Tracker — SQLite export for Turso');
lines.push(`-- Generated: ${new Date().toISOString()}`);
lines.push('PRAGMA foreign_keys = OFF;');
lines.push('BEGIN TRANSACTION;');
lines.push('');

// Get all tables (exclude SQLite internals)
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
).all().map(r => r.name);

for (const table of tables) {
  // Schema
  const schema = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
  ).get(table);
  if (schema && schema.sql) {
    lines.push(`DROP TABLE IF EXISTS "${table}";`);
    lines.push(schema.sql + ';');
    lines.push('');
  }

  // Data
  const rows = db.prepare(`SELECT * FROM "${table}"`).all();
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  for (const row of rows) {
    const vals = cols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return v;
      return "'" + String(v).replace(/'/g, "''") + "'";
    });
    lines.push(`INSERT INTO "${table}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES (${vals.join(',')});`);
  }
  lines.push('');
}

// Recreate indexes
const indexes = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
).all();
for (const idx of indexes) {
  lines.push(idx.sql + ';');
}

lines.push('');
lines.push('COMMIT;');
lines.push('PRAGMA foreign_keys = ON;');

db.close();

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✅ Exported ${tables.length} tables to ${outPath}`);
console.log(`\nNext steps:`);
console.log(`  1. turso db create cpdtracker`);
console.log(`  2. turso db shell cpdtracker < "${outPath}"`);
console.log(`  3. turso db show cpdtracker --url        # → TURSO_URL`);
console.log(`  4. turso db tokens create cpdtracker     # → TURSO_AUTH_TOKEN`);
console.log(`  5. Add both to Netlify: Site Settings → Environment variables`);
