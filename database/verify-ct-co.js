'use strict';
const { getDb } = require('./init');
const db = getDb();

const rules = db.prepare(`
  SELECT a.authority_key, a.authority_abbreviation, ro.role_key,
         r.total_units_required, r.ce_window_months, r.cycle_length_months,
         r.self_study_permitted, r.first_renewal_ce_exempt,
         r.bls_credit_cap, r.presenter_credit_cap, r.first_renewal_prorata_units
  FROM cpd_requirement_rules r
  JOIN registration_authorities a ON r.authority_id = a.authority_id
  JOIN professional_roles ro ON r.role_id = ro.role_id
  WHERE a.authority_key LIKE 'us_co%' OR a.authority_key LIKE 'us_ct%'
  ORDER BY a.authority_key, ro.role_key
`).all();

const topics = db.prepare(`
  SELECT a.authority_key, ro.role_key, t.topic_name, t.topic_category, t.min_units_per_cycle, t.max_units_per_cycle
  FROM mandatory_topic_rules t
  JOIN cpd_requirement_rules r ON t.rule_id = r.rule_id
  JOIN registration_authorities a ON r.authority_id = a.authority_id
  JOIN professional_roles ro ON r.role_id = ro.role_id
  WHERE a.authority_key LIKE 'us_co%' OR a.authority_key LIKE 'us_ct%'
  ORDER BY a.authority_key, ro.role_key, t.topic_category
`).all();

console.log('\n=== CO + CT CE RULES ===');
rules.forEach(r => {
  const window = r.ce_window_months ? ` | CE window: ${r.ce_window_months}mo` : '';
  const prorata = r.first_renewal_prorata_units ? ` | prorata: ${r.first_renewal_prorata_units}` : '';
  console.log(`[${r.authority_key}] ${r.role_key}: ${r.total_units_required}u / ${r.cycle_length_months}mo${window} | first_exempt:${r.first_renewal_ce_exempt}${prorata} | self_study:${r.self_study_permitted} | bls_cap:${r.bls_credit_cap} | presenter_cap:${r.presenter_credit_cap}`);
});

console.log(`\n=== CO + CT TOPIC RULES (${topics.length} total) ===`);
let lastKey = '';
topics.forEach(t => {
  const key = `${t.authority_key}/${t.role_key}`;
  if (key !== lastKey) { console.log(`\n  -- ${key} --`); lastKey = key; }
  const lim = t.min_units_per_cycle ? `min:${t.min_units_per_cycle}` : t.max_units_per_cycle ? `max:${t.max_units_per_cycle}` : '';
  console.log(`    [${t.topic_category}] ${t.topic_name.substring(0,70)} ${lim}`);
});

db.close();
console.log('\n[verify] Done.');
