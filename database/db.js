'use strict';
/**
 * database/db.js — Dual-mode async database adapter
 *
 * When TURSO_URL is set (production/Netlify): uses @libsql/client
 * When not set (local dev): wraps better-sqlite3 in async shims
 *
 * Both paths export the same interface:
 *   query(sql, args)    → Promise<row[]>
 *   queryOne(sql, args) → Promise<row|null>
 *   run(sql, args)      → Promise<{changes, lastInsertRowid}>
 */

const USE_TURSO = !!process.env.TURSO_URL;

if (USE_TURSO) {
  const { createClient } = require('@libsql/client');

  const client = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  function toObjects(result) {
    return result.rows.map(row => {
      const obj = {};
      result.columns.forEach((col, i) => { obj[col] = row[i] ?? null; });
      return obj;
    });
  }

  module.exports = {
    async query(sql, args = []) {
      const result = await client.execute({ sql, args });
      return toObjects(result);
    },
    async queryOne(sql, args = []) {
      const result = await client.execute({ sql, args });
      if (!result.rows.length) return null;
      const obj = {};
      result.columns.forEach((col, i) => { obj[col] = result.rows[0][i] ?? null; });
      return obj;
    },
    async run(sql, args = []) {
      const result = await client.execute({ sql, args });
      return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
    },
    async batch(statements) {
      // statements = [{ sql, args }]
      return client.batch(statements.map(s => ({ sql: s.sql, args: s.args || [] })), 'write');
    },
  };

} else {
  // Local development: wrap better-sqlite3 synchronous API in Promises
  const { getDb } = require('./init');

  module.exports = {
    async query(sql, args = []) {
      const db = getDb();
      try { return db.prepare(sql).all(...args); }
      finally { db.close(); }
    },
    async queryOne(sql, args = []) {
      const db = getDb();
      try { return db.prepare(sql).get(...args) || null; }
      finally { db.close(); }
    },
    async run(sql, args = []) {
      const db = getDb();
      try { return db.prepare(sql).run(...args); }
      finally { db.close(); }
    },
    async batch(statements) {
      const db = getDb();
      try {
        const results = [];
        db.transaction(() => {
          for (const { sql, args = [] } of statements) {
            results.push(db.prepare(sql).run(...args));
          }
        })();
        return results;
      } finally { db.close(); }
    },
  };
}
