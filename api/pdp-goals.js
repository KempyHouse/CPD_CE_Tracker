'use strict';
const express = require('express');
const router  = express.Router();
const { randomUUID } = require('crypto');
const db      = require('../database/db');

// GET /api/pdp-goals?cycle_id=...
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM pdp_goals';
    const args = [];
    if (req.query.cycle_id) { sql += ' WHERE cycle_id = ?'; args.push(req.query.cycle_id); }
    sql += ' ORDER BY status, target_date';
    res.json(await db.query(sql, args));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/pdp-goals
router.post('/', async (req, res) => {
  try {
    const { cycle_id, registration_id, goal_title, goal_description, field_of_practice, target_date } = req.body;
    if (!goal_title) return res.status(400).json({ error: 'goal_title required' });
    let cid = cycle_id, rid = registration_id;
    if (!cid || !rid) {
      let cycle = await db.queryOne(`SELECT c.cycle_id, r.registration_id FROM cpd_cycles c
        JOIN registrations r ON c.registration_id = r.registration_id
        WHERE c.status='in_progress' ORDER BY c.created_at DESC LIMIT 1`);
      if (!cycle) {
        cycle = await db.queryOne(`SELECT c.cycle_id, r.registration_id FROM cpd_cycles c
          JOIN registrations r ON c.registration_id = r.registration_id
          ORDER BY c.created_at DESC LIMIT 1`);
      }
      if (!cycle) return res.status(400).json({ error: 'No cycle found — please seed the database first.' });
      cid = cid || cycle.cycle_id; rid = rid || cycle.registration_id;
    }
    const id = randomUUID();
    await db.run(
      `INSERT INTO pdp_goals (goal_id, registration_id, cycle_id, goal_title, goal_description, field_of_practice, target_date)
       VALUES (?,?,?,?,?,?,?)`,
      [id, rid, cid, goal_title, goal_description || null, field_of_practice || null, target_date || null]);
    res.status(201).json({ ok: true, goal_id: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/pdp-goals/:id
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['goal_title','goal_description','field_of_practice','target_date','status'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), req.params.id);
    await db.run(`UPDATE pdp_goals SET ${updates.join(',')}, updated_at=? WHERE goal_id=?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/pdp-goals/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM pdp_goals WHERE goal_id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
