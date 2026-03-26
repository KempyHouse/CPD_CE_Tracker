'use strict';
const express    = require('express');
const { randomUUID } = require('crypto');
const db         = require('../database/db');
const router     = express.Router();

const COLOURS = ['#5b6ee1','#2e7d52','#d97706','#00A8A8','#0891b2','#be185d','#15803d','#b45309'];
function pickColour(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLOURS[h % COLOURS.length];
}
function formatMember(row) { return { ...row, name: `${row.first_name} ${row.last_name}` }; }

// GET /api/team-members
router.get('/', async (req, res) => {
  try {
    const filters = []; const args = [];
    if (req.query.authority_key) { filters.push('authority_key = ?'); args.push(req.query.authority_key); }
    if (req.query.status)        { filters.push('status = ?');        args.push(req.query.status); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')} ` : '';
    const rows = await db.query(`SELECT * FROM team_members ${where}ORDER BY last_name, first_name`, args);
    res.json(rows.map(formatMember));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/team-members/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.queryOne('SELECT * FROM team_members WHERE member_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Member not found' });
    res.json(formatMember(row));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/team-members
router.post('/', async (req, res) => {
  try {
    const id = randomUUID();
    const { first_name, last_name, email, role_key, authority_key,
            registration_date, ce_done, ce_required, status, renewal_deadline,
            avatar_colour, notes } = req.body;
    if (!first_name || !last_name || !email || !role_key || !authority_key) {
      return res.status(400).json({ error: 'first_name, last_name, email, role_key and authority_key are required' });
    }
    await db.run(`
      INSERT INTO team_members
        (member_id, first_name, last_name, email, role_key, authority_key,
         registration_date, ce_done, ce_required, status, renewal_deadline, avatar_colour, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, first_name, last_name, email, role_key, authority_key,
       registration_date || null,
       ce_done || 0, ce_required || 0,
       status || 'on-track',
       renewal_deadline || null,
       avatar_colour || pickColour(email),
       notes || null]);
    const created = await db.queryOne('SELECT * FROM team_members WHERE member_id = ?', [id]);
    res.status(201).json(formatMember(created));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/team-members/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await db.queryOne('SELECT member_id FROM team_members WHERE member_id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Member not found' });
    const fields = ['first_name','last_name','email','role_key','authority_key',
                    'registration_date','ce_done','ce_required','status',
                    'renewal_deadline','avatar_colour','notes'];
    const updates = []; const values = [];
    fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); } });
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);
    await db.run(`UPDATE team_members SET ${updates.join(', ')} WHERE member_id = ?`, values);
    const updated = await db.queryOne('SELECT * FROM team_members WHERE member_id = ?', [req.params.id]);
    res.json(formatMember(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/team-members/:id
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.queryOne('SELECT member_id FROM team_members WHERE member_id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Member not found' });
    await db.run('DELETE FROM team_members WHERE member_id = ?', [req.params.id]);
    res.json({ deleted: true, member_id: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
