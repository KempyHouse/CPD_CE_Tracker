'use strict';
const express = require('express');
const { randomUUID } = require('crypto');
const { getDb } = require('../database/init');

const router = express.Router();

// ── GET /api/team-members ──────────────────────────────────────────────────
// Returns all team members, optionally filtered by ?authority_key= or ?status=
router.get('/', (req, res) => {
  const db = getDb();
  try {
    let sql = 'SELECT * FROM team_members ORDER BY last_name, first_name';
    const params = [];
    const filters = [];

    if (req.query.authority_key) {
      filters.push('authority_key = ?');
      params.push(req.query.authority_key);
    }
    if (req.query.status) {
      filters.push('status = ?');
      params.push(req.query.status);
    }
    if (filters.length) {
      sql = `SELECT * FROM team_members WHERE ${filters.join(' AND ')} ORDER BY last_name, first_name`;
    }

    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(formatMember));
  } finally {
    db.close();
  }
});

// ── GET /api/team-members/:id ──────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare('SELECT * FROM team_members WHERE member_id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Member not found' });
    res.json(formatMember(row));
  } finally {
    db.close();
  }
});

// ── POST /api/team-members ─────────────────────────────────────────────────
router.post('/', (req, res) => {
  const db = getDb();
  try {
    const id = randomUUID();
    const { first_name, last_name, email, role_key, authority_key,
            registration_date, ce_done, ce_required, status, renewal_deadline,
            avatar_colour, notes } = req.body;

    if (!first_name || !last_name || !email || !role_key || !authority_key) {
      return res.status(400).json({ error: 'first_name, last_name, email, role_key and authority_key are required' });
    }

    db.prepare(`
      INSERT INTO team_members
        (member_id, first_name, last_name, email, role_key, authority_key,
         registration_date, ce_done, ce_required, status, renewal_deadline, avatar_colour, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, first_name, last_name, email, role_key, authority_key,
      registration_date || null,
      ce_done || 0, ce_required || 0,
      status || 'on-track',
      renewal_deadline || null,
      avatar_colour || pickColour(email),
      notes || null
    );

    const created = db.prepare('SELECT * FROM team_members WHERE member_id = ?').get(id);
    res.status(201).json(formatMember(created));
  } finally {
    db.close();
  }
});

// ── PUT /api/team-members/:id ──────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT member_id FROM team_members WHERE member_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Member not found' });

    const fields = ['first_name','last_name','email','role_key','authority_key',
                    'registration_date','ce_done','ce_required','status',
                    'renewal_deadline','avatar_colour','notes'];
    const updates = [];
    const values  = [];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    updates.push('updated_at = datetime(\'now\')');
    values.push(req.params.id);

    db.prepare(`UPDATE team_members SET ${updates.join(', ')} WHERE member_id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM team_members WHERE member_id = ?').get(req.params.id);
    res.json(formatMember(updated));
  } finally {
    db.close();
  }
});

// ── DELETE /api/team-members/:id ───────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT member_id FROM team_members WHERE member_id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Member not found' });
    db.prepare('DELETE FROM team_members WHERE member_id = ?').run(req.params.id);
    res.json({ deleted: true, member_id: req.params.id });
  } finally {
    db.close();
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
const COLOURS = ['#5b6ee1','#2e7d52','#d97706','#00A8A8','#0891b2','#be185d','#15803d','#b45309'];

function pickColour(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLOURS[h % COLOURS.length];
}

function formatMember(row) {
  return {
    ...row,
    name: `${row.first_name} ${row.last_name}`,
  };
}

module.exports = router;
