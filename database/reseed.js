/**
 * Force re-seed: wipes all existing seed data (in FK-safe order) then re-seeds.
 * Run with: node database/reseed.js
 */
'use strict';
const { initDb, getDb } = require('./init');
const { randomUUID: uuidv4 } = require('crypto');
const seed = require('./seed-data');

const db = getDb();
db.pragma('foreign_keys = ON');

// Wipe in dependency order
db.exec(`
  DELETE FROM mandatory_topic_rules;
  DELETE FROM cpd_activities;
  DELETE FROM pdp_goals;
  DELETE FROM cpd_cycles;
  DELETE FROM registrations;
  DELETE FROM practitioners;
  DELETE FROM cpd_requirement_rules;
  DELETE FROM mandatory_topic_rules;
  DELETE FROM professional_roles;
  DELETE FROM registration_authorities;
  DELETE FROM countries;
`);
db.close();
console.log('[reseed] All seed tables cleared.');

// Now run the normal init which will re-seed from scratch
initDb();
console.log('[reseed] Done.');
