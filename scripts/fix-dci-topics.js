'use strict';
/**
 * Fix 3 only: DCI mandatory topics (re-run with correct table name)
 * Table: mandatory_topic_rules (not mandatory_cpd_topics)
 */
const { createClient } = require('@libsql/client');
const { randomUUID } = require('crypto');

const turso = createClient({
  url: 'libsql://cpd-ce-tracker-cpd-ce-tracker.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ1MTkwMjcsImlkIjoiMDE5ZDI5OTMtM2IwMS03Y2ZjLThhYTEtZDM5NmIwM2ZlMjE0IiwicmlkIjoiZDcyNDMxYWUtY2FhYy00OGYxLWEwZWUtNmU4MDhmYTZlMzJmIn0.uMP7ZZdPO6iPkPKxG4pLGOXhk_UEA8Wu5DGcKbyXkkYXzBcWkHgl3CPg8I-wniL1dWDb_7EuPKaKBwHTlhZRDg'
});

async function main() {
  // First check mandatory_topic_rules exists in Turso
  try {
    await turso.execute('SELECT COUNT(*) FROM mandatory_topic_rules LIMIT 1');
    console.log('Table mandatory_topic_rules exists in Turso ✓');
  } catch(e) {
    if (e.message.includes('no such table')) {
      console.log('mandatory_topic_rules missing — creating table in Turso...');
      await turso.execute(`
        CREATE TABLE mandatory_topic_rules (
          topic_rule_id  TEXT PRIMARY KEY,
          rule_id        TEXT NOT NULL REFERENCES cpd_requirement_rules(rule_id),
          topic_name     TEXT NOT NULL,
          topic_category TEXT NOT NULL DEFAULT 'mandatory',
          min_units_per_cycle REAL NULL,
          min_units_per_year  REAL NULL,
          max_units_per_cycle REAL NULL,
          topic_cycle_months  INTEGER NULL,
          trigger_type   TEXT NOT NULL DEFAULT 'ALL_ACTIVE',
          is_live_only   INTEGER NOT NULL DEFAULT 0,
          dea_only       INTEGER NOT NULL DEFAULT 0,
          notes          TEXT NULL,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      console.log('Table created ✓');
    } else {
      throw e;
    }
  }

  // DCI rules
  const dciRules = await turso.execute(`
    SELECT r.rule_id, ro.role_name, ro.role_key
    FROM cpd_requirement_rules r
    JOIN professional_roles ro ON r.role_id = ro.role_id
    JOIN registration_authorities a ON r.authority_id = a.authority_id
    WHERE a.authority_key = 'ie_dci'
      AND (r.practitioner_status = 'all' OR r.practitioner_status IS NULL OR r.practitioner_status = '')
    ORDER BY ro.role_name
  `);
  console.log(`DCI rules found: ${dciRules.rows.length}`);
  dciRules.rows.forEach(r => console.log(`  - ${r.role_name} (${r.rule_id.slice(0,8)}…)`));

  // DCI mandatory topics (Dental Council of Ireland CPD framework)
  const dciTopics = [
    { name: 'Infection Prevention & Control',        cat: 'mandatory',  min_cycle: 10 },
    { name: 'Radiation Protection & Informatics',    cat: 'mandatory',  min_cycle: 5  },
    { name: 'Professional Communication',            cat: 'mandatory',  min_cycle: 10 },
    { name: 'Medical Emergency Training',            cat: 'mandatory',  min_cycle: 5  },
    { name: 'Audit & Quality Improvement',           cat: 'mandatory',  min_cycle: 7  },
    { name: 'Record Keeping & Documentation',        cat: 'mandatory',  min_cycle: 5  },
    { name: 'Clinical Governance & Professionalism', cat: 'mandatory',  min_cycle: 8  },
    { name: 'Clinical Skills & Development',         cat: 'structured', min_cycle: 50 },
  ];

  let totalInserted = 0;
  for (const rule of dciRules.rows) {
    const existing = await turso.execute({ sql: 'SELECT COUNT(*) as c FROM mandatory_topic_rules WHERE rule_id=?', args: [rule.rule_id] });
    if (existing.rows[0].c > 0) {
      console.log(`  SKIP ${rule.role_name} — already has ${existing.rows[0].c} topics`);
      continue;
    }
    for (const t of dciTopics) {
      await turso.execute({
        sql: `INSERT INTO mandatory_topic_rules (topic_rule_id, rule_id, topic_name, topic_category, min_units_per_cycle, trigger_type)
              VALUES (?,?,?,?,?,'ALL_ACTIVE')`,
        args: [randomUUID(), rule.rule_id, t.name, t.cat, t.min_cycle]
      });
      totalInserted++;
    }
    console.log(`  ✓ 8 topics added for: ${rule.role_name}`);
  }
  console.log(`\nTotal DCI topics inserted: ${totalInserted}`);
  console.log('Done');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
