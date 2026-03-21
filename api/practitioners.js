'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');

// Helper — get the one demo practitioner (single-user demo)
function getDemo(db) {
  return db.prepare('SELECT * FROM practitioners ORDER BY created_at LIMIT 1').get();
}

// GET /api/practitioners/me — current practitioner with active registration
router.get('/me', (req, res) => {
  const db = getDb();
  try {
    const p = getDemo(db);
    if (!p) return res.status(404).json({ error: 'No practitioner found' });
    p.demo_settings = p.demo_settings ? JSON.parse(p.demo_settings) : {};
    const reg = db.prepare(`
      SELECT r.*, a.authority_key, a.authority_name, a.authority_abbreviation,
             a.unit_label, a.cpd_term, a.cpd_term_full, a.split_label,
             a.mandatory_topics_enabled, a.units_per_hour,
             ro.role_key, ro.role_name, ro.role_abbreviation, ro.tier,
             ro.is_statutorily_registered, ro.sector
      FROM registrations r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE r.practitioner_id = ?
      ORDER BY r.created_at DESC LIMIT 1`).get(p.practitioner_id);
    p.registration = reg || null;
    res.json(p);
  } finally { db.close(); }
});

// PUT /api/practitioners/me — update profile fields
router.put('/me', (req, res) => {
  const db = getDb();
  try {
    const p = getDemo(db);
    if (!p) return res.status(404).json({ error: 'No practitioner found' });
    const allowed = ['first_name','last_name','email','country_of_practice','date_of_birth'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), p.practitioner_id);
    db.prepare(`UPDATE practitioners SET ${updates.join(',')}, updated_at=? WHERE practitioner_id=?`).run(...vals);
    res.json({ ok: true });
  } finally { db.close(); }
});

// GET /api/practitioners/me/settings — demo display preferences
router.get('/me/settings', (req, res) => {
  const db = getDb();
  try {
    const p = getDemo(db);
    if (!p) return res.status(404).json({});
    res.json(p.demo_settings ? JSON.parse(p.demo_settings) : {});
  } finally { db.close(); }
});

// PUT /api/practitioners/me/settings — save display preferences
router.put('/me/settings', (req, res) => {
  const db = getDb();
  try {
    const p = getDemo(db);
    if (!p) return res.status(404).json({ error: 'No practitioner found' });
    const existing = p.demo_settings ? JSON.parse(p.demo_settings) : {};
    const merged = Object.assign({}, existing, req.body);
    db.prepare('UPDATE practitioners SET demo_settings=?, updated_at=? WHERE practitioner_id=?')
      .run(JSON.stringify(merged), new Date().toISOString(), p.practitioner_id);
    res.json({ ok: true, settings: merged });
  } finally { db.close(); }
});

// GET /api/practitioners/me/registrations — all registrations
router.get('/me/registrations', (req, res) => {
  const db = getDb();
  try {
    const p = getDemo(db);
    if (!p) return res.status(404).json([]);
    const regs = db.prepare(`
      SELECT r.*, a.authority_key, a.authority_name, a.authority_abbreviation,
             a.unit_label, a.cpd_term, a.cpd_term_full,
             ro.role_key, ro.role_name, ro.sector
      FROM registrations r
      JOIN registration_authorities a ON r.authority_id = a.authority_id
      JOIN professional_roles ro ON r.role_id = ro.role_id
      WHERE r.practitioner_id = ? ORDER BY r.active_from DESC`).all(p.practitioner_id);
    res.json(regs);
  } finally { db.close(); }
});

// PUT /api/practitioners/me/registration — update active registration (authority, role, status)
router.put('/me/registration', (req, res) => {
  const db = getDb();
  try {
    const p = getDemo(db);
    if (!p) return res.status(404).json({ error: 'No practitioner' });
    const reg = db.prepare('SELECT * FROM registrations WHERE practitioner_id=? ORDER BY created_at DESC LIMIT 1').get(p.practitioner_id);
    if (!reg) return res.status(404).json({ error: 'No registration' });

    const allowed = ['registration_status','is_new_graduate','holds_dea_registration',
      'holds_prescribing_rights','practice_type','fte_percentage','is_specialist',
      'specialty_area','is_advanced_practitioner'];
    const updates = []; const vals = [];

    // Handle authority/role change
    if (req.body.authority_key) {
      const auth = db.prepare('SELECT authority_id FROM registration_authorities WHERE authority_key=?').get(req.body.authority_key);
      if (auth) { updates.push('authority_id=?'); vals.push(auth.authority_id); }
    }
    if (req.body.role_key) {
      const role = db.prepare('SELECT role_id FROM professional_roles WHERE role_key=?').get(req.body.role_key);
      if (role) { updates.push('role_id=?'); vals.push(role.role_id); }
    }
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), reg.registration_id);
    db.prepare(`UPDATE registrations SET ${updates.join(',')}, updated_at=? WHERE registration_id=?`).run(...vals);
    res.json({ ok: true });
  } finally { db.close(); }
});

module.exports = router;
