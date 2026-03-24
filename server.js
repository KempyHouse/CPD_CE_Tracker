'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database/init');

// ── Boot database ──────────────────────────────────────────────────────────
initDb();

const app = express();
app.use(cors());
app.use(express.json());

// ── Serve static files ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/authorities',    require('./api/authorities'));
app.use('/api/rules',          require('./api/rules'));
app.use('/api/practitioners',  require('./api/practitioners'));
app.use('/api/cycles',         require('./api/cycles'));
app.use('/api/activities',     require('./api/activities'));
app.use('/api/pdp-goals',      require('./api/pdp-goals'));
app.use('/api/team-members',   require('./api/team-members'));

// ── Admin stats endpoint ───────────────────────────────────────────────────
app.get('/api/admin/stats', (req, res) => {
  const { getDb } = require('./database/init');
  const db = getDb();
  try {
    const tables = ['countries','registration_authorities','professional_roles','cpd_requirement_rules',
      'mandatory_topic_rules','practitioners','registrations','cpd_cycles','cpd_activities','pdp_goals'];
    const stats = {};
    tables.forEach(t => { try { stats[t] = db.prepare(`SELECT COUNT(*) as n FROM "${t}"`).get().n; } catch(e) { stats[t] = 0; } });
    res.json(stats);
  } finally { db.close(); }
});

// Fallback — serve index.html for any non-API, non-static route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] CPD/CE Tracker running at http://localhost:${PORT}`);
});
