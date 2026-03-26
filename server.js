'use strict';
/**
 * server.js — Local development server
 * Uses better-sqlite3 (sync) via the db adapter when TURSO_URL is not set.
 * For production (Netlify), netlify/functions/api.js wraps app.js instead.
 */
const app  = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] CPD/CE Tracker running at http://localhost:${PORT}`);
});
