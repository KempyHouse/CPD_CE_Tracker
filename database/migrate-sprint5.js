'use strict';
/**
 * Sprint 5 migration — run ONCE after upgrading to Sprint 5 code.
 *   node database/migrate-sprint5.js
 *
 * Changes:
 *  1. Adds renewal_year_parity, birth_month_offset, renewal_day columns
 *  2. Sets renewal_year_parity='odd' for IL, IN, SD (previously broken)
 *  3. Migrates renewal_even_year_only=1 rows → renewal_year_parity='even'
 *  4. Sets birth_month_offset=1 for TX (expires end of month AFTER birth month)
 *  5. Sets renewal_day=15 for IN (Oct 15 odd years)
 */
const { getDb, applyMigrations } = require('./init');
const db = getDb();

db.pragma('foreign_keys = ON');

// ── 1. Run migrations (idempotent — adds new columns if missing) ──────────────
applyMigrations(db);
console.log('[migrate-sprint5] Migrations applied.');

// ── Verify all 3 new columns are present ─────────────────────────────────────
const cols = db.prepare(`PRAGMA table_info(cpd_requirement_rules)`).all().map(c => c.name);
['renewal_year_parity', 'birth_month_offset', 'renewal_day'].forEach(col => {
  if (!cols.includes(col)) {
    console.error(`[migrate-sprint5] ERROR: column ${col} still missing — check applyMigrations()`);
    process.exit(1);
  }
});
console.log('[migrate-sprint5] Column check OK — all 3 new columns present.');

// ── 2. Migrate even-year booleans → parity field ─────────────────────────────
const migrateEven = db.prepare(`
  UPDATE cpd_requirement_rules
  SET renewal_year_parity = 'even'
  WHERE renewal_even_year_only = 1
    AND renewal_year_parity = 'any'
`).run();
console.log(`[migrate-sprint5] Set renewal_year_parity='even' on ${migrateEven.changes} rules.`);

// ── 3. Set odd-year parity for IL, IN, SD ────────────────────────────────────
const migrateOdd = db.prepare(`
  UPDATE cpd_requirement_rules
  SET renewal_year_parity = 'odd'
  WHERE authority_id IN (
    SELECT authority_id FROM registration_authorities
    WHERE authority_key IN ('us_il_idfpr','us_in_pla','us_sd_sdbmv')
  )
  AND renewal_year_parity = 'any'
`).run();
console.log(`[migrate-sprint5] Set renewal_year_parity='odd' on ${migrateOdd.changes} rules (IL/IN/SD).`);

// ── 4. TX birth month offset — expires end of month AFTER birth month ─────────
const migrateTX = db.prepare(`
  UPDATE cpd_requirement_rules
  SET birth_month_offset = 1
  WHERE authority_id IN (
    SELECT authority_id FROM registration_authorities
    WHERE authority_key = 'us_tx_bvme'
  )
  AND birth_month_offset = 0
`).run();
console.log(`[migrate-sprint5] Set birth_month_offset=1 on ${migrateTX.changes} TX BVME rules.`);

// ── 5. Indiana renewal_day = 15 (Oct 15 odd years) ───────────────────────────
const migrateIN = db.prepare(`
  UPDATE cpd_requirement_rules
  SET renewal_day = 15
  WHERE authority_id IN (
    SELECT authority_id FROM registration_authorities
    WHERE authority_key = 'us_in_pla'
  )
  AND renewal_day IS NULL
`).run();
console.log(`[migrate-sprint5] Set renewal_day=15 on ${migrateIN.changes} IN PLA rules.`);

db.close();
console.log('[migrate-sprint5] Done.');
