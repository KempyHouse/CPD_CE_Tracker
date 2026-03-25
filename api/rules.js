'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');

// GET /api/rules — query by authority + optional role (returns active rule)
// ?authority=uk_rcvs OR ?authority_id=<uuid>  &role=vet_surgeon OR &role_id=<uuid>
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const today = new Date().toISOString().slice(0,10);
    let where = ['(r.effective_to IS NULL OR r.effective_to >= ?)'];
    const params = [today];

    if (req.query.authority || req.query.authority_id) {
      const authVal = req.query.authority || req.query.authority_id;
      const auth = db.prepare('SELECT authority_id FROM registration_authorities WHERE authority_key=? OR authority_id=?').get(authVal, authVal);
      if (auth) { where.push('r.authority_id = ?'); params.push(auth.authority_id); }
    }
    if (req.query.role || req.query.role_id) {
      const roleVal = req.query.role || req.query.role_id;
      const role = db.prepare('SELECT role_id FROM professional_roles WHERE role_key=? OR role_id=?').get(roleVal, roleVal);
      if (role) { where.push('r.role_id = ?'); params.push(role.role_id); }
    }

    const sql = `
      SELECT r.*,
             a.authority_key, a.authority_abbreviation, a.unit_label, a.cpd_term, a.cpd_term_full,
             a.split_label, a.mandatory_topics_enabled as auth_topics_enabled,
             ro.role_name, ro.role_key, ro.tier, ro.is_statutorily_registered, ro.sector,
             ro.role_abbreviation
      FROM cpd_requirement_rules r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.effective_from DESC
    `;
    const rules = db.prepare(sql).all(...params);

    // Attach topic rules to each rule
    const stmtTopics = db.prepare('SELECT * FROM mandatory_topic_rules WHERE rule_id = ? ORDER BY topic_category, topic_name');
    for (const rule of rules) {
      rule.topics = stmtTopics.all(rule.rule_id);
    }

    // Return single object if exact authority+role match, otherwise array
    if ((req.query.authority || req.query.authority_id) && (req.query.role || req.query.role_id) && rules.length === 1) {
      return res.json(rules[0]);
    }
    res.json(rules);
  } finally { db.close(); }
});

// GET /api/rules/:id — single rule with topics
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const rule = db.prepare(`
      SELECT r.*, a.authority_abbreviation, a.unit_label, a.cpd_term, a.cpd_term_full,
             a.split_label, ro.role_name, ro.role_key, ro.tier, ro.is_statutorily_registered
      FROM cpd_requirement_rules r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE r.rule_id = ?`).get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    rule.topics = db.prepare('SELECT * FROM mandatory_topic_rules WHERE rule_id = ? ORDER BY topic_category').all(rule.rule_id);
    res.json(rule);
  } finally { db.close(); }
});

// PUT /api/rules/:id — update a rule (admin)
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const allowed = ['total_units_required','annual_minimum_units','min_structured_units',
      'min_verifiable_units','max_non_clinical_units','max_non_clinical_percent',
      'pause_allowed','pause_max_months','carry_over_allowed','carry_over_max_units',
      'new_graduate_reduced_units','mandatory_topics_enabled','notes'];
    const updates = [];const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    vals.push(new Date().toISOString(), req.params.id);
    db.prepare(`UPDATE cpd_requirement_rules SET ${updates.join(',')}, updated_at=? WHERE rule_id=?`).run(...vals);
    res.json({ ok: true });
  } finally { db.close(); }
});

// POST /api/rules — create a CE requirement rule
router.post('/', (req, res) => {
  const db = getDb();
  try {
    const { randomUUID } = require('crypto');
    const b = req.body;
    if (!b.authority_id || !b.role_id) return res.status(400).json({ error: 'authority_id and role_id required' });
    const id = randomUUID();
    const fields = ['rule_id','authority_id','role_id','effective_from','cycle_type','cycle_length_months',
      'total_units_required','min_structured_units','max_non_clinical_units','max_online_hours',
      'carry_over_allowed','carry_over_max_units','pause_allowed','pause_max_months',
      'new_graduate_exemption','new_graduate_months','new_graduate_reduced_units',
      'pro_rata_for_part_year','non_practising_exempt','first_renewal_ce_exempt',
      'mandatory_topics_enabled','regime_type','approval_standard','notes'];
    const vals = [id, b.authority_id, b.role_id,
      b.effective_from||new Date().toISOString().slice(0,10),
      b.cycle_type||'annual', b.cycle_length_months||12, b.total_units_required||0,
      b.min_structured_units||null, b.max_non_clinical_units||null, b.max_online_hours||null,
      b.carry_over_allowed||0, b.carry_over_max_units||null,
      b.pause_allowed||0, b.pause_max_months||null,
      b.new_graduate_exemption||0, b.new_graduate_months||null, b.new_graduate_reduced_units||null,
      b.pro_rata_for_part_year||0, b.non_practising_exempt||0, b.first_renewal_ce_exempt||0,
      b.mandatory_topics_enabled||0, b.regime_type||'US_HOURS_BASED', b.approval_standard||'RACE_OR_BOARD',
      b.notes||null];
    db.prepare(`INSERT INTO cpd_requirement_rules (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).run(...vals);
    const created = db.prepare('SELECT * FROM cpd_requirement_rules WHERE rule_id=?').get(id);
    created.topics = db.prepare('SELECT * FROM mandatory_topic_rules WHERE rule_id=?').all(id);
    res.status(201).json(created);
  } finally { db.close(); }
});

// DELETE /api/rules/:id — delete rule + cascade topics
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const rule = db.prepare('SELECT rule_id FROM cpd_requirement_rules WHERE rule_id=?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    db.prepare('DELETE FROM mandatory_topic_rules WHERE rule_id=?').run(req.params.id);
    db.prepare('DELETE FROM cpd_requirement_rules WHERE rule_id=?').run(req.params.id);
    res.json({ ok: true });
  } finally { db.close(); }
});

// ── Topic sub-routes ──────────────────────────────────────────────────────────
// GET /api/rules/:id/topics
router.get('/:id/topics', (req, res) => {
  const db = getDb();
  try { res.json(db.prepare('SELECT * FROM mandatory_topic_rules WHERE rule_id=? ORDER BY topic_category,topic_name').all(req.params.id)); } finally { db.close(); }
});

// POST /api/rules/:id/topics
router.post('/:id/topics', (req, res) => {
  const db = getDb();
  try {
    const { randomUUID } = require('crypto');
    const b = req.body;
    if (!b.topic_name) return res.status(400).json({ error: 'topic_name required' });
    const id = randomUUID();
    db.prepare(`INSERT INTO mandatory_topic_rules
      (topic_rule_id, rule_id, topic_name, topic_category, min_units_per_cycle, min_units_per_year,
       max_units_per_cycle, must_be_live, applies_if_holds_dea, trigger_type, trigger_attribute_key, trigger_attribute_value)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.params.id, b.topic_name, b.topic_category||'mandatory',
        b.min_units_per_cycle||null, b.min_units_per_year||null, b.max_units_per_cycle||null,
        b.must_be_live||0, b.applies_if_holds_dea||0,
        b.trigger_type||'ALL_ACTIVE', b.trigger_attribute_key||null, b.trigger_attribute_value||null);
    res.status(201).json(db.prepare('SELECT * FROM mandatory_topic_rules WHERE topic_rule_id=?').get(id));
  } finally { db.close(); }
});

// PUT /api/rules/topics/:topicId
router.put('/topics/:topicId', (req, res) => {
  const db = getDb();
  try {
    const allowed = ['topic_name','topic_category','min_units_per_cycle','min_units_per_year',
      'max_units_per_cycle','must_be_live','applies_if_holds_dea','trigger_type'];
    const updates = []; const vals = [];
    for (const k of allowed) if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    if (!updates.length) return res.status(400).json({ error: 'No fields' });
    vals.push(req.params.topicId);
    db.prepare(`UPDATE mandatory_topic_rules SET ${updates.join(',')} WHERE topic_rule_id=?`).run(...vals);
    res.json(db.prepare('SELECT * FROM mandatory_topic_rules WHERE topic_rule_id=?').get(req.params.topicId));
  } finally { db.close(); }
});

// DELETE /api/rules/topics/:topicId
router.delete('/topics/:topicId', (req, res) => {
  const db = getDb();
  try {
    db.prepare('DELETE FROM mandatory_topic_rules WHERE topic_rule_id=?').run(req.params.topicId);
    res.json({ ok: true });
  } finally { db.close(); }
});

module.exports = router;
