'use strict';
/**
 * Seed demo team members.
 * Run: node database/seed-team-members.js
 * Safe to re-run: INSERT OR IGNORE
 */
const { getDb } = require('./init');
const { randomUUID } = require('crypto');

const MEMBERS = [
  { first_name:'Sarah',   last_name:'Mitchell',  email:'s.mitchell@clinic.com',  role_key:'vet_surgeon',    authority_key:'uk_rcvs',     ce_done:28,  ce_required:35,  status:'at-risk',  renewal_deadline:'31 Dec 2026', avatar_colour:'#5b6ee1' },
  { first_name:'James',   last_name:'Okafor',    email:'j.okafor@clinic.com',    role_key:'rvn',            authority_key:'uk_rcvs',     ce_done:35,  ce_required:35,  status:'complete', renewal_deadline:'31 Dec 2026', avatar_colour:'#2e7d52' },
  { first_name:'Emily',   last_name:'Chen',      email:'e.chen@clinic.com',      role_key:'dentist_uk',     authority_key:'uk_gdc',      ce_done:150, ce_required:150, status:'complete', renewal_deadline:'28 Jul 2026', avatar_colour:'#d97706' },
  { first_name:'Rajiv',   last_name:'Patel',     email:'r.patel@clinic.com',     role_key:'dh_uk',          authority_key:'uk_gdc',      ce_done:50,  ce_required:75,  status:'on-track', renewal_deadline:'28 Jul 2026', avatar_colour:'#7c3aed' },
  { first_name:'Fiona',   last_name:'Drummond',  email:'f.drummond@clinic.com',  role_key:'vet_surgeon_avma',authority_key:'us_avma',    ce_done:12,  ce_required:40,  status:'at-risk',  renewal_deadline:'30 Jun 2026', avatar_colour:'#0891b2' },
  { first_name:'Thomas',  last_name:'Berger',    email:'t.berger@clinic.com',    role_key:'rdh_de',         authority_key:'us_de_bddhd', ce_done:0,   ce_required:24,  status:'overdue',  renewal_deadline:'31 May 2026', avatar_colour:'#be185d' },
  { first_name:'Priya',   last_name:'Sharma',    email:'p.sharma@clinic.com',    role_key:'vt_de',          authority_key:'us_de_bvm',   ce_done:10,  ce_required:12,  status:'on-track', renewal_deadline:'31 Jul 2027', avatar_colour:'#15803d' },
  { first_name:'Conor',   last_name:'Walsh',     email:'c.walsh@clinic.com',     role_key:'dent_co',        authority_key:'us_co_cdb',   ce_done:30,  ce_required:30,  status:'complete', renewal_deadline:'28 Feb 2026', avatar_colour:'#b45309' },
  { first_name:'Mei',     last_name:'Lin',       email:'m.lin@clinic.com',       role_key:'vet_surgeon',    authority_key:'uk_rcvs',     ce_done:35,  ce_required:35,  status:'exempt',   renewal_deadline:'31 Dec 2026', avatar_colour:'#5b6ee1' },
  { first_name:'Alex',    last_name:'Johnson',   email:'a.johnson@clinic.com',   role_key:'rdh_ct',         authority_key:'us_ct_dph_dental', ce_done:4, ce_required:16, status:'at-risk', renewal_deadline:'Oct 2026',  avatar_colour:'#7c3aed' },
];

const db = getDb();
const insert = db.prepare(`
  INSERT OR IGNORE INTO team_members
    (member_id, first_name, last_name, email, role_key, authority_key,
     ce_done, ce_required, status, renewal_deadline, avatar_colour)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
`);

let count = 0;
for (const m of MEMBERS) {
  const r = insert.run(randomUUID(), m.first_name, m.last_name, m.email,
    m.role_key, m.authority_key, m.ce_done, m.ce_required,
    m.status, m.renewal_deadline, m.avatar_colour);
  if (r.changes) count++;
}
db.close();
console.log(`[seed-team-members] Inserted ${count} new members (${MEMBERS.length - count} already existed).`);
