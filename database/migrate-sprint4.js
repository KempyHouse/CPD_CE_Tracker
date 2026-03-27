'use strict';
/**
 * Sprint 4 migration — run ONCE after upgrading to Sprint 4 code.
 *   node database/migrate-sprint4.js
 *
 * Changes:
 *  1. Adds `topic_cycle_months` column to mandatory_topic_rules (BUG-059)
 *  2. Updates TX BVME DVM Opioid Training topic to topic_cycle_months = 24
 */
const { getDb } = require('./init');
const db = getDb();

db.pragma('foreign_keys = ON');

// ── 1. Add column (no-op if already exists) ─────────────────────────────────
try {
  db.exec(`ALTER TABLE mandatory_topic_rules ADD COLUMN topic_cycle_months INTEGER NULL`);
  console.log('[migrate-sprint4] Added column: mandatory_topic_rules.topic_cycle_months');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('[migrate-sprint4] Column topic_cycle_months already exists — skipping ALTER.');
  } else {
    throw e;
  }
}

// ── 2. Fix TX BVME DVM Opioid Training: biennial topic inside annual rule ────
//    The TX BVME rule cycle is annual (12 months), but opioid training is
//    required once per biennial renewal period (24 months). BUG-059.
const opioidResult = db.prepare(`
  UPDATE mandatory_topic_rules
  SET topic_cycle_months = 24
  WHERE topic_name LIKE '%Opioid%'
    AND rule_id IN (
      SELECT r.rule_id FROM cpd_requirement_rules r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      WHERE a.authority_key = 'us_tx_bvme'
    )
    AND (topic_cycle_months IS NULL OR topic_cycle_months != 24)
`).run();

console.log(`[migrate-sprint4] Updated TX BVME Opioid topic: ${opioidResult.changes} row(s) affected`);

db.close();
console.log('[migrate-sprint4] Done.');
