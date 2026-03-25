'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');

// GET /api/authorities — list all (optional ?sector=vet|dental)
router.get('/', (req, res) => {
  const db = getDb();
  try {
    // authority_key prefixed with '_' marks soft-deleted duplicates — exclude from list
    let sql = "SELECT * FROM registration_authorities WHERE authority_key NOT LIKE '!_%' ESCAPE '!'";
    const params = [];
    if (req.query.sector) { sql += ' AND (sector = ? OR sector = ?)'; params.push(req.query.sector, 'both'); }
    sql += ' ORDER BY sector, authority_name';
    const rows = db.prepare(sql).all(...params);
    rows.forEach(a => { try { a.ui_labels = a.ui_labels ? JSON.parse(a.ui_labels) : null; } catch(e) {} });
    res.json(rows);
  } finally { db.close(); }
});

// GET /api/authorities/:id — single authority with its roles
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const auth = db.prepare('SELECT * FROM registration_authorities WHERE authority_id = ? OR authority_key = ?').get(req.params.id, req.params.id);
    if (!auth) return res.status(404).json({ error: 'Authority not found' });
    try { auth.ui_labels = auth.ui_labels ? JSON.parse(auth.ui_labels) : null; } catch(e) {}
    auth.roles = db.prepare('SELECT * FROM professional_roles WHERE authority_id = ? ORDER BY tier, role_name').all(auth.authority_id);
    res.json(auth);
  } finally { db.close(); }
});

// GET /api/authorities/:id/roles
router.get('/:id/roles', (req, res) => {
  const db = getDb();
  try {
    const auth = db.prepare('SELECT authority_id FROM registration_authorities WHERE authority_id = ? OR authority_key = ?').get(req.params.id, req.params.id);
    if (!auth) return res.status(404).json({ error: 'Authority not found' });
    res.json(db.prepare('SELECT * FROM professional_roles WHERE authority_id = ? ORDER BY tier, role_name').all(auth.authority_id));
  } finally { db.close(); }
});

// POST /api/authorities — create a new authority
router.post('/', (req, res) => {
  const db = getDb();
  try {
    const { randomUUID } = require('crypto');
    const b = req.body;
    const required = ['authority_key','authority_name','authority_abbreviation','country','sector'];
    for (const f of required) if (!b[f]) return res.status(400).json({ error: `Missing: ${f}` });
    if (b.authority_key.startsWith('_')) return res.status(400).json({ error: 'Key cannot start with _' });
    const id = randomUUID();
    db.prepare(`INSERT INTO registration_authorities
      (authority_id, authority_key, authority_name, authority_abbreviation, country, sector,
       website_url, uses_hours, uses_points, unit_label, split_label, split_bar_concept,
       mandatory_topics_enabled, cpd_term, cpd_term_full, ui_labels)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, b.authority_key, b.authority_name, b.authority_abbreviation, b.country, b.sector,
        b.website_url||null, b.uses_hours!==undefined?b.uses_hours:1, b.uses_points||0,
        b.unit_label||'hours', b.split_label||null, b.split_bar_concept||'structured',
        b.mandatory_topics_enabled||0, b.cpd_term||'CE', b.cpd_term_full||'Continuing Education',
        b.ui_labels ? JSON.stringify(b.ui_labels) : null);
    const created = db.prepare('SELECT * FROM registration_authorities WHERE authority_id=?').get(id);
    try { created.ui_labels = created.ui_labels ? JSON.parse(created.ui_labels) : null; } catch(e) {}
    res.status(201).json(created);
  } finally { db.close(); }
});

// PUT /api/authorities/:id — update authority fields
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const auth = db.prepare('SELECT authority_id FROM registration_authorities WHERE authority_id=? OR authority_key=?').get(req.params.id, req.params.id);
    if (!auth) return res.status(404).json({ error: 'Not found' });
    const allowed = ['authority_name','authority_abbreviation','country','sector','website_url',
      'uses_hours','uses_points','unit_label','split_label','split_bar_concept',
      'mandatory_topics_enabled','cpd_term','cpd_term_full'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    // ui_labels: merge with existing
    if (req.body.ui_labels !== undefined) {
      const existing = db.prepare('SELECT ui_labels FROM registration_authorities WHERE authority_id=?').get(auth.authority_id);
      let current = {}; try { current = existing.ui_labels ? JSON.parse(existing.ui_labels) : {}; } catch(e) {}
      Object.assign(current, req.body.ui_labels);
      updates.push('ui_labels=?'); vals.push(JSON.stringify(current));
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), auth.authority_id);
    db.prepare(`UPDATE registration_authorities SET ${updates.join(',')}, updated_at=? WHERE authority_id=?`).run(...vals);
    const updated = db.prepare('SELECT * FROM registration_authorities WHERE authority_id=?').get(auth.authority_id);
    try { updated.ui_labels = updated.ui_labels ? JSON.parse(updated.ui_labels) : null; } catch(e) {}
    res.json(updated);
  } finally { db.close(); }
});

module.exports = router;
