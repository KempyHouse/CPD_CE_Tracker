'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../database/db');

// GET /api/cycles/current
router.get('/current', async (req, res) => {
  try {
    const cycle = await db.queryOne(`
      SELECT c.*, r.registration_status, r.is_new_graduate, r.holds_dea_registration,
             r.holds_prescribing_rights, r.practice_type, r.fte_percentage,
             a.authority_key, a.authority_abbreviation, a.unit_label, a.cpd_term, a.cpd_term_full,
             a.split_label, a.mandatory_topics_enabled, a.units_per_hour,
             ro.role_key, ro.role_name, ro.tier, ro.is_statutorily_registered, ro.sector,
             rul.cycle_type, rul.cycle_length_months, rul.total_units_required,
             rul.min_structured_units, rul.min_verifiable_units, rul.max_non_clinical_units,
             rul.carry_over_allowed, rul.pause_allowed, rul.pause_max_months,
             rul.new_graduate_exemption, rul.new_graduate_months, rul.new_graduate_reduced_units,
             rul.non_practising_exempt, rul.pro_rata_for_part_year,
             rul.spread_rule_units, rul.spread_rule_months, rul.deferral_allowed,
             rul.reflection_required_for_compliance
      FROM cpd_cycles c
      JOIN registrations r   ON c.registration_id = r.registration_id
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro      ON r.role_id = ro.role_id
      JOIN cpd_requirement_rules rul  ON c.rule_id  = rul.rule_id
      JOIN practitioners p   ON r.practitioner_id = p.practitioner_id
      WHERE c.status = 'in_progress'
      ORDER BY c.created_at DESC LIMIT 1`);
    if (!cycle) return res.status(404).json({ error: 'No active cycle found' });

    cycle.topics = await db.query(
      'SELECT * FROM mandatory_topic_rules WHERE rule_id = ? ORDER BY topic_category',
      [cycle.rule_id]);

    const reflected = await db.queryOne(`
      SELECT COALESCE(SUM(units_claimed), 0) as total
      FROM cpd_activities
      WHERE cycle_id = ? AND stage = 'reflected' AND status != 'rejected'`,
      [cycle.cycle_id]);
    cycle.reflected_completed = reflected ? reflected.total : 0;

    res.json(cycle);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/cycles
router.get('/', async (req, res) => {
  try {
    const cycles = await db.query(`
      SELECT c.*, a.authority_abbreviation, a.cpd_term, ro.role_name
      FROM cpd_cycles c
      JOIN registrations r ON c.registration_id = r.registration_id
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      JOIN practitioners p ON r.practitioner_id = p.practitioner_id
      ORDER BY c.cycle_start_date DESC`);
    res.json(cycles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/cycles/:id
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['units_completed','structured_completed','verifiable_completed',
      'non_clinical_completed','mandatory_topics_met','spread_rule_met',
      'status','is_paused','pause_start_date','pause_end_date','notes'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), req.params.id);
    await db.run(`UPDATE cpd_cycles SET ${updates.join(',')}, updated_at=? WHERE cycle_id=?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
