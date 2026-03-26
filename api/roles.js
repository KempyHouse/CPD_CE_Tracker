'use strict';
const express = require('express');
const router  = express.Router();
const { randomUUID } = require('crypto');
const db      = require('../database/db');

// GET /api/roles
router.get('/', async (req, res) => {
  try {
    let sql = `SELECT p.*, a.authority_key, a.authority_name, a.authority_abbreviation,
      (SELECT COUNT(*) FROM cpd_requirement_rules r WHERE r.role_id=p.role_id) as rule_count
      FROM professional_roles p
      JOIN registration_authorities a ON a.authority_id=p.authority_id`;
    const args = [];
    if (req.query.authority) {
      const auth = await db.queryOne(
        'SELECT authority_id FROM registration_authorities WHERE authority_key=? OR authority_id=?',
        [req.query.authority, req.query.authority]);
      if (auth) { sql += ' WHERE p.authority_id=?'; args.push(auth.authority_id); }
    }
    sql += ' ORDER BY a.authority_name, p.tier, p.role_name';
    res.json(await db.query(sql, args));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/roles/:id
router.get('/:id', async (req, res) => {
  try {
    const role = await db.queryOne(`SELECT p.*, a.authority_key, a.authority_name
      FROM professional_roles p JOIN registration_authorities a ON a.authority_id=p.authority_id
      WHERE p.role_id=? OR p.role_key=?`, [req.params.id, req.params.id]);
    if (!role) return res.status(404).json({ error: 'Not found' });
    res.json(role);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/roles
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    const required = ['authority_id','role_key','role_name','sector'];
    for (const f of required) if (!b[f]) return res.status(400).json({ error: `Missing: ${f}` });
    const existing = await db.queryOne(
      'SELECT role_id FROM professional_roles WHERE role_key=?', [b.role_key]);
    if (existing) return res.status(409).json({ error: 'role_key already exists' });
    const id = randomUUID();
    await db.run(`INSERT INTO professional_roles
      (role_id, role_key, authority_id, role_name, role_abbreviation, sector, tier, is_statutorily_registered)
      VALUES (?,?,?,?,?,?,?,?)`,
      [id, b.role_key, b.authority_id, b.role_name, b.role_abbreviation||null,
       b.sector, b.tier||'generalist', b.is_statutorily_registered!==undefined?b.is_statutorily_registered:1]);
    res.status(201).json(await db.queryOne('SELECT * FROM professional_roles WHERE role_id=?', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/roles/:id
router.put('/:id', async (req, res) => {
  try {
    const role = await db.queryOne(
      'SELECT role_id FROM professional_roles WHERE role_id=?', [req.params.id]);
    if (!role) return res.status(404).json({ error: 'Not found' });
    const allowed = ['role_name','role_abbreviation','sector','tier','is_statutorily_registered'];
    const updates = []; const vals = [];
    for (const k of allowed) if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), req.params.id);
    await db.run(
      `UPDATE professional_roles SET ${updates.join(',')}, updated_at=? WHERE role_id=?`, vals);
    res.json(await db.queryOne('SELECT * FROM professional_roles WHERE role_id=?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/roles/:id
router.delete('/:id', async (req, res) => {
  try {
    const role = await db.queryOne(
      'SELECT * FROM professional_roles WHERE role_id=?', [req.params.id]);
    if (!role) return res.status(404).json({ error: 'Not found' });
    const linked = await db.queryOne(
      'SELECT COUNT(*) as c FROM cpd_requirement_rules WHERE role_id=?', [req.params.id]);
    if (linked?.c > 0) return res.status(409).json({ error: `Cannot delete — ${linked.c} CE rule(s) reference this role. Delete the rules first.` });
    await db.run('DELETE FROM professional_roles WHERE role_id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
