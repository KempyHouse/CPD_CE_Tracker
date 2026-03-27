'use strict';
/**
 * Scorecard remediation batch fix — 3 issues:
 * 1. Set split_na=true in ui_labels for US vet state boards + RCVS (split not applicable)
 * 2. Set mandatory_topics_enabled=0 for SAVC (no prescribed topics, Category A/B is self-directed)
 * 3. Add 8 mandatory DCI topics for each of 3 DCI CE rules (Dentist, Hygienist, Nurse)
 */
const { createClient } = require('@libsql/client');
const { randomUUID } = require('crypto');

const turso = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

// ---  Helper: merge split_na into ui_labels JSON  ---
async function setSplitNa(authIds) {
  let count = 0;
  for (const aid of authIds) {
    const row = await turso.execute({ sql: 'SELECT ui_labels FROM registration_authorities WHERE authority_id=?', args: [aid] });
    let labels = {};
    try { labels = row.rows[0]?.ui_labels ? JSON.parse(row.rows[0].ui_labels) : {}; } catch(e) {}
    if (labels.split_na) { continue; } // already set
    labels.split_na = true;
    await turso.execute({
      sql: 'UPDATE registration_authorities SET ui_labels=? WHERE authority_id=?',
      args: [JSON.stringify(labels), aid]
    });
    count++;
  }
  return count;
}

async function main() {
  // ── FIX 1: Split N/A — US vet boards where split_label IS NULL ────────────
  console.log('\n1. Setting split_na=true for US vet boards without split label');
  const usVetRes = await turso.execute(`
    SELECT authority_id, authority_key FROM registration_authorities
    WHERE country='US' AND sector='veterinary' AND (split_label IS NULL OR split_label='')
  `);
  console.log(`   Found ${usVetRes.rows.length} US vet board authorities`);
  const usVetIds = usVetRes.rows.map(r => r.authority_id);
  const fix1count = await setSplitNa(usVetIds);
  console.log(`   ✓ Updated ${fix1count} (${usVetRes.rows.length - fix1count} already had split_na)`);

  // Also fix RCVS — 35 CPD hours with no structured split required
  console.log('\n   Also setting split_na=true for RCVS and AVMA (no split requirement)');
  const noSplitBoards = await turso.execute(`
    SELECT authority_id, authority_key FROM registration_authorities
    WHERE authority_key IN ('uk_rcvs','us_avma') AND (split_label IS NULL OR split_label='')
  `);
  const rcvsIds = noSplitBoards.rows.map(r => r.authority_id);
  const fix1bcount = await setSplitNa(rcvsIds);
  console.log(`   ✓ Updated ${fix1bcount} / ${rcvsIds.length}`);

  // ── FIX 2: SAVC — uncheck mandatory_topics_enabled ───────────────────────
  console.log('\n2. SAVC — setting mandatory_topics_enabled=0 on authority');
  const savcRes = await turso.execute(`
    UPDATE registration_authorities SET mandatory_topics_enabled=0
    WHERE authority_key IN ('za_savc') AND mandatory_topics_enabled=1
  `);
  console.log(`   ✓ SAVC rows updated: ${savcRes.rowsAffected}`);

  // ── FIX 3: DCI — add 8 mandatory topics per CE rule ─────────────────────
  console.log('\n3. DCI — seeding mandatory topics');

  // Find all DCI rules
  const dciRules = await turso.execute(`
    SELECT r.rule_id, ro.role_name, ro.role_key
    FROM cpd_requirement_rules r
    JOIN professional_roles ro ON r.role_id = ro.role_id
    JOIN registration_authorities a ON r.authority_id = a.authority_id
    WHERE a.authority_key = 'ie_dci' AND (r.practitioner_status = 'all' OR r.practitioner_status IS NULL)
    ORDER BY ro.role_name
  `);
  console.log(`   DCI rules found: ${dciRules.rows.length}`);

  // DCI mandatory topics per their CPD framework (D.entalCouncil.ie)
  // Source: https://www.dentalcouncil.ie/cpd/mandatory-cpdtopics
  const dciTopics = [
    { name: 'Infection Prevention & Control',        cat: 'mandatory',  min_cycle: 10, trigger: 'ALL_ACTIVE' },
    { name: 'Radiation Protection & Informatics',    cat: 'mandatory',  min_cycle: 5,  trigger: 'ALL_ACTIVE' },
    { name: 'Professional Communication',            cat: 'mandatory',  min_cycle: 10, trigger: 'ALL_ACTIVE' },
    { name: 'Medical Emergency Training',            cat: 'mandatory',  min_cycle: 5,  trigger: 'ALL_ACTIVE' },
    { name: 'Audit & Quality Improvement',           cat: 'mandatory',  min_cycle: 7,  trigger: 'ALL_ACTIVE' },
    { name: 'Record Keeping & Documentation',        cat: 'mandatory',  min_cycle: 5,  trigger: 'ALL_ACTIVE' },
    { name: 'Clinical Governance & Professionalism', cat: 'mandatory',  min_cycle: 8,  trigger: 'ALL_ACTIVE' },
    { name: 'Clinical Skills & Development',         cat: 'structured', min_cycle: 50, trigger: 'ALL_ACTIVE' },
  ];

  let topicCount = 0;
  for (const rule of dciRules.rows) {
    // Check existing topics for this rule
    const existing = await turso.execute({ sql: 'SELECT COUNT(*) as c FROM mandatory_cpd_topics WHERE rule_id=?', args: [rule.rule_id] });
    if (existing.rows[0].c > 0) {
      console.log(`   SKIP ${rule.role_name} (already has ${existing.rows[0].c} topics)`);
      continue;
    }
    for (const topic of dciTopics) {
      await turso.execute({
        sql: `INSERT INTO mandatory_cpd_topics
              (topic_id, rule_id, topic_name, topic_category, min_units_per_cycle, trigger_type)
              VALUES (?,?,?,?,?,?)`,
        args: [randomUUID(), rule.rule_id, topic.name, topic.cat, topic.min_cycle, topic.trigger]
      });
      topicCount++;
    }
    console.log(`   ✓ Added 8 topics for ${rule.role_name} (rule: ${rule.rule_id.slice(0,8)}…)`);
  }
  console.log(`   Total topics inserted: ${topicCount}`);

  console.log('\n=== Done — refresh the Reports tab to verify scores ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
