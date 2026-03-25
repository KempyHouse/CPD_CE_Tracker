'use strict';
const express = require('express');
const router = express.Router();
const { getDb } = require('../database/init');

// GET /api/roles — list all roles (optional ?authority=key_or_id)
router.get('/', (req, res) => {
  const db = getDb();
  try {
    let sql = `SELECT p.*, a.authority_key, a.authority_name, a.authority_abbreviation,
      (SELECT COUNT(*) FROM cpd_requirement_rules r WHERE r.role_id=p.role_id) as rule_count
      FROM professional_roles p
      JOIN registration_authorities a ON a.authority_id=p.authority_id`;
    const params = [];
    if (req.query.authority) {
      const auth = db.prepare('SELECT authority_id FROM registration_authorities WHERE authority_key=? OR authority_id=?').get(req.query.authority, req.query.authority);
      if (auth) { sql += ' WHERE p.authority_id=?'; params.push(auth.authority_id); }
    }
    sql += ' ORDER BY a.authority_name, p.tier, p.role_name';
    res.json(db.prepare(sql).all(...params));
  } finally { db.close(); }
});

// GET /api/roles/:id — single role
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const role = db.prepare(`SELECT p.*, a.authority_key, a.authority_name
      FROM professional_roles p JOIN registration_authorities a ON a.authority_id=p.authority_id
      WHERE p.role_id=? OR p.role_key=?`).get(req.params.id, req.params.id);
    if (!role) return res.status(404).json({ error: 'Not found' });
    res.json(role);
  } finally { db.close(); }
});

// POST /api/roles — create a role
router.post('/', (req, res) => {
  const db = getDb();
  try {
    const { randomUUID } = require('crypto');
    const b = req.body;
    const required = ['authority_id','role_key','role_name','sector'];
    for (const f of required) if (!b[f]) return res.status(400).json({ error: `Missing: ${f}` });
    // Ensure unique role_key
    const existing = db.prepare('SELECT role_id FROM professional_roles WHERE role_key=?').get(b.role_key);
    if (existing) return res.status(409).json({ error: 'role_key already exists' });
    const id = randomUUID();
    db.prepare(`INSERT INTO professional_roles
      (role_id, role_key, authority_id, role_name, role_abbreviation, sector, tier, is_statutorily_registered)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(id, b.role_key, b.authority_id, b.role_name, b.role_abbreviation||null,
        b.sector, b.tier||'generalist', b.is_statutorily_registered!==undefined?b.is_statutorily_registered:1);
    res.status(201).json(db.prepare('SELECT * FROM professional_roles WHERE role_id=?').get(id));
  } finally { db.close(); }
});

// PUT /api/roles/:id — update role
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const role = db.prepare('SELECT role_id FROM professional_roles WHERE role_id=?').get(req.params.id);
    if (!role) return res.status(404).json({ error: 'Not found' });
    const allowed = ['role_name','role_abbreviation','sector','tier','is_statutorily_registered'];
    const updates = []; const vals = [];
    for (const k of allowed) if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), req.params.id);
    db.prepare(`UPDATE professional_roles SET ${updates.join(',')}, updated_at=? WHERE role_id=?`).run(...vals);
    res.json(db.prepare('SELECT * FROM professional_roles WHERE role_id=?').get(req.params.id));
  } finally { db.close(); }
});

// DELETE /api/roles/:id — soft delete (rename key to _deleted_*)
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const role = db.prepare('SELECT * FROM professional_roles WHERE role_id=?').get(req.params.id);
    if (!role) return res.status(404).json({ error: 'Not found' });
    // Check for linked CE rules
    const ruleCount = db.prepare('SELECT COUNT(*) as c FROM cpd_requirement_rules WHERE role_id=?').get(req.params.id).c;
    if (ruleCount > 0) return res.status(409).json({ error: `Cannot delete — ${ruleCount} CE rule(s) reference this role. Delete the rules first.` });
    db.prepare('DELETE FROM professional_roles WHERE role_id=?').run(req.params.id);
    res.json({ ok: true });
  } finally { db.close(); }
});

module.exports = router;
