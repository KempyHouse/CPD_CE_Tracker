'use strict';
const db = require('./init').getDb();
const cols = db.prepare('PRAGMA table_info(cpd_requirement_rules)').all().map(c => c.name);
if (!cols.includes('practitioner_status')) {
  db.prepare("ALTER TABLE cpd_requirement_rules ADD COLUMN practitioner_status TEXT NOT NULL DEFAULT 'all'").run();
  console.log('Added: practitioner_status');
} else {
  console.log('Already exists: practitioner_status');
}
db.close();
console.log('Done');
