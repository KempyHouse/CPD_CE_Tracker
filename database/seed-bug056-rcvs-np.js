'use strict';
// BUG-056: Seed RCVS non-practising rule into local SQLite
const { randomUUID } = require('crypto');
const db = require('./init').getDb();

// Get RCVS auth + vet surgeon role
const auth = db.prepare("SELECT authority_id FROM registration_authorities WHERE authority_key='uk_rcvs'").get();
const role = db.prepare("SELECT role_id FROM professional_roles WHERE role_key='vet_surgeon' AND authority_id=?").get(auth?.authority_id);

if (!auth || !role) {
  console.log('RCVS or vet_surgeon not found'); db.close(); process.exit(0);
}

const existing = db.prepare(
  "SELECT rule_id FROM cpd_requirement_rules WHERE role_id=? AND practitioner_status='non_practising'"
).get(role.role_id);

if (existing) {
  console.log('Already exists:', existing.rule_id);
} else {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO cpd_requirement_rules
    (rule_id, authority_id, role_id, effective_from, cycle_type, cycle_length_months,
     total_units_required, reflection_required_for_compliance, pro_rata_for_part_year,
     regime_type, approval_standard, practitioner_status, notes)
    VALUES (?,?,?,'2020-01-01','5_year',60, 15,1,1, 'UK_HOURS_BASED','NATIONAL_BOARD','non_practising',
            'RCVS Non-Practising Vet Surgeon: 15 CPD hrs per 5yr cycle. Source: rcvs.org.uk/cpd')
  `).run(id, auth.authority_id, role.role_id);
  console.log('✓ Seeded RCVS NP rule:', id, '(15hrs/5yr, non_practising)');
}
db.close();
console.log('Done');
