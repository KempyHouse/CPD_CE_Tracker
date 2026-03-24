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

module.exports = router;
