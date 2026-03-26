'use strict';
const express = require('express');
const router  = express.Router();
const db      = require('../database/db');

// GET /api/activities?cycle_id=...
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM cpd_activities';
    const args = [];
    if (req.query.cycle_id) { sql += ' WHERE cycle_id = ?'; args.push(req.query.cycle_id); }
    sql += ' ORDER BY activity_date DESC';
    res.json(await db.query(sql, args));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/activities/:id
router.get('/:id', async (req, res) => {
  try {
    const a = await db.queryOne('SELECT * FROM cpd_activities WHERE activity_id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Activity not found' });
    res.json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/activities — log a new activity
router.post('/', async (req, res) => {
  try {
    const { randomUUID } = require('crypto');
    const {
      cycle_id, registration_id, activity_title, activity_date, activity_type,
      delivery_format, units_claimed, is_clinical, is_verifiable, is_structured,
      topic_category, provider_name, units_multiplier, reflection_text,
    } = req.body;
    if (!activity_title || !activity_date || !activity_type || !units_claimed) {
      return res.status(400).json({ error: 'activity_title, activity_date, activity_type, units_claimed required' });
    }
    let cid = cycle_id, rid = registration_id;
    if (!cid || !rid) {
      const cycle = await db.queryOne(`
        SELECT c.cycle_id, r.registration_id FROM cpd_cycles c
        JOIN registrations r ON c.registration_id = r.registration_id
        WHERE c.status = 'in_progress' ORDER BY c.created_at DESC LIMIT 1`);
      if (!cycle) return res.status(400).json({ error: 'No active cycle found' });
      cid = cid || cycle.cycle_id; rid = rid || cycle.registration_id;
    }
    const multiplier = units_multiplier || 1.0;
    const awarded = units_claimed * multiplier;
    const id = randomUUID();
    await db.run(`INSERT INTO cpd_activities
      (activity_id, registration_id, cycle_id, activity_title, activity_date,
       activity_type, delivery_format, topic_category, provider_name,
       is_clinical, is_verifiable, is_structured,
       units_claimed, units_awarded, units_multiplier, reflection_text, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')`,
      [id, rid, cid, activity_title, activity_date,
       activity_type, delivery_format || 'in_person', topic_category || null, provider_name || null,
       is_clinical !== false ? 1 : 0, is_verifiable ? 1 : 0, is_structured ? 1 : 0,
       units_claimed, awarded, multiplier, reflection_text || null]);
    await recalcCycle(cid);
    res.status(201).json({ ok: true, activity_id: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/activities/:id
router.put('/:id', async (req, res) => {
  try {
    const a = await db.queryOne('SELECT * FROM cpd_activities WHERE activity_id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const allowed = ['activity_title','activity_date','activity_type','delivery_format',
      'topic_category','provider_name','units_claimed','units_multiplier','is_clinical',
      'is_verifiable','is_structured','reflection_text','status'];
    const updates = []; const vals = [];
    for (const k of allowed) {
      if (req.body[k] !== undefined) { updates.push(`${k}=?`); vals.push(req.body[k]); }
    }
    if (req.body.units_claimed !== undefined || req.body.units_multiplier !== undefined) {
      const claimed = req.body.units_claimed ?? a.units_claimed;
      const mult = req.body.units_multiplier ?? a.units_multiplier;
      updates.push('units_awarded=?'); vals.push(claimed * mult);
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields' });
    vals.push(new Date().toISOString(), req.params.id);
    await db.run(`UPDATE cpd_activities SET ${updates.join(',')}, updated_at=? WHERE activity_id=?`, vals);
    await recalcCycle(a.cycle_id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/activities/:id
router.delete('/:id', async (req, res) => {
  try {
    const a = await db.queryOne('SELECT cycle_id FROM cpd_activities WHERE activity_id=?', [req.params.id]);
    if (!a) return res.status(404).json({ error: 'Not found' });
    await db.run('DELETE FROM cpd_activities WHERE activity_id=?', [req.params.id]);
    await recalcCycle(a.cycle_id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Async recalc cycle totals
async function recalcCycle(cycleId) {
  const totals = await db.queryOne(`
    SELECT
      SUM(units_awarded) as total,
      SUM(CASE WHEN is_structured=1 THEN units_awarded ELSE 0 END)  as structured,
      SUM(CASE WHEN is_verifiable=1 THEN units_awarded ELSE 0 END)  as verifiable,
      SUM(CASE WHEN is_clinical=0   THEN units_awarded ELSE 0 END)  as non_clinical
    FROM cpd_activities WHERE cycle_id=? AND status != 'rejected'`, [cycleId]);
  await db.run(`UPDATE cpd_cycles SET
    units_completed=?, structured_completed=?, verifiable_completed=?, non_clinical_completed=?,
    updated_at=? WHERE cycle_id=?`,
    [totals?.total || 0, totals?.structured || 0, totals?.verifiable || 0, totals?.non_clinical || 0,
     new Date().toISOString(), cycleId]);
}

module.exports = router;
