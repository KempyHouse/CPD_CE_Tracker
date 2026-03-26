'use strict';
const express = require('express');
const router  = express.Router();
const { randomUUID } = require('crypto');
const db      = require('../database/db');

// GET /api/authorities
router.get('/', async (req, res) => {
  try {
    let sql = "SELECT * FROM registration_authorities WHERE authority_key NOT LIKE '!_%' ESCAPE '!'";
    const args = [];
    if (req.query.sector) { sql += ' AND (sector = ? OR sector = ?)'; args.push(req.query.sector, 'both'); }
    sql += ' ORDER BY sector, authority_name';
    const rows = await db.query(sql, args);
    rows.forEach(a => { try { a.ui_labels = a.ui_labels ? JSON.parse(a.ui_labels) : null; } catch(e) {} });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/authorities/:id
router.get('/:id', async (req, res) => {
  try {
    const auth = await db.queryOne(
      'SELECT * FROM registration_authorities WHERE authority_id = ? OR authority_key = ?',
      [req.params.id, req.params.id]);
    if (!auth) return res.status(404).json({ error: 'Authority not found' });
    try { auth.ui_labels = auth.ui_labels ? JSON.parse(auth.ui_labels) : null; } catch(e) {}
    auth.roles = await db.query(
      'SELECT * FROM professional_roles WHERE authority_id = ? ORDER BY tier, role_name',
      [auth.authority_id]);
    res.json(auth);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/authorities/:id/roles
router.get('/:id/roles', async (req, res) => {
  try {
    const auth = await db.queryOne(
      'SELECT authority_id FROM registration_authorities WHERE authority_id = ? OR authority_key = ?',
      [req.params.id, req.params.id]);
    if (!auth) return res.status(404).json({ error: 'Authority not found' });
    res.json(await db.query(
      'SELECT * FROM professional_roles WHERE authority_id = ? ORDER BY tier, role_name',
      [auth.authority_id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/authorities
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    const required = ['authority_key','authority_name','authority_abbreviation','country','sector'];
    for (const f of required) if (!b[f]) return res.status(400).json({ error: `Missing: ${f}` });
    if (b.authority_key.startsWith('_')) return res.status(400).json({ error: 'Key cannot start with _' });
    const id = randomUUID();
    await db.run(`INSERT INTO registration_authorities
      (authority_id, authority_key, authority_name, authority_abbreviation, country, sector,
       website_url, uses_hours, uses_points, unit_label, split_label, split_bar_concept,
       mandatory_topics_enabled, cpd_term, cpd_term_full, ui_labels)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.authority_key, b.authority_name, b.authority_abbreviation, b.country, b.sector,
       b.website_url||null, b.uses_hours!==undefined?b.uses_hours:1, b.uses_points||0,
       b.unit_label||'hours', b.split_label||null, b.split_bar_concept||'structured',
       b.mandatory_topics_enabled||0, b.cpd_term||'CE', b.cpd_term_full||'Continuing Education',
       b.ui_labels ? JSON.stringify(b.ui_labels) : null]);
    const created = await db.queryOne(
      'SELECT * FROM registration_authorities WHERE authority_id=?', [id]);
    try { created.ui_labels = created.ui_labels ? JSON.parse(created.ui_labels) : null; } catch(e) {}
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/authorities/:id
router.put('/:id', async (req, res) => {
  try {
    const auth = await db.queryOne(
      'SELECT authority_id FROM registration_authorities WHERE authority_id=? OR authority_key=?',
      [req.params.id, req.params.id]);
    if (!auth) return res.status(404).json({ error: 'Not found' });
    const allowed = ['authority_name','authority_abbreviation','country','sector','website_url',
      'uses_hours','uses_points','unit_label','split_label','split_bar_concept',
      'mandatory_topics_enabled','cpd_term','cpd_term_full'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (req.body.ui_labels !== undefined) {
      const existing = await db.queryOne(
        'SELECT ui_labels FROM registration_authorities WHERE authority_id=?', [auth.authority_id]);
      let current = {}; try { current = existing?.ui_labels ? JSON.parse(existing.ui_labels) : {}; } catch(e) {}
      Object.assign(current, req.body.ui_labels);
      updates.push('ui_labels=?'); vals.push(JSON.stringify(current));
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), auth.authority_id);
    await db.run(
      `UPDATE registration_authorities SET ${updates.join(',')}, updated_at=? WHERE authority_id=?`, vals);
    const updated = await db.queryOne(
      'SELECT * FROM registration_authorities WHERE authority_id=?', [auth.authority_id]);
    try { updated.ui_labels = updated.ui_labels ? JSON.parse(updated.ui_labels) : null; } catch(e) {}
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
