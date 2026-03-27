'use strict';
/**
 * Seed CE rules for the 16 roles that currently have 0 rules.
 * Sources: GDC cpd.gdc-uk.org, DCI dentalcouncil.ie, CVMA cvma-acmv.org,
 *          Alabama BDEA, CT DPH, Delaware BDDHD.
 */
const { randomUUID } = require('crypto');
const db = require('./init').getDb();

const now = new Date().toISOString().slice(0, 10);

// Helper: insert one rule if role+authority exists and has no active rule yet
function addRule(roleKey, authKey, rule) {
  const a = db.prepare(
    'SELECT authority_id, unit_label FROM registration_authorities WHERE authority_key=?'
  ).get(authKey);
  if (!a) { console.log(`  SKIP — auth not found: ${authKey}`); return; }

  const r = db.prepare(
    'SELECT role_id, role_name FROM professional_roles WHERE role_key=? AND authority_id=?'
  ).get(roleKey, a.authority_id);
  if (!r) { console.log(`  SKIP — role not found: ${roleKey} @ ${authKey}`); return; }

  const existing = db.prepare(
    'SELECT COUNT(*) as c FROM cpd_requirement_rules WHERE role_id=?'
  ).get(r.role_id);
  if (existing.c > 0) {
    console.log(`  SKIP — already has rule: ${r.role_name} (${authKey})`);
    return;
  }

  const id = randomUUID();
  const b = { ...rule };
  db.prepare(`
    INSERT INTO cpd_requirement_rules (
      rule_id, authority_id, role_id, effective_from,
      cycle_type, cycle_length_months,
      total_units_required, min_structured_units, annual_minimum_units,
      max_online_percent,
      reflection_required_for_compliance,
      pro_rata_for_part_year, new_graduate_exemption, non_practising_exempt,
      first_renewal_ce_exempt, mandatory_topics_enabled,
      carry_over_allowed, pause_allowed,
      regime_type, approval_standard, notes
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `).run(
    id, a.authority_id, r.role_id, b.effective_from || '2020-01-01',
    b.cycle_type || 'annual', b.cycle_length_months || 12,
    b.total_units_required ?? 0,
    b.min_structured_units ?? null,
    b.annual_minimum_units ?? null,
    b.max_online_percent ?? null,
    b.reflection_required_for_compliance ? 1 : 0,
    b.pro_rata_for_part_year ? 1 : 0,
    b.new_graduate_exemption ? 1 : 0,
    b.non_practising_exempt ? 1 : 0,
    b.first_renewal_ce_exempt ? 1 : 0,
    b.mandatory_topics_enabled ? 1 : 0,
    b.carry_over_allowed ? 1 : 0,
    b.pause_allowed ? 1 : 0,
    b.regime_type || 'UK_HOURS_BASED',
    b.approval_standard || 'NATIONAL_BOARD',
    b.notes || null
  );
  console.log(`  ✓ Added rule: ${r.role_name} (${authKey}) — ${b.total_units_required} ${a.unit_label}/${b.cycle_type}`);
}

console.log('\n=== Seeding CE rules for empty roles ===\n');

// ─── UK GDC — 5-year CPD cycle, reflection required, 75 hrs for non-dentist registrants ───
// Source: https://www.gdc-uk.org/education-cpd/cpd/cpd-requirements
const gdcAux = {
  cycle_type: '5_year', cycle_length_months: 60,
  total_units_required: 75, min_structured_units: null,
  reflection_required_for_compliance: true,
  pro_rata_for_part_year: true, new_graduate_exemption: false,
  non_practising_exempt: false, first_renewal_ce_exempt: false,
  effective_from: '2018-08-01',
  regime_type: 'UK_HOURS_BASED', approval_standard: 'NATIONAL_BOARD',
  notes: 'GDC non-dentist registrant CPD cycle: 75 hours per 5 years. Reflection required. Source: gdc-uk.org/cpd'
};
console.log('--- UK GDC ---');
addRule('cdt_gdc',           'uk_gdc', gdcAux); // Clinical Dental Technician
addRule('oht_gdc',           'uk_gdc', gdcAux); // Oral Health Therapist
addRule('ortho_therapist_gdc','uk_gdc', gdcAux); // Orthodontic Therapist
addRule('technician_gdc',    'uk_gdc', gdcAux); // Dental Technician
addRule('therapist_gdc',     'uk_gdc', { ...gdcAux }); // Dental Therapist

// Dental Nurse: 50 hours per 5 years (lower requirement per GDC)
addRule('nurse_gdc', 'uk_gdc', { ...gdcAux, total_units_required: 50,
  notes: 'GDC Dental Nurse CPD: 50 hours per 5 years. Reflection required. Source: gdc-uk.org/cpd' });

// ─── UK RCVS — Veterinary Student: 0 hours (not yet licensed) ───
console.log('\n--- UK RCVS ---');
addRule('vet_student', 'uk_rcvs', {
  cycle_type: 'annual', cycle_length_months: 12,
  total_units_required: 0,
  reflection_required_for_compliance: false,
  regime_type: 'UK_HOURS_BASED', approval_standard: 'NATIONAL_BOARD',
  notes: 'RCVS Veterinary Student: No CPD requirement while enrolled in qualifying programme.'
});

// ─── Ireland DCI — annual CPD for auxiliary dental registrants ───
// Source: https://www.dentalcouncil.ie/cpd
console.log('\n--- Ireland DCI ---');
const dciAnnual = {
  cycle_type: 'annual', cycle_length_months: 12,
  total_units_required: 20,
  pro_rata_for_part_year: true,
  regime_type: 'POINTS_BASED', approval_standard: 'NATIONAL_BOARD',
  notes: 'Dental Council of Ireland: 20 CPD hours per year. Source: dentalcouncil.ie/cpd'
};
addRule('hygienist_ie', 'ie_dci', dciAnnual); // Dental Hygienist
addRule('nurse_ie',     'ie_dci', { ...dciAnnual, total_units_required: 20,
  notes: 'Dental Council of Ireland: 20 CPD hours per year for Dental Nurses. Source: dentalcouncil.ie/cpd' });

// ─── Canada CVMA — Veterinary Technicians ───
// CVMA itself is a voluntary national association; provincial colleges set requirements.
// Using 16 CE per year as per OAVT/AAVT baseline consensus.
// Source: cvma-acmv.org + provincial college requirements
console.log('\n--- Canada CVMA ---');
const cvmaTech = {
  cycle_type: 'annual', cycle_length_months: 12,
  total_units_required: 16,
  pro_rata_for_part_year: true,
  regime_type: 'US_HOURS_BASED', approval_standard: 'NATIONAL_BOARD',
  notes: 'CVMA/provincial college baseline: 16 CE hours per year for registered veterinary technicians/technologists.'
};
addRule('vet_tech_ca',        'ca_cvma', cvmaTech);
addRule('vet_technologist_ca','ca_cvma', { ...cvmaTech, notes: 'CVMA/provincial college baseline: 16 CE hours per year for Veterinary Technologists.' });

// ─── US — Alabama BDEA ───
// Source: Alabama Board of Dental Examiners and Examiners
console.log('\n--- US Alabama BDEA ---');
addRule('dental_asst_al', 'us_al_bdea', {
  cycle_type: 'biennial', cycle_length_months: 24,
  total_units_required: 12,
  pro_rata_for_part_year: false, first_renewal_ce_exempt: true,
  regime_type: 'US_HOURS_BASED', approval_standard: 'RACE_OR_BOARD',
  notes: 'Alabama BDEA: 12 CE hours per 2-year renewal cycle for registered dental assistants. Source: dentalboard.alabama.gov'
});

// ─── US — Connecticut DPH Dental ───
// Source: CT DPH dental assistant practitioner regulations
console.log('\n--- US Connecticut DPH Dental ---');
const ctDa = {
  cycle_type: 'biennial', cycle_length_months: 24,
  total_units_required: 12,
  first_renewal_ce_exempt: true,
  regime_type: 'US_HOURS_BASED', approval_standard: 'RACE_OR_BOARD',
};
addRule('da_ct',   'us_ct_dph_dental', { ...ctDa, notes: 'CT DPH: 12 CE hours per 2-year renewal for Dental Assistants (radiography).' });
addRule('efda_ct', 'us_ct_dph_dental', { ...ctDa, notes: 'CT DPH: 12 CE hours per 2-year renewal for Expanded Function Dental Assistants.' });

// ─── US — Connecticut DPH Veterinary ───
console.log('\n--- US Connecticut DPH Vet ---');
addRule('cvt_ct', 'us_ct_dph_vet', {
  cycle_type: 'biennial', cycle_length_months: 24,
  total_units_required: 20,
  first_renewal_ce_exempt: true,
  regime_type: 'US_HOURS_BASED', approval_standard: 'RACE_OR_BOARD',
  notes: 'CT DPH: 20 CE hours per 2-year renewal for Certified Veterinary Technicians (CTVTA).'
});

// ─── US — Delaware BDDHD ───
// Source: Delaware Board of Dentistry and Dental Hygiene
console.log('\n--- US Delaware BDDHD ---');
addRule('commhdent_de', 'us_de_bddhd', {
  cycle_type: 'biennial', cycle_length_months: 24,
  total_units_required: 30,
  pro_rata_for_part_year: true, first_renewal_ce_exempt: false,
  regime_type: 'US_HOURS_BASED', approval_standard: 'RACE_OR_BOARD',
  notes: 'Delaware BDDHD: 30 CE hours per 2-year cycle for Community Health Dentists.'
});
addRule('denres_de', 'us_de_bddhd', {
  cycle_type: 'annual', cycle_length_months: 12,
  total_units_required: 15,
  pro_rata_for_part_year: true, first_renewal_ce_exempt: true,
  regime_type: 'US_HOURS_BASED', approval_standard: 'RACE_OR_BOARD',
  notes: 'Delaware BDDHD: Dental Residents (Limited licence) — 15 CE per year; first renewal exempt.'
});

db.close();
console.log('\n=== Done ===');
