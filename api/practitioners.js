'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../database/db');

// Helper — get the one demo practitioner (single-user demo)
async function getDemo() {
  return db.queryOne('SELECT * FROM practitioners ORDER BY created_at LIMIT 1');
}

// GET /api/practitioners/me
router.get('/me', async (req, res) => {
  try {
    const p = await getDemo();
    if (!p) return res.status(404).json({ error: 'No practitioner found' });
    p.demo_settings = p.demo_settings ? JSON.parse(p.demo_settings) : {};
    const reg = await db.queryOne(`
      SELECT r.*, a.authority_key, a.authority_name, a.authority_abbreviation,
             a.unit_label, a.cpd_term, a.cpd_term_full, a.split_label,
             a.mandatory_topics_enabled, a.units_per_hour,
             ro.role_key, ro.role_name, ro.role_abbreviation, ro.tier,
             ro.is_statutorily_registered, ro.sector
      FROM registrations r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE r.practitioner_id = ?
      ORDER BY r.created_at DESC LIMIT 1`, [p.practitioner_id]);
    p.registration = reg || null;
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/practitioners/me
router.put('/me', async (req, res) => {
  try {
    const p = await getDemo();
    if (!p) return res.status(404).json({ error: 'No practitioner found' });
    const allowed = ['first_name','last_name','email','country_of_practice','date_of_birth'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), p.practitioner_id);
    await db.run(`UPDATE practitioners SET ${updates.join(',')}, updated_at=? WHERE practitioner_id=?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/practitioners/me/settings
router.get('/me/settings', async (req, res) => {
  try {
    const p = await getDemo();
    if (!p) return res.status(404).json({});
    res.json(p.demo_settings ? JSON.parse(p.demo_settings) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/practitioners/me/settings
router.put('/me/settings', async (req, res) => {
  try {
    const p = await getDemo();
    if (!p) return res.status(404).json({ error: 'No practitioner found' });
    const existing = p.demo_settings ? JSON.parse(p.demo_settings) : {};
    const merged = Object.assign({}, existing, req.body);
    await db.run('UPDATE practitioners SET demo_settings=?, updated_at=? WHERE practitioner_id=?',
      [JSON.stringify(merged), new Date().toISOString(), p.practitioner_id]);
    res.json({ ok: true, settings: merged });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/practitioners/me/registrations
router.get('/me/registrations', async (req, res) => {
  try {
    const p = await getDemo();
    if (!p) return res.status(404).json([]);
    const regs = await db.query(`
      SELECT r.*, a.authority_key, a.authority_name, a.authority_abbreviation,
             a.unit_label, a.cpd_term, a.cpd_term_full,
             ro.role_key, ro.role_name, ro.sector
      FROM registrations r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE r.practitioner_id = ? ORDER BY r.active_from DESC`, [p.practitioner_id]);
    res.json(regs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/practitioners/me/registration
router.put('/me/registration', async (req, res) => {
  try {
    const p = await getDemo();
    if (!p) return res.status(404).json({ error: 'No practitioner' });
    const reg = await db.queryOne(
      'SELECT * FROM registrations WHERE practitioner_id=? ORDER BY created_at DESC LIMIT 1',
      [p.practitioner_id]);
    if (!reg) return res.status(404).json({ error: 'No registration' });

    const allowed = ['registration_status','is_new_graduate','holds_dea_registration',
      'holds_prescribing_rights','practice_type','fte_percentage','is_specialist',
      'specialty_area','is_advanced_practitioner'];
    const updates = []; const vals = [];

    if (req.body.authority_key) {
      const auth = await db.queryOne(
        'SELECT authority_id FROM registration_authorities WHERE authority_key=?',
        [req.body.authority_key]);
      if (auth) { updates.push('authority_id=?'); vals.push(auth.authority_id); }
    }
    if (req.body.role_key) {
      const role = await db.queryOne(
        'SELECT role_id FROM professional_roles WHERE role_key=?', [req.body.role_key]);
      if (role) { updates.push('role_id=?'); vals.push(role.role_id); }
    }
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), reg.registration_id);
    await db.run(
      `UPDATE registrations SET ${updates.join(',')}, updated_at=? WHERE registration_id=?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
