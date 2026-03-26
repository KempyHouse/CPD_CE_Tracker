'use strict';
const express = require('express');
const router  = express.Router();
const { randomUUID } = require('crypto');
const db      = require('../database/db');

// GET /api/rules
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const where = ['(r.effective_to IS NULL OR r.effective_to >= ?)'];
    const args  = [today];

    if (req.query.authority || req.query.authority_id) {
      const v = req.query.authority || req.query.authority_id;
      const auth = await db.queryOne(
        'SELECT authority_id FROM registration_authorities WHERE authority_key=? OR authority_id=?', [v, v]);
      if (auth) { where.push('r.authority_id = ?'); args.push(auth.authority_id); }
    }
    if (req.query.role || req.query.role_id) {
      const v = req.query.role || req.query.role_id;
      const role = await db.queryOne(
        'SELECT role_id FROM professional_roles WHERE role_key=? OR role_id=?', [v, v]);
      if (role) { where.push('r.role_id = ?'); args.push(role.role_id); }
    }

    const rules = await db.query(`
      SELECT r.*,
             a.authority_key, a.authority_abbreviation, a.unit_label, a.cpd_term, a.cpd_term_full,
             a.split_label, a.mandatory_topics_enabled as auth_topics_enabled,
             ro.role_name, ro.role_key, ro.tier, ro.is_statutorily_registered, ro.sector,
             ro.role_abbreviation
      FROM cpd_requirement_rules r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.effective_from DESC`, args);

    // Attach topics for each rule
    for (const rule of rules) {
      rule.topics = await db.query(
        'SELECT * FROM mandatory_topic_rules WHERE rule_id = ? ORDER BY topic_category, topic_name',
        [rule.rule_id]);
    }

    if ((req.query.authority || req.query.authority_id) &&
        (req.query.role || req.query.role_id) && rules.length === 1) {
      return res.json(rules[0]);
    }
    res.json(rules);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rules/:id
router.get('/:id', async (req, res) => {
  try {
    const rule = await db.queryOne(`
      SELECT r.*, a.authority_abbreviation, a.unit_label, a.cpd_term, a.cpd_term_full,
             a.split_label, ro.role_name, ro.role_key, ro.tier, ro.is_statutorily_registered
      FROM cpd_requirement_rules r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE r.rule_id = ?`, [req.params.id]);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    rule.topics = await db.query(
      'SELECT * FROM mandatory_topic_rules WHERE rule_id = ? ORDER BY topic_category',
      [rule.rule_id]);
    res.json(rule);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rules/:id
router.put('/:id', async (req, res) => {
  try {
    const allowed = [
      'cycle_type','cycle_length_months','effective_from','effective_to',
      'total_units_required','annual_minimum_units',
      'min_structured_units','min_structured_percent',
      'min_verifiable_units','max_non_clinical_units','max_non_clinical_percent',
      'max_online_hours','max_online_percent',
      'dea_additional_units',
      'carry_over_allowed','carry_over_max_units',
      'pause_allowed','pause_max_months',
      'new_graduate_exemption','new_graduate_months','new_graduate_reduced_units',
      'pro_rata_for_part_year','non_practising_exempt','first_renewal_ce_exempt',
      'mandatory_topics_enabled','reflection_required_for_compliance',
      'renewal_even_year_only','birth_month_renewal','cycle_start_anchor',
      'renewal_year_parity','birth_month_offset','renewal_day',
      'regime_type','approval_standard','notes'
    ];
    const updates = []; const vals = [];
    for (const k of allowed) if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    vals.push(new Date().toISOString(), req.params.id);
    await db.run(
      `UPDATE cpd_requirement_rules SET ${updates.join(',')}, updated_at=? WHERE rule_id=?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rules
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.authority_id || !b.role_id) return res.status(400).json({ error: 'authority_id and role_id required' });
    const id = randomUUID();
    const fields = ['rule_id','authority_id','role_id','effective_from','cycle_type','cycle_length_months',
      'total_units_required','annual_minimum_units',
      'min_structured_units','min_structured_percent',
      'min_verifiable_units','max_non_clinical_units','max_non_clinical_percent',
      'max_online_hours','max_online_percent','dea_additional_units',
      'carry_over_allowed','carry_over_max_units','pause_allowed','pause_max_months',
      'new_graduate_exemption','new_graduate_months','new_graduate_reduced_units',
      'pro_rata_for_part_year','non_practising_exempt','first_renewal_ce_exempt',
      'mandatory_topics_enabled','reflection_required_for_compliance',
      'renewal_even_year_only','birth_month_renewal','cycle_start_anchor',
      'regime_type','approval_standard','notes'];
    const n = v => (v === '' || v === undefined) ? null : v;
    const vals = [id, b.authority_id, b.role_id,
      b.effective_from || new Date().toISOString().slice(0,10),
      b.cycle_type||'annual', b.cycle_length_months||12,
      b.total_units_required||0, n(b.annual_minimum_units),
      n(b.min_structured_units), n(b.min_structured_percent),
      n(b.min_verifiable_units), n(b.max_non_clinical_units), n(b.max_non_clinical_percent),
      n(b.max_online_hours), n(b.max_online_percent), n(b.dea_additional_units),
      b.carry_over_allowed||0, n(b.carry_over_max_units),
      b.pause_allowed||0, n(b.pause_max_months),
      b.new_graduate_exemption||0, n(b.new_graduate_months), n(b.new_graduate_reduced_units),
      b.pro_rata_for_part_year||0, b.non_practising_exempt||0, b.first_renewal_ce_exempt||0,
      b.mandatory_topics_enabled||0, b.reflection_required_for_compliance||0,
      b.renewal_even_year_only||0, b.birth_month_renewal||0, n(b.cycle_start_anchor),
      b.regime_type||'US_HOURS_BASED', b.approval_standard||'RACE_OR_BOARD',
      n(b.notes)];
    await db.run(
      `INSERT INTO cpd_requirement_rules (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`, vals);
    const created = await db.queryOne('SELECT * FROM cpd_requirement_rules WHERE rule_id=?', [id]);
    created.topics = await db.query('SELECT * FROM mandatory_topic_rules WHERE rule_id=?', [id]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rules/:id
router.delete('/:id', async (req, res) => {
  try {
    const rule = await db.queryOne('SELECT rule_id FROM cpd_requirement_rules WHERE rule_id=?', [req.params.id]);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    await db.run('DELETE FROM mandatory_topic_rules WHERE rule_id=?', [req.params.id]);
    await db.run('DELETE FROM cpd_requirement_rules WHERE rule_id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rules/:id/topics
router.get('/:id/topics', async (req, res) => {
  try {
    res.json(await db.query(
      'SELECT * FROM mandatory_topic_rules WHERE rule_id=? ORDER BY topic_category,topic_name',
      [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rules/:id/topics
router.post('/:id/topics', async (req, res) => {
  try {
    const b = req.body;
    if (!b.topic_name) return res.status(400).json({ error: 'topic_name required' });
    const id = randomUUID();
    await db.run(`INSERT INTO mandatory_topic_rules
      (topic_rule_id, rule_id, topic_name, topic_category, min_units_per_cycle, min_units_per_year,
       max_units_per_cycle, must_be_live, applies_if_holds_dea, trigger_type, trigger_attribute_key, trigger_attribute_value, topic_cycle_months)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.params.id, b.topic_name, b.topic_category||'mandatory',
       b.min_units_per_cycle||null, b.min_units_per_year||null, b.max_units_per_cycle||null,
       b.must_be_live||0, b.applies_if_holds_dea||0,
       b.trigger_type||'ALL_ACTIVE', b.trigger_attribute_key||null, b.trigger_attribute_value||null,
       b.topic_cycle_months||null]);
    res.status(201).json(await db.queryOne('SELECT * FROM mandatory_topic_rules WHERE topic_rule_id=?', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/rules/topics/:topicId
router.put('/topics/:topicId', async (req, res) => {
  try {
    const allowed = ['topic_name','topic_category','min_units_per_cycle','min_units_per_year',
      'max_units_per_cycle','must_be_live','applies_if_holds_dea','trigger_type','topic_cycle_months'];
    const updates = []; const vals = [];
    for (const k of allowed) if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    if (!updates.length) return res.status(400).json({ error: 'No fields' });
    vals.push(req.params.topicId);
    await db.run(`UPDATE mandatory_topic_rules SET ${updates.join(',')} WHERE topic_rule_id=?`, vals);
    res.json(await db.queryOne('SELECT * FROM mandatory_topic_rules WHERE topic_rule_id=?', [req.params.topicId]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/rules/topics/:topicId
router.delete('/topics/:topicId', async (req, res) => {
  try {
    await db.run('DELETE FROM mandatory_topic_rules WHERE topic_rule_id=?', [req.params.topicId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
