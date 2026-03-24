/**
 * Migration: add new columns to existing DB without full reseed.
 * Run with: node database/migrate.js
 */
'use strict';
const { getDb } = require('./init');
const db = getDb();
db.pragma('foreign_keys = OFF');

function safeAlter(sql) {
  try { db.exec(sql); console.log(' +', sql.trim()); }
  catch (e) { if (e.message.includes('duplicate column')) { console.log(' (already exists)'); } else throw e; }
}

console.log('[migrate] Applying schema additions...');

// 1. cpd_requirement_rules — add reflection_required_for_compliance
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN reflection_required_for_compliance INTEGER NOT NULL DEFAULT 0`);

// 2. cpd_activities — add stage
safeAlter(`ALTER TABLE cpd_activities ADD COLUMN stage TEXT NOT NULL DEFAULT 'recorded' CHECK (stage IN ('planned','done_unrecorded','recorded','reflected'))`);

// 3. cpd_activities — add structured reflection fields
safeAlter(`ALTER TABLE cpd_activities ADD COLUMN what_learned TEXT NULL`);
safeAlter(`ALTER TABLE cpd_activities ADD COLUMN impact_on_practice TEXT NULL`);
safeAlter(`ALTER TABLE cpd_activities ADD COLUMN next_steps TEXT NULL`);

// 4. Set reflection_required_for_compliance = 1 for RCVS and GDC rules
const updated = db.prepare(`
  UPDATE cpd_requirement_rules
  SET reflection_required_for_compliance = 1
  WHERE authority_id IN (
    SELECT authority_id FROM registration_authorities
    WHERE authority_key IN ('uk_rcvs','uk_gdc')
  )
`).run();
console.log(`[migrate] Set reflection_required_for_compliance=1 for ${updated.changes} RCVS/GDC rules.`);

// 5. cpd_requirement_rules — add max_units_per_day (e.g. California's 8-unit/day cap)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN max_units_per_day INTEGER NULL`);

// 6. cpd_requirement_rules — add first_renewal_ce_exempt (distinct from new_graduate_exemption)
//    true = entire first renewal cycle is CE-exempt regardless of graduation status (California)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN first_renewal_ce_exempt INTEGER NOT NULL DEFAULT 0`);

// 7. cpd_requirement_rules — add max_management_units (e.g. CA vet 24 hrs DVM / 15 hrs RVT business cap)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN max_management_units REAL NULL`);

// 8. cpd_requirement_rules — add presenter_credit_cap (e.g. CO dental: max 6 hrs presenter credit/cycle)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN presenter_credit_cap REAL NULL`);

// 9. cpd_requirement_rules — add bls_credit_cap (e.g. CO dental: max 2 hrs BLS credited toward total)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN bls_credit_cap REAL NULL`);

// 10. cpd_requirement_rules — add first_renewal_prorata_units
//     Hours required at first renewal when NOT exempt (distinct from full cycle, e.g. CO dental: 15 hrs)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN first_renewal_prorata_units REAL NULL`);

// 11. cpd_requirement_rules — add ce_window_months
//     For jurisdictions where CE window ≠ renewal frequency (e.g. CT: annual renewal, 24-month CE window)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN ce_window_months INTEGER NULL`);

// 12. cpd_requirement_rules — add self_study_permitted
//     Explicit self-study exclusion (e.g. CT RDH: self-study not permitted)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN self_study_permitted INTEGER NOT NULL DEFAULT 1`);

// 13. cpd_requirement_rules — add max_self_study_no_test
//     DE dental Type A self-study cap (non-interactive, no exam; dentist=10, RDH=5)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN max_self_study_no_test REAL NULL`);

// 14. cpd_requirement_rules — add max_self_study_with_test
//     DE dental combined self-study cap A+B (dentist=30, RDH=10)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN max_self_study_with_test REAL NULL`);

// 15. cpd_requirement_rules — add cpr_required_non_cpe
//     CPR is a renewal condition that earns ZERO CE/CPE credit (e.g. DE dental)
safeAlter(`ALTER TABLE cpd_requirement_rules ADD COLUMN cpr_required_non_cpe INTEGER NOT NULL DEFAULT 0`);

// 16. Create team_members table (idempotent — safe to run multiple times)
db.exec(`
  CREATE TABLE IF NOT EXISTS team_members (
    member_id       TEXT PRIMARY KEY,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    role_key        TEXT NOT NULL,
    authority_key   TEXT NOT NULL,
    registration_date TEXT NULL,
    ce_done         REAL NOT NULL DEFAULT 0,
    ce_required     REAL NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'on-track'
                    CHECK(status IN ('on-track','at-risk','overdue','complete','exempt','inactive')),
    renewal_deadline TEXT NULL,
    avatar_colour   TEXT NOT NULL DEFAULT '#5c3fa3',
    notes           TEXT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
console.log('[migrate] team_members table ensured.');

db.close();
console.log('[migrate] Done — no data was lost.');
