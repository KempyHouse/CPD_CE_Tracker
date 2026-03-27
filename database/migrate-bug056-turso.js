'use strict';
// BUG-056: Add practitioner_status column to Turso + seed RCVS non-practising rule
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

const { randomUUID } = require('crypto');

async function main() {
  // 1. Add column
  try {
    await client.execute("ALTER TABLE cpd_requirement_rules ADD COLUMN practitioner_status TEXT NOT NULL DEFAULT 'all'");
    console.log('✓ Added: practitioner_status');
  } catch (e) {
    console.log('Skip:', e.message.slice(0, 60));
  }

  // 2. Seed RCVS non-practising rule
  // RCVS requires 15 CPD hours per 5 years for non-practising vets
  // Source: https://www.rcvs.org.uk/setting-standards/advice-and-guidance/cpd/
  const auth = await client.execute("SELECT authority_id FROM registration_authorities WHERE authority_key='uk_rcvs' LIMIT 1");
  const role = await client.execute("SELECT role_id FROM professional_roles WHERE role_key='vet_surgeon' AND authority_id=(SELECT authority_id FROM registration_authorities WHERE authority_key='uk_rcvs') LIMIT 1");

  if (!auth.rows.length || !role.rows.length) {
    console.log('RCVS or vet_surgeon not found in Turso');
  } else {
    const authId = auth.rows[0].authority_id;
    const roleId = role.rows[0].role_id;
    // Check if a non_practising rule already exists
    const existing = await client.execute({
      sql: "SELECT rule_id FROM cpd_requirement_rules WHERE role_id=? AND practitioner_status='non_practising'",
      args: [roleId]
    });
    if (existing.rows.length) {
      console.log('RCVS NP rule already exists:', existing.rows[0].rule_id);
    } else {
      const newId = randomUUID();
      await client.execute({
        sql: `INSERT INTO cpd_requirement_rules
              (rule_id, authority_id, role_id, effective_from, cycle_type, cycle_length_months,
               total_units_required, reflection_required_for_compliance, pro_rata_for_part_year,
               regime_type, approval_standard, practitioner_status, notes)
              VALUES (?,?,?,'2020-01-01','5_year',60, 15,1,1, 'UK_HOURS_BASED','NATIONAL_BOARD','non_practising',
                      'RCVS Non-Practising Veterinary Surgeon: 15 CPD hours per 5-year cycle (vs 35 for active). Reflection required. Source: rcvs.org.uk/cpd')`,
        args: [newId, authId, roleId]
      });
      console.log('✓ Seeded RCVS non-practising rule:', newId, '(15hrs/5yr)');
    }
  }

  console.log('\nDone — BUG-056 Turso migration complete');
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
