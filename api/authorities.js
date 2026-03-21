'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');

// GET /api/authorities — list all (optional ?sector=vet|dental)
router.get('/', (req, res) => {
  const db = getDb();
  try {
    let sql = 'SELECT * FROM registration_authorities';
    const params = [];
    if (req.query.sector) { sql += ' WHERE sector = ? OR sector = ?'; params.push(req.query.sector, 'both'); }
    sql += ' ORDER BY sector, authority_name';
    res.json(db.prepare(sql).all(...params));
  } finally { db.close(); }
});

// GET /api/authorities/:id — single authority with its roles
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const auth = db.prepare('SELECT * FROM registration_authorities WHERE authority_id = ? OR authority_key = ?').get(req.params.id, req.params.id);
    if (!auth) return res.status(404).json({ error: 'Authority not found' });
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
