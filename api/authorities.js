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

module.exports = router;
