'use strict';
const { getDb } = require('./database/init');
const db = getDb();

const rules = db.prepare(
  "SELECT a.authority_key, r.total_units_required, r.cycle_type, r.max_online_hours, r.regime_type, r.approval_standard " +
  "FROM cpd_requirement_rules r JOIN registration_authorities a ON r.authority_id=a.authority_id " +
  "WHERE a.authority_key LIKE 'us_%' ORDER BY a.authority_key"
).all();
console.log('US state rules count:', rules.length);

// Spot check: NY should have NY_BOARD_ONLY
const ny = rules.find(r => r.authority_key === 'us_ny_svmb');
console.log('NY rule:', ny ? JSON.stringify({ hrs: ny.total_units_required, approval: ny.approval_standard }) : 'NOT FOUND');

// Spot check: Iowa should have carryover
const ia = db.prepare(
  "SELECT r.total_units_required, r.carry_over_allowed, r.carry_over_max_units, r.regime_type " +
  "FROM cpd_requirement_rules r JOIN registration_authorities a ON r.authority_id=a.authority_id " +
  "WHERE a.authority_key='us_ia_svmb'"
).get();
console.log('IA rule:', ia ? JSON.stringify({ hrs: ia.total_units_required, carryover: ia.carry_over_allowed, max: ia.carry_over_max_units, regime: ia.regime_type }) : 'NOT FOUND');

// Conditional topics count
const condTopics = db.prepare(
  "SELECT COUNT(*) as n FROM mandatory_topic_rules WHERE trigger_type IS NOT NULL AND trigger_type != 'ALL_ACTIVE'"
).get();
console.log('Conditional topics (DEA/location/one-time):', condTopics.n);

const allTopics = db.prepare("SELECT COUNT(*) as n FROM mandatory_topic_rules").get();
console.log('Total mandatory topics:', allTopics.n);

// Show schema columns
const cols = db.prepare("PRAGMA table_info(cpd_requirement_rules)").all().map(c => c.name);
console.log('Has regime_type:', cols.includes('regime_type'));
console.log('Has approval_standard:', cols.includes('approval_standard'));
console.log('Has max_online_hours:', cols.includes('max_online_hours'));
console.log('Has birth_month_renewal:', cols.includes('birth_month_renewal'));

const actCols = db.prepare("PRAGMA table_info(cpd_activities)").all().map(c => c.name);
console.log('Activities has is_online:', actCols.includes('is_online'));
console.log('Activities has is_medical_scientific:', actCols.includes('is_medical_scientific'));

db.close();
