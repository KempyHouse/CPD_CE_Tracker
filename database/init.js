'use strict';
const Database = require('better-sqlite3');
const { randomUUID: uuidv4 } = require('crypto');
const path = require('path');
const seed = require('./seed-data');

const DB_PATH = path.join(__dirname, 'cpd_tracker.db');

function getDb() {
  return new Database(DB_PATH);
}

function applyMigrations(db) {
  const cols = tbl => db.prepare(`PRAGMA table_info(${tbl})`).all().map(c => c.name);

  const ruleCols = cols('cpd_requirement_rules');
  if (!ruleCols.includes('regime_type'))
    db.exec(`ALTER TABLE cpd_requirement_rules ADD COLUMN regime_type TEXT NOT NULL DEFAULT 'US_HOURS_BASED'`);
  if (!ruleCols.includes('approval_standard'))
    db.exec(`ALTER TABLE cpd_requirement_rules ADD COLUMN approval_standard TEXT NOT NULL DEFAULT 'RACE_OR_BOARD'`);
  if (!ruleCols.includes('max_online_hours'))
    db.exec(`ALTER TABLE cpd_requirement_rules ADD COLUMN max_online_hours REAL NULL`);
  if (!ruleCols.includes('max_online_percent'))
    db.exec(`ALTER TABLE cpd_requirement_rules ADD COLUMN max_online_percent REAL NULL`);
  if (!ruleCols.includes('renewal_even_year_only'))
    db.exec(`ALTER TABLE cpd_requirement_rules ADD COLUMN renewal_even_year_only INTEGER NOT NULL DEFAULT 0`);
  if (!ruleCols.includes('birth_month_renewal'))
    db.exec(`ALTER TABLE cpd_requirement_rules ADD COLUMN birth_month_renewal INTEGER NOT NULL DEFAULT 0`);

  const topicCols = cols('mandatory_topic_rules');
  if (!topicCols.includes('trigger_type'))
    db.exec(`ALTER TABLE mandatory_topic_rules ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'ALL_ACTIVE'`);
  if (!topicCols.includes('trigger_attribute_key'))
    db.exec(`ALTER TABLE mandatory_topic_rules ADD COLUMN trigger_attribute_key TEXT NULL`);
  if (!topicCols.includes('trigger_attribute_value'))
    db.exec(`ALTER TABLE mandatory_topic_rules ADD COLUMN trigger_attribute_value TEXT NULL`);
  if (!topicCols.includes('effective_from_year'))
    db.exec(`ALTER TABLE mandatory_topic_rules ADD COLUMN effective_from_year INTEGER NULL`);

  const actCols = cols('cpd_activities');
  if (!actCols.includes('is_online'))
    db.exec(`ALTER TABLE cpd_activities ADD COLUMN is_online INTEGER NOT NULL DEFAULT 0`);
  if (!actCols.includes('is_medical_scientific'))
    db.exec(`ALTER TABLE cpd_activities ADD COLUMN is_medical_scientific INTEGER NOT NULL DEFAULT 1`);

  const cycleCols = cols('cpd_cycles');
  if (!cycleCols.includes('online_completed'))
    db.exec(`ALTER TABLE cpd_cycles ADD COLUMN online_completed REAL NOT NULL DEFAULT 0`);
  if (!cycleCols.includes('max_online_allowed'))
    db.exec(`ALTER TABLE cpd_cycles ADD COLUMN max_online_allowed REAL NULL`);
  if (!cycleCols.includes('non_medical_completed'))
    db.exec(`ALTER TABLE cpd_cycles ADD COLUMN non_medical_completed REAL NOT NULL DEFAULT 0`);
  if (!cycleCols.includes('max_non_medical_allowed'))
    db.exec(`ALTER TABLE cpd_cycles ADD COLUMN max_non_medical_allowed REAL NULL`);
}

function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Apply schema migrations (safe for existing DBs) ──────────────────────────
  applyMigrations(db);

  // ── Create tables ──────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      country_code TEXT PRIMARY KEY,
      country_name TEXT NOT NULL,
      default_authority_id TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS registration_authorities (
      authority_id TEXT PRIMARY KEY,
      authority_key TEXT NOT NULL UNIQUE,
      authority_name TEXT NOT NULL,
      authority_abbreviation TEXT NOT NULL,
      country TEXT NOT NULL REFERENCES countries(country_code),
      sector TEXT NOT NULL CHECK(sector IN ('veterinary','dental','both')),
      website_url TEXT NULL,
      cpd_platform_url TEXT NULL,
      uses_hours INTEGER NOT NULL DEFAULT 1,
      uses_points INTEGER NOT NULL DEFAULT 0,
      uses_ceus INTEGER NOT NULL DEFAULT 0,
      uses_credits INTEGER NOT NULL DEFAULT 0,
      unit_label TEXT NOT NULL DEFAULT 'hours',
      units_per_hour REAL NOT NULL DEFAULT 1.0,
      split_label TEXT NULL,
      split_bar_concept TEXT NOT NULL DEFAULT 'structured',
      ui_labels TEXT NULL,
      mandatory_topics_enabled INTEGER NOT NULL DEFAULT 0,
      cpd_term TEXT NOT NULL DEFAULT 'CPD',
      cpd_term_full TEXT NOT NULL DEFAULT 'Continuing Professional Development',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS professional_roles (
      role_id TEXT PRIMARY KEY,
      role_key TEXT NOT NULL UNIQUE,
      authority_id TEXT NOT NULL REFERENCES registration_authorities(authority_id),
      role_name TEXT NOT NULL,
      role_abbreviation TEXT NULL,
      sector TEXT NOT NULL CHECK(sector IN ('veterinary','dental','both')),
      tier TEXT NOT NULL DEFAULT 'generalist',
      is_statutorily_registered INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cpd_requirement_rules (
      rule_id TEXT PRIMARY KEY,
      authority_id TEXT NOT NULL REFERENCES registration_authorities(authority_id),
      role_id TEXT NOT NULL REFERENCES professional_roles(role_id),
      effective_from TEXT NOT NULL,
      effective_to TEXT NULL,
      cycle_type TEXT NOT NULL,
      cycle_length_months INTEGER NOT NULL,
      cycle_start_month INTEGER NULL,
      cycle_start_day INTEGER NULL,
      cycle_start_anchor TEXT NOT NULL DEFAULT 'calendar',
      total_units_required REAL NOT NULL,
      annual_minimum_units REAL NULL,
      spread_rule_units REAL NULL,
      spread_rule_months INTEGER NULL,
      min_structured_units REAL NULL,
      min_verifiable_units REAL NULL,
      max_unstructured_units REAL NULL,
      max_non_clinical_units REAL NULL,
      max_non_clinical_percent REAL NULL,
      carry_over_allowed INTEGER NOT NULL DEFAULT 0,
      carry_over_max_units REAL NULL,
      pause_allowed INTEGER NOT NULL DEFAULT 0,
      pause_max_months INTEGER NULL,
      pause_reduced_units REAL NULL,
      new_graduate_exemption INTEGER NOT NULL DEFAULT 0,
      new_graduate_months INTEGER NULL,
      new_graduate_reduced_units REAL NULL,
      mandatory_topics_enabled INTEGER NOT NULL DEFAULT 0,
      reflection_required_for_compliance INTEGER NOT NULL DEFAULT 0,
      pro_rata_for_part_year INTEGER NOT NULL DEFAULT 0,
      non_practising_exempt INTEGER NOT NULL DEFAULT 0,
      postgrad_study_exempts INTEGER NOT NULL DEFAULT 0,
      deferral_allowed INTEGER NOT NULL DEFAULT 0,
      max_units_per_day INTEGER NULL,
      first_renewal_ce_exempt INTEGER NOT NULL DEFAULT 0,
      max_management_units REAL NULL,
      presenter_credit_cap REAL NULL,
      bls_credit_cap REAL NULL,
      first_renewal_prorata_units REAL NULL,
      ce_window_months INTEGER NULL,
      self_study_permitted INTEGER NOT NULL DEFAULT 1,
      max_self_study_no_test REAL NULL,
      max_self_study_with_test REAL NULL,
      cpr_required_non_cpe INTEGER NOT NULL DEFAULT 0,
      regime_type TEXT NOT NULL DEFAULT 'US_HOURS_BASED',
      approval_standard TEXT NOT NULL DEFAULT 'RACE_OR_BOARD',
      max_online_hours REAL NULL,
      max_online_percent REAL NULL,
      renewal_even_year_only INTEGER NOT NULL DEFAULT 0,
      birth_month_renewal INTEGER NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mandatory_topic_rules (
      topic_rule_id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL REFERENCES cpd_requirement_rules(rule_id) ON DELETE CASCADE,
      topic_name TEXT NOT NULL,
      topic_category TEXT NOT NULL DEFAULT 'mandatory',
      min_units_per_cycle REAL NULL,
      min_units_per_year REAL NULL,
      max_units_per_cycle REAL NULL,
      max_units_per_year REAL NULL,
      max_percent_of_total REAL NULL,
      must_be_live INTEGER NOT NULL DEFAULT 0,
      must_be_in_person INTEGER NOT NULL DEFAULT 0,
      applies_if_holds_dea INTEGER NOT NULL DEFAULT 0,
      applies_if_prescriber INTEGER NOT NULL DEFAULT 0,
      applies_if_does_radiography INTEGER NOT NULL DEFAULT 0,
      trigger_type TEXT NOT NULL DEFAULT 'ALL_ACTIVE',
      trigger_attribute_key TEXT NULL,
      trigger_attribute_value TEXT NULL,
      effective_from_year INTEGER NULL,
      notes TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS practitioners (
      practitioner_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      date_of_birth TEXT NULL,
      country_of_practice TEXT NULL REFERENCES countries(country_code),
      profile_photo_url TEXT NULL,
      demo_settings TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registrations (
      registration_id TEXT PRIMARY KEY,
      practitioner_id TEXT NOT NULL REFERENCES practitioners(practitioner_id),
      authority_id TEXT NOT NULL REFERENCES registration_authorities(authority_id),
      role_id TEXT NOT NULL REFERENCES professional_roles(role_id),
      registration_number TEXT NULL,
      registration_date TEXT NULL,
      registration_status TEXT NOT NULL DEFAULT 'active',
      is_new_graduate INTEGER NOT NULL DEFAULT 0,
      new_graduate_start_date TEXT NULL,
      is_specialist INTEGER NOT NULL DEFAULT 0,
      specialty_area TEXT NULL,
      is_advanced_practitioner INTEGER NOT NULL DEFAULT 0,
      advanced_practitioner_designation TEXT NULL,
      is_dual_registered INTEGER NOT NULL DEFAULT 0,
      holds_dea_registration INTEGER NOT NULL DEFAULT 0,
      holds_prescribing_rights INTEGER NOT NULL DEFAULT 0,
      practice_type TEXT NOT NULL DEFAULT 'clinical',
      fte_percentage INTEGER NULL,
      active_from TEXT NOT NULL,
      active_to TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cpd_cycles (
      cycle_id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL REFERENCES registrations(registration_id),
      rule_id TEXT NOT NULL REFERENCES cpd_requirement_rules(rule_id),
      cycle_number INTEGER NOT NULL DEFAULT 1,
      cycle_start_date TEXT NOT NULL,
      cycle_end_date TEXT NOT NULL,
      units_required REAL NOT NULL,
      min_structured_required REAL NULL,
      min_verifiable_required REAL NULL,
      max_non_clinical_allowed REAL NULL,
      units_completed REAL NOT NULL DEFAULT 0,
      structured_completed REAL NOT NULL DEFAULT 0,
      verifiable_completed REAL NOT NULL DEFAULT 0,
      non_clinical_completed REAL NOT NULL DEFAULT 0,
      online_completed REAL NOT NULL DEFAULT 0,
      max_online_allowed REAL NULL,
      non_medical_completed REAL NOT NULL DEFAULT 0,
      max_non_medical_allowed REAL NULL,
      mandatory_topics_met INTEGER NOT NULL DEFAULT 0,
      spread_rule_met INTEGER NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      is_paused INTEGER NOT NULL DEFAULT 0,
      pause_start_date TEXT NULL,
      pause_end_date TEXT NULL,
      audit_selected INTEGER NOT NULL DEFAULT 0,
      audit_submitted_date TEXT NULL,
      notes TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cpd_activities (
      activity_id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL REFERENCES registrations(registration_id),
      cycle_id TEXT NOT NULL REFERENCES cpd_cycles(cycle_id),
      activity_title TEXT NOT NULL,
      activity_description TEXT NULL,
      activity_date TEXT NOT NULL,
      provider_name TEXT NULL,
      provider_accreditation TEXT NULL,
      is_accredited INTEGER NOT NULL DEFAULT 0,
      accreditation_number TEXT NULL,
      activity_type TEXT NOT NULL,
      delivery_format TEXT NOT NULL,
      topic_category TEXT NULL,
      is_clinical INTEGER NOT NULL DEFAULT 1,
      is_verifiable INTEGER NOT NULL DEFAULT 0,
      is_structured INTEGER NOT NULL DEFAULT 0,
      units_claimed REAL NOT NULL,
      units_awarded REAL NULL,
      units_multiplier REAL NOT NULL DEFAULT 1.0,
      certificates_url TEXT NULL,
      evidence_document_url TEXT NULL,
      reflection_text TEXT NULL,
      reflection_date TEXT NULL,
      what_learned TEXT NULL,
      impact_on_practice TEXT NULL,
      next_steps TEXT NULL,
      peer_discussed INTEGER NOT NULL DEFAULT 0,
      peer_name TEXT NULL,
      pdp_goal_linked TEXT NULL,
      is_presenter INTEGER NOT NULL DEFAULT 0,
      is_author INTEGER NOT NULL DEFAULT 0,
      publication_doi TEXT NULL,
      postgrad_year INTEGER NULL,
      is_online INTEGER NOT NULL DEFAULT 0,
      is_medical_scientific INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      stage TEXT NOT NULL DEFAULT 'recorded'
        CHECK (stage IN ('planned','done_unrecorded','recorded','reflected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pdp_goals (
      goal_id TEXT PRIMARY KEY,
      registration_id TEXT NOT NULL REFERENCES registrations(registration_id),
      cycle_id TEXT NOT NULL REFERENCES cpd_cycles(cycle_id),
      goal_title TEXT NOT NULL,
      goal_description TEXT NULL,
      field_of_practice TEXT NULL,
      target_date TEXT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      carried_forward_from_cycle_id TEXT NULL REFERENCES cpd_cycles(cycle_id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Check if already seeded ────────────────────────────────────────────────
  const count = db.prepare('SELECT COUNT(*) as n FROM registration_authorities').get();
  if (count.n > 0) { db.close(); return; }

  console.log('[DB] Seeding database with CPD authority data...');

  // ── Seed countries ─────────────────────────────────────────────────────────
  const insertCountry = db.prepare('INSERT OR IGNORE INTO countries (country_code, country_name) VALUES (?,?)');
  for (const c of seed.COUNTRIES) insertCountry.run(c.country_code, c.country_name);

  // ── Seed authorities ───────────────────────────────────────────────────────
  const authIds = {}; // key → id
  const insertAuth = db.prepare(`
    INSERT INTO registration_authorities
    (authority_id, authority_key, authority_name, authority_abbreviation, country, sector,
     website_url, cpd_platform_url, uses_hours, uses_points, uses_ceus, uses_credits,
     unit_label, units_per_hour, split_label, split_bar_concept, ui_labels, mandatory_topics_enabled, cpd_term, cpd_term_full)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const a of seed.AUTHORITIES) {
    const id = uuidv4(); authIds[a.key] = id;
    insertAuth.run(
      id, a.key, a.name, a.abbr, a.country, a.sector,
      a.website_url || null, a.cpd_platform_url || null,
      a.uses_hours ? 1 : 0, a.uses_points ? 1 : 0,
      a.uses_ceus ? 1 : 0, a.uses_credits ? 1 : 0,
      a.unit_label, a.units_per_hour,
      a.split_label || null, a.split_bar_concept || 'structured',
      a.ui_labels ? JSON.stringify(a.ui_labels) : null,
      a.mandatory_topics_enabled ? 1 : 0,
      a.cpd_term, a.cpd_term_full
    );
  }

  // ── Seed roles ─────────────────────────────────────────────────────────────
  const roleIds = {}; // key → id
  const insertRole = db.prepare(`
    INSERT INTO professional_roles
    (role_id, role_key, authority_id, role_name, role_abbreviation, sector, tier, is_statutorily_registered)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  for (const r of seed.ROLES) {
    const id = uuidv4(); roleIds[r.key] = id;
    insertRole.run(id, r.key, authIds[r.authority_key], r.name, r.abbr || null, r.sector, r.tier, r.is_statutorily_registered ? 1 : 0);
  }

  // ── Seed CPD rules ─────────────────────────────────────────────────────────
  const ruleIds = {}; // authority_key:role_key → rule_id
  const insertRule = db.prepare(`
    INSERT INTO cpd_requirement_rules
    (rule_id, authority_id, role_id, effective_from, effective_to,
     cycle_type, cycle_length_months, cycle_start_month, cycle_start_day, cycle_start_anchor,
     total_units_required, annual_minimum_units, spread_rule_units, spread_rule_months,
     min_structured_units, min_verifiable_units, max_non_clinical_units, max_non_clinical_percent,
     carry_over_allowed, carry_over_max_units, pause_allowed, pause_max_months, pause_reduced_units,
     new_graduate_exemption, new_graduate_months, new_graduate_reduced_units, mandatory_topics_enabled,
     reflection_required_for_compliance,
     pro_rata_for_part_year, non_practising_exempt, postgrad_study_exempts, deferral_allowed,
     max_units_per_day, first_renewal_ce_exempt, max_management_units,
     presenter_credit_cap, bls_credit_cap, first_renewal_prorata_units,
     ce_window_months, self_study_permitted,
     max_self_study_no_test, max_self_study_with_test, cpr_required_non_cpe,
     regime_type, approval_standard, max_online_hours, max_online_percent,
     renewal_even_year_only, birth_month_renewal, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const r of seed.RULES) {
    const id = uuidv4();
    ruleIds[`${r.authority_key}:${r.role_key}`] = id;
    insertRule.run(
      id, authIds[r.authority_key], roleIds[r.role_key],
      r.effective_from, r.effective_to || null,
      r.cycle_type, r.cycle_length_months,
      r.cycle_start_month || null, r.cycle_start_day || null, r.cycle_start_anchor,
      r.total_units_required, r.annual_minimum_units || null,
      r.spread_rule_units || null, r.spread_rule_months || null,
      r.min_structured_units || null, r.min_verifiable_units || null,
      r.max_non_clinical_units || null, r.max_non_clinical_percent || null,
      r.carry_over_allowed ? 1 : 0, r.carry_over_max_units || null,
      r.pause_allowed ? 1 : 0, r.pause_max_months || null, r.pause_reduced_units || null,
      r.new_graduate_exemption ? 1 : 0, r.new_graduate_months || null, r.new_graduate_reduced_units || null,
      r.mandatory_topics_enabled ? 1 : 0,
      r.reflection_required_for_compliance ? 1 : 0,
      r.pro_rata_for_part_year ? 1 : 0, r.non_practising_exempt ? 1 : 0,
      r.postgrad_study_exempts ? 1 : 0, r.deferral_allowed ? 1 : 0,
      r.max_units_per_day || null,
      r.first_renewal_ce_exempt ? 1 : 0,
      r.max_management_units || null,
      r.presenter_credit_cap || null,
      r.bls_credit_cap || null,
      r.first_renewal_prorata_units || null,
      r.ce_window_months || null,
      r.self_study_permitted !== false ? 1 : 0,
      r.max_self_study_no_test || null,
      r.max_self_study_with_test || null,
      r.cpr_required_non_cpe ? 1 : 0,
      r.regime_type || 'US_HOURS_BASED',
      r.approval_standard || 'RACE_OR_BOARD',
      r.max_online_hours || null,
      r.max_online_percent || null,
      r.renewal_even_year_only ? 1 : 0,
      r.birth_month_renewal ? 1 : 0,
      r.notes || null
    );
  }

  // ── Seed topic rules ───────────────────────────────────────────────────────
  const insertTopic = db.prepare(`
    INSERT INTO mandatory_topic_rules
    (topic_rule_id, rule_id, topic_name, topic_category,
     min_units_per_cycle, min_units_per_year, max_units_per_cycle, max_percent_of_total,
     must_be_live, must_be_in_person, applies_if_holds_dea, applies_if_prescriber, applies_if_does_radiography,
     trigger_type, trigger_attribute_key, trigger_attribute_value, effective_from_year)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const t of seed.TOPIC_RULES) {
    const ruleId = ruleIds[`${t.authority_key}:${t.role_key}`];
    if (!ruleId) continue;
    insertTopic.run(
      uuidv4(), ruleId, t.topic_name, t.topic_category,
      t.min_units_per_cycle || null, t.min_units_per_year || null,
      t.max_units_per_cycle || null, t.max_percent_of_total || null,
      t.must_be_live ? 1 : 0, t.must_be_in_person ? 1 : 0,
      t.applies_if_holds_dea ? 1 : 0, t.applies_if_prescriber ? 1 : 0,
      t.applies_if_does_radiography ? 1 : 0,
      t.trigger_type || 'ALL_ACTIVE',
      t.trigger_attribute_key || null,
      t.trigger_attribute_value || null,
      t.effective_from_year || null
    );
  }

  // ── Seed demo practitioner + registration + cycle ──────────────────────────
  const practId = uuidv4();
  db.prepare(`INSERT INTO practitioners (practitioner_id, first_name, last_name, email, country_of_practice, demo_settings)
    VALUES (?,?,?,?,?,?)`).run(
    practId, seed.DEMO_PRACTITIONER.first_name, seed.DEMO_PRACTITIONER.last_name,
    seed.DEMO_PRACTITIONER.email, seed.DEMO_PRACTITIONER.country_of_practice,
    JSON.stringify(seed.DEMO_SETTINGS)
  );

  const dr = seed.DEMO_REGISTRATION;
  const regId = uuidv4();
  db.prepare(`INSERT INTO registrations
    (registration_id, practitioner_id, authority_id, role_id, registration_number,
     registration_date, registration_status, is_new_graduate, holds_dea_registration,
     holds_prescribing_rights, practice_type, fte_percentage, active_from)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    regId, practId, authIds[dr.authority_key], roleIds[dr.role_key],
    dr.registration_number, dr.registration_date, dr.registration_status,
    dr.is_new_graduate ? 1 : 0, dr.holds_dea_registration ? 1 : 0,
    dr.holds_prescribing_rights ? 1 : 0, dr.practice_type, dr.fte_percentage, dr.active_from
  );

  const dc = seed.DEMO_CYCLE;
  const ruleId = ruleIds[`${dr.authority_key}:${dr.role_key}`];
  db.prepare(`INSERT INTO cpd_cycles
    (cycle_id, registration_id, rule_id, cycle_number, cycle_start_date, cycle_end_date,
     units_required, min_structured_required, units_completed, structured_completed,
     verifiable_completed, non_clinical_completed, mandatory_topics_met, status, is_paused)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    uuidv4(), regId, ruleId, dc.cycle_number, dc.cycle_start_date, dc.cycle_end_date,
    dc.units_required, dc.min_structured_required, dc.units_completed,
    dc.structured_completed, dc.verifiable_completed, dc.non_clinical_completed,
    dc.mandatory_topics_met ? 1 : 0, dc.status, dc.is_paused ? 1 : 0
  );

  db.close();
  console.log('[DB] Seed complete — authorities, roles, rules and demo data loaded.');
}

module.exports = { initDb, getDb, DB_PATH, applyMigrations };
