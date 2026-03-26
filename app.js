'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./database/db');

// Boot local SQLite only (Turso connects on first query)
if (!process.env.TURSO_URL) {
  const { initDb } = require('./database/init');
  initDb();
}

const app = express();
app.use(cors());
app.use(express.json());

// ── Serve static files (local dev; Netlify CDN handles this in production) ──
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname)));
}

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api/authorities',   require('./api/authorities'));
app.use('/api/rules',         require('./api/rules'));
app.use('/api/roles',         require('./api/roles'));
app.use('/api/practitioners', require('./api/practitioners'));
app.use('/api/cycles',        require('./api/cycles'));
app.use('/api/activities',    require('./api/activities'));
app.use('/api/pdp-goals',     require('./api/pdp-goals'));
app.use('/api/team-members',  require('./api/team-members'));

// ── Admin stats ───────────────────────────────────────────────────────────
app.get('/api/admin/stats', async (req, res) => {
  try {
    const tables = [
      'countries','registration_authorities','professional_roles',
      'cpd_requirement_rules','mandatory_topic_rules',
      'practitioners','registrations','cpd_cycles','cpd_activities','pdp_goals',
    ];
    const stats = {};
    await Promise.all(tables.map(async t => {
      try {
        const row = await db.queryOne(`SELECT COUNT(*) as n FROM "${t}"`);
        stats[t] = row ? row.n : 0;
      } catch { stats[t] = 0; }
    }));
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Fallback (local dev only — Netlify handles routing for prod) ──────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

module.exports = app;
