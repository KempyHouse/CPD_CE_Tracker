'use strict';
const express = require('express');
const router = express.Router();
const { randomUUID: uuidv4 } = require('crypto');
const { getDb } = require('../database/init');

// GET /api/pdp-goals?cycle_id=...
router.get('/', (req, res) => {
  const db = getDb();
  try {
    let sql = 'SELECT * FROM pdp_goals';
    const params = [];
    if (req.query.cycle_id) { sql += ' WHERE cycle_id = ?'; params.push(req.query.cycle_id); }
    sql += ' ORDER BY status, target_date';
    res.json(db.prepare(sql).all(...params));
  } finally { db.close(); }
});

// POST /api/pdp-goals
router.post('/', (req, res) => {
  const db = getDb();
  try {
    const { cycle_id, registration_id, goal_title, goal_description, field_of_practice, target_date } = req.body;
    if (!goal_title) return res.status(400).json({ error: 'goal_title required' });
    let cid = cycle_id, rid = registration_id;
    if (!cid || !rid) {
      // Try in_progress cycle first, then fall back to any most-recent cycle
      let cycle = db.prepare(`SELECT c.cycle_id, r.registration_id FROM cpd_cycles c
        JOIN registrations r ON c.registration_id = r.registration_id
        WHERE c.status='in_progress' ORDER BY c.created_at DESC LIMIT 1`).get();
      if (!cycle) {
        cycle = db.prepare(`SELECT c.cycle_id, r.registration_id FROM cpd_cycles c
          JOIN registrations r ON c.registration_id = r.registration_id
          ORDER BY c.created_at DESC LIMIT 1`).get();
      }
      if (!cycle) return res.status(400).json({ error: 'No cycle found — please seed the database first.' });
      cid = cid || cycle.cycle_id; rid = rid || cycle.registration_id;
    }
    const id = uuidv4();
    db.prepare(`INSERT INTO pdp_goals (goal_id, registration_id, cycle_id, goal_title, goal_description, field_of_practice, target_date)
      VALUES (?,?,?,?,?,?,?)`).run(id, rid, cid, goal_title, goal_description || null, field_of_practice || null, target_date || null);
    res.status(201).json({ ok: true, goal_id: id });
  } finally { db.close(); }
});

// PUT /api/pdp-goals/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const allowed = ['goal_title','goal_description','field_of_practice','target_date','status'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), req.params.id);
    db.prepare(`UPDATE pdp_goals SET ${updates.join(',')}, updated_at=? WHERE goal_id=?`).run(...vals);
    res.json({ ok: true });
  } finally { db.close(); }
});

// DELETE /api/pdp-goals/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    db.prepare('DELETE FROM pdp_goals WHERE goal_id=?').run(req.params.id);
    res.json({ ok: true });
  } finally { db.close(); }
});

module.exports = router;
