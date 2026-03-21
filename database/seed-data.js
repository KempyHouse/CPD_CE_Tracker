'use strict';
// ── All CPD authority seed data ──────────────────────────────────────────────
// This file is the single source of truth for all hardcoded CPD rules.
// It replaces the PRESETS / GDC_ROLE_REQUIREMENTS / ROLE_DEF constants
// that previously lived in widget-cpd.js.

const COUNTRIES = [
  { country_code: 'GB', country_name: 'United Kingdom' },
  { country_code: 'US', country_name: 'United States of America' },
  { country_code: 'AU', country_name: 'Australia' },
  { country_code: 'IE', country_name: 'Ireland' },
  { country_code: 'NZ', country_name: 'New Zealand' },
  { country_code: 'ZA', country_name: 'South Africa' },
  { country_code: 'CA', country_name: 'Canada' },
  { country_code: 'IN', country_name: 'India' },
];

// key = short slug used internally; maps to authority_abbreviation
const AUTHORITIES = [
  {
    key: 'uk_rcvs', name: 'Royal College of Veterinary Surgeons', abbr: 'RCVS',
    country: 'GB', sector: 'veterinary', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Structured / Non-structured', mandatory_topics_enabled: true,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.rcvs.org.uk', cpd_platform_url: 'https://www.rcvs.org.uk/1cpd',
  },
  {
    key: 'uk_gdc', name: 'General Dental Council', abbr: 'GDC',
    country: 'GB', sector: 'dental', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Verifiable / Non-verifiable', mandatory_topics_enabled: true,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.gdc-uk.org', cpd_platform_url: 'https://ecpd.gdc-uk.org',
  },
  {
    key: 'us_avma', name: 'American Veterinary Medical Association', abbr: 'AVMA',
    country: 'US', sector: 'veterinary', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Category 1 / Category 2', mandatory_topics_enabled: true,
    cpd_term: 'CE', cpd_term_full: 'Continuing Education',
    uses_hours: true, website_url: 'https://www.avma.org',
  },
  {
    key: 'us_nbdhe', name: 'National Board Dental Hygiene Examination', abbr: 'NBDHE',
    country: 'US', sector: 'dental', unit_label: 'CEUs', units_per_hour: 1.0,
    split_label: 'Clinical / Non-clinical', mandatory_topics_enabled: true,
    cpd_term: 'CE', cpd_term_full: 'Continuing Education',
    uses_ceus: true, website_url: 'https://www.adha.org',
  },
  {
    key: 'au_ahpra_vet', name: 'Australian Health Practitioner Regulation Agency (Veterinary)', abbr: 'AHPRA',
    country: 'AU', sector: 'veterinary', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Structured / Non-structured', mandatory_topics_enabled: false,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.veterinaryboard.gov.au',
  },
  {
    key: 'au_ahpra_dental', name: 'Australian Health Practitioner Regulation Agency (Dental)', abbr: 'AHPRA',
    country: 'AU', sector: 'dental', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Verifiable / Non-verifiable', mandatory_topics_enabled: false,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.dentalboard.gov.au',
  },
  {
    key: 'ie_vci', name: 'Veterinary Council of Ireland', abbr: 'VCI',
    country: 'IE', sector: 'veterinary', unit_label: 'credits', units_per_hour: 1.0,
    split_label: 'Category A / Category B', mandatory_topics_enabled: true,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_credits: true, website_url: 'https://www.vci.ie',
  },
  {
    key: 'ie_dci', name: 'Dental Council of Ireland', abbr: 'DCI',
    country: 'IE', sector: 'dental', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Verifiable / Non-verifiable', mandatory_topics_enabled: true,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.dentalcouncil.ie',
  },
  {
    key: 'nz_vcnz', name: 'Veterinary Council of New Zealand', abbr: 'VCNZ',
    country: 'NZ', sector: 'veterinary', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Directed / Self-directed', mandatory_topics_enabled: false,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.vetcouncil.org.nz',
  },
  {
    key: 'nz_dcnz', name: 'Dental Council of New Zealand', abbr: 'DCNZ',
    country: 'NZ', sector: 'dental', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Directed / Self-directed', mandatory_topics_enabled: false,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.dcnz.org.nz',
  },
  {
    key: 'za_savc', name: 'South African Veterinary Council', abbr: 'SAVC',
    country: 'ZA', sector: 'veterinary', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Category A / Category B', mandatory_topics_enabled: true,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.savc.org.za',
  },
  {
    key: 'ca_cvma', name: 'Canadian Veterinary Medical Association', abbr: 'CVMA',
    country: 'CA', sector: 'veterinary', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Formal / Informal', mandatory_topics_enabled: false,
    cpd_term: 'CE/CPD', cpd_term_full: 'Continuing Education / Continuing Professional Development',
    uses_hours: true, website_url: 'https://www.canadianveterinarians.net',
  },
  {
    key: 'in_vci_india', name: 'Veterinary Council of India', abbr: 'VCI',
    country: 'IN', sector: 'veterinary', unit_label: 'hours', units_per_hour: 1.0,
    split_label: 'Formal / Informal', mandatory_topics_enabled: false,
    cpd_term: 'CPD', cpd_term_full: 'Continuing Professional Development',
    uses_hours: true, website_url: 'https://vci.nic.in',
  },
];

// key = role slug; authority_key links to AUTHORITIES[].key
const ROLES = [
  // ── Veterinary ────────────────────────────────────────────────
  { key: 'vet_surgeon',        authority_key: 'uk_rcvs',        name: 'Veterinary Surgeon',                abbr: 'MRCVS', sector: 'veterinary', tier: 'generalist',             is_statutorily_registered: true },
  { key: 'rvn',                authority_key: 'uk_rcvs',        name: 'Registered Veterinary Nurse',       abbr: 'RVN',   sector: 'veterinary', tier: 'nurse',                  is_statutorily_registered: true },
  { key: 'vet_surgeon_avma',   authority_key: 'us_avma',        name: 'Veterinarian',                      abbr: 'DVM',   sector: 'veterinary', tier: 'generalist',             is_statutorily_registered: true },
  { key: 'vet_tech_avma',      authority_key: 'us_avma',        name: 'Veterinary Technician',             abbr: 'LVT',   sector: 'veterinary', tier: 'technician',             is_statutorily_registered: true },
  { key: 'vet_technologist',   authority_key: 'us_avma',        name: 'Veterinary Technologist',           abbr: 'VTS',   sector: 'veterinary', tier: 'technician',             is_statutorily_registered: true },
  { key: 'vet_student',        authority_key: 'uk_rcvs',        name: 'Veterinary Student',                abbr: null,    sector: 'veterinary', tier: 'new_graduate',           is_statutorily_registered: false },
  { key: 'vet_surgeon_au',     authority_key: 'au_ahpra_vet',   name: 'Veterinarian',                      abbr: 'BVSc', sector: 'veterinary', tier: 'generalist',              is_statutorily_registered: true },
  { key: 'vet_nurse_au',       authority_key: 'au_ahpra_vet',   name: 'Veterinary Nurse',                  abbr: null,   sector: 'veterinary', tier: 'nurse',                   is_statutorily_registered: true },
  { key: 'vet_tech_au',        authority_key: 'au_ahpra_vet',   name: 'Veterinary Technician',             abbr: null,   sector: 'veterinary', tier: 'technician',              is_statutorily_registered: true },
  { key: 'vet_paraprofessional', authority_key: 'au_ahpra_vet', name: 'Veterinary Paraprofessional',       abbr: null,   sector: 'veterinary', tier: 'paraprofessional',        is_statutorily_registered: false },
  { key: 'vet_surgeon_ie',     authority_key: 'ie_vci',         name: 'Veterinary Surgeon',                abbr: null,   sector: 'veterinary', tier: 'generalist',              is_statutorily_registered: true },
  { key: 'vet_nurse_ie',       authority_key: 'ie_vci',         name: 'Veterinary Nurse',                  abbr: null,   sector: 'veterinary', tier: 'nurse',                   is_statutorily_registered: true },
  { key: 'vet_surgeon_nz',     authority_key: 'nz_vcnz',        name: 'Veterinarian',                      abbr: null,   sector: 'veterinary', tier: 'generalist',              is_statutorily_registered: true },
  { key: 'vet_nurse_nz',       authority_key: 'nz_vcnz',        name: 'Veterinary Nurse',                  abbr: null,   sector: 'veterinary', tier: 'nurse',                   is_statutorily_registered: true },
  { key: 'vet_surgeon_za',     authority_key: 'za_savc',        name: 'Veterinarian',                      abbr: null,   sector: 'veterinary', tier: 'generalist',              is_statutorily_registered: true },
  { key: 'vet_nurse_za',       authority_key: 'za_savc',        name: 'Veterinary Nurse',                  abbr: null,   sector: 'veterinary', tier: 'nurse',                   is_statutorily_registered: true },
  { key: 'vet_surgeon_ca',     authority_key: 'ca_cvma',        name: 'Veterinarian',                      abbr: null,   sector: 'veterinary', tier: 'generalist',              is_statutorily_registered: true },
  { key: 'vet_tech_ca',        authority_key: 'ca_cvma',        name: 'Veterinary Technician',             abbr: null,   sector: 'veterinary', tier: 'technician',              is_statutorily_registered: true },
  { key: 'vet_technologist_ca',authority_key: 'ca_cvma',        name: 'Veterinary Technologist',           abbr: null,   sector: 'veterinary', tier: 'technician',              is_statutorily_registered: true },
  { key: 'vet_surgeon_in',     authority_key: 'in_vci_india',   name: 'Veterinary Surgeon',                abbr: null,   sector: 'veterinary', tier: 'generalist',              is_statutorily_registered: true },
  // ── Dental ───────────────────────────────────────────────────
  { key: 'dentist_gdc',          authority_key: 'uk_gdc',          name: 'Dentist',                   abbr: 'BDS',  sector: 'dental', tier: 'generalist',    is_statutorily_registered: true },
  { key: 'hygienist_gdc',        authority_key: 'uk_gdc',          name: 'Dental Hygienist',          abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'therapist_gdc',        authority_key: 'uk_gdc',          name: 'Dental Therapist',          abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'nurse_gdc',            authority_key: 'uk_gdc',          name: 'Dental Nurse',              abbr: null,   sector: 'dental', tier: 'nurse',         is_statutorily_registered: true },
  { key: 'technician_gdc',       authority_key: 'uk_gdc',          name: 'Dental Technician',         abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'oht_gdc',              authority_key: 'uk_gdc',          name: 'Oral Health Therapist',     abbr: 'OHT', sector: 'dental', tier: 'technician',     is_statutorily_registered: true },
  { key: 'ortho_therapist_gdc',  authority_key: 'uk_gdc',          name: 'Orthodontic Therapist',     abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'cdt_gdc',              authority_key: 'uk_gdc',          name: 'Clinical Dental Technician',abbr: 'CDT',  sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'hygienist_us',         authority_key: 'us_nbdhe',        name: 'Dental Hygienist',          abbr: 'RDH', sector: 'dental', tier: 'technician',     is_statutorily_registered: true },
  { key: 'dentist_au',           authority_key: 'au_ahpra_dental', name: 'Dentist',                   abbr: null,   sector: 'dental', tier: 'generalist',    is_statutorily_registered: true },
  { key: 'hygienist_au',         authority_key: 'au_ahpra_dental', name: 'Dental Hygienist',          abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'oht_au',               authority_key: 'au_ahpra_dental', name: 'Oral Health Therapist',     abbr: 'OHT', sector: 'dental', tier: 'technician',     is_statutorily_registered: true },
  { key: 'prosthetist_au',       authority_key: 'au_ahpra_dental', name: 'Dental Prosthetist',        abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'dentist_ie',           authority_key: 'ie_dci',          name: 'Dentist',                   abbr: null,   sector: 'dental', tier: 'generalist',    is_statutorily_registered: true },
  { key: 'hygienist_ie',         authority_key: 'ie_dci',          name: 'Dental Hygienist',          abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'nurse_ie',             authority_key: 'ie_dci',          name: 'Dental Nurse',              abbr: null,   sector: 'dental', tier: 'nurse',         is_statutorily_registered: true },
  { key: 'dentist_nz',           authority_key: 'nz_dcnz',         name: 'Dentist',                   abbr: null,   sector: 'dental', tier: 'generalist',    is_statutorily_registered: true },
  { key: 'hygienist_nz',         authority_key: 'nz_dcnz',         name: 'Dental Hygienist',          abbr: null,   sector: 'dental', tier: 'technician',    is_statutorily_registered: true },
  { key: 'oht_nz',               authority_key: 'nz_dcnz',         name: 'Oral Health Therapist',     abbr: 'OHT', sector: 'dental', tier: 'technician',     is_statutorily_registered: true },
];

// CPD requirement rules — one row per authority + role (primary role per authority shown)
// authority_key + role_key => links to AUTHORITIES and ROLES above
const RULES = [
  // ── UK RCVS — Vet Surgeon ────────────────────────────────────
  {
    authority_key: 'uk_rcvs', role_key: 'vet_surgeon',
    effective_from: '2021-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 35, annual_minimum_units: 35,
    min_structured_units: 20, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, carry_over_max_units: null,
    pause_allowed: true, pause_max_months: 6, pause_reduced_units: null,
    new_graduate_exemption: true, new_graduate_months: 12, new_graduate_reduced_units: 20,
    mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: true,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
    notes: 'RCVS annual CPD. Structured includes formal CPD with learning outcome. Non-structured is reflective/self-directed.',
  },
  // ── UK RCVS — RVN ───────────────────────────────────────────
  {
    authority_key: 'uk_rcvs', role_key: 'rvn',
    effective_from: '2021-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 35, annual_minimum_units: 35,
    min_structured_units: 20, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, carry_over_max_units: null,
    pause_allowed: true, pause_max_months: 6, pause_reduced_units: null,
    new_graduate_exemption: true, new_graduate_months: 12, new_graduate_reduced_units: 20,
    mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: true,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── UK GDC — Dentist ─────────────────────────────────────────
  {
    authority_key: 'uk_gdc', role_key: 'dentist_gdc',
    effective_from: '2023-01-01', cycle_type: '5_year', cycle_length_months: 60,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'fixed_date',
    total_units_required: 100, annual_minimum_units: null,
    min_structured_units: null, min_verifiable_units: 75,
    max_non_clinical_units: 25, max_non_clinical_percent: 25,
    carry_over_allowed: false, carry_over_max_units: null,
    pause_allowed: false, pause_max_months: null, pause_reduced_units: null,
    new_graduate_exemption: false, new_graduate_months: null, new_graduate_reduced_units: null,
    mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: 10, spread_rule_months: 24,
    notes: 'GDC Dentist Cycle 4: 1 Jan 2023 – 31 Dec 2027. Non-practising: 50 hrs required (25 verifiable). Spread rule: 10 hrs verifiable in any 24-month window.',
  },
  // ── UK GDC — Dental Hygienist (DCP cycle) ───────────────────
  {
    authority_key: 'uk_gdc', role_key: 'hygienist_gdc',
    effective_from: '2023-08-01', cycle_type: '5_year', cycle_length_months: 60,
    cycle_start_month: 8, cycle_start_day: 1, cycle_start_anchor: 'fixed_date',
    total_units_required: 75, annual_minimum_units: null,
    min_structured_units: null, min_verifiable_units: 50,
    max_non_clinical_units: 25, max_non_clinical_percent: 33,
    carry_over_allowed: false, carry_over_max_units: null,
    pause_allowed: false, pause_max_months: null, pause_reduced_units: null,
    new_graduate_exemption: false, new_graduate_months: null, new_graduate_reduced_units: null,
    mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: 10, spread_rule_months: 24,
    notes: 'GDC DCP Cycle 4: 1 Aug 2023 – 31 Jul 2028.',
  },
  // ── UK GDC — Dental Nurse (DCP cycle) ───────────────────────
  {
    authority_key: 'uk_gdc', role_key: 'nurse_gdc',
    effective_from: '2023-08-01', cycle_type: '5_year', cycle_length_months: 60,
    cycle_start_month: 8, cycle_start_day: 1, cycle_start_anchor: 'fixed_date',
    total_units_required: 50, annual_minimum_units: null,
    min_structured_units: null, min_verifiable_units: 35,
    max_non_clinical_units: 15, max_non_clinical_percent: 30,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: 10, spread_rule_months: 24,
  },
  // ── USA AVMA — Veterinarian ──────────────────────────────────
  {
    authority_key: 'us_avma', role_key: 'vet_surgeon_avma',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 30, annual_minimum_units: 30,
    min_structured_units: null, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: true, carry_over_max_units: 15,
    pause_allowed: false, new_graduate_exemption: false,
    mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
    notes: 'Varies by state board. 30 hrs is AVMA model. DEA holders require 3 hrs controlled substances.',
  },
  // ── USA NBDHE — Dental Hygienist ─────────────────────────────
  {
    authority_key: 'us_nbdhe', role_key: 'hygienist_us',
    effective_from: '2020-01-01', cycle_type: 'biennial', cycle_length_months: 24,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 25, annual_minimum_units: null,
    min_structured_units: null, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, pause_allowed: false, new_graduate_exemption: false,
    mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── Australia AHPRA — Veterinarian ──────────────────────────
  {
    authority_key: 'au_ahpra_vet', role_key: 'vet_surgeon_au',
    effective_from: '2020-01-01', cycle_type: 'triennial', cycle_length_months: 36,
    cycle_start_month: 12, cycle_start_day: 1, cycle_start_anchor: 'registration_anniversary',
    total_units_required: 60, annual_minimum_units: null,
    min_structured_units: 20, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: false,
    pro_rata_for_part_year: true, non_practising_exempt: false,
    postgrad_study_exempts: true, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── Australia AHPRA — Dental ─────────────────────────────────
  {
    authority_key: 'au_ahpra_dental', role_key: 'dentist_au',
    effective_from: '2020-01-01', cycle_type: 'triennial', cycle_length_months: 36,
    cycle_start_month: 12, cycle_start_day: 1, cycle_start_anchor: 'registration_anniversary',
    total_units_required: 60, annual_minimum_units: null,
    min_structured_units: 20, min_verifiable_units: null,
    max_non_clinical_units: 12, max_non_clinical_percent: 20,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: false,
    pro_rata_for_part_year: true, non_practising_exempt: false,
    postgrad_study_exempts: true, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── Ireland VCI — Vet Surgeon ────────────────────────────────
  {
    authority_key: 'ie_vci', role_key: 'vet_surgeon_ie',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 20, annual_minimum_units: 20,
    min_structured_units: 10, min_verifiable_units: null,
    max_non_clinical_units: 5, max_non_clinical_percent: 25,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: true,
    pro_rata_for_part_year: true, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
    notes: 'Credits — 1 credit = 1 hour. Wetlab/hands-on: 2 credits per contact hour.',
  },
  // ── Ireland DCI — Dentist ────────────────────────────────────
  {
    authority_key: 'ie_dci', role_key: 'dentist_ie',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 20, annual_minimum_units: 20,
    min_structured_units: 10, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: 10, spread_rule_months: 24,
  },
  // ── New Zealand VCNZ — Veterinarian ─────────────────────────
  {
    authority_key: 'nz_vcnz', role_key: 'vet_surgeon_nz',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 40, annual_minimum_units: 40,
    min_structured_units: null, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: false,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: true, deferral_allowed: true,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── New Zealand DCNZ — Dentist ───────────────────────────────
  {
    authority_key: 'nz_dcnz', role_key: 'dentist_nz',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 25, annual_minimum_units: 25,
    min_structured_units: null, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: false,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: true, deferral_allowed: true,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── South Africa SAVC — Veterinarian ────────────────────────
  {
    authority_key: 'za_savc', role_key: 'vet_surgeon_za',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 40, annual_minimum_units: 40,
    min_structured_units: 20, min_verifiable_units: null,
    max_non_clinical_units: 20, max_non_clinical_percent: 50,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: true,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: true,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── Canada CVMA — Veterinarian ───────────────────────────────
  {
    authority_key: 'ca_cvma', role_key: 'vet_surgeon_ca',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 40, annual_minimum_units: 40,
    min_structured_units: null, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: false,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
  },
  // ── India VCI — Veterinarian ─────────────────────────────────
  {
    authority_key: 'in_vci_india', role_key: 'vet_surgeon_in',
    effective_from: '2020-01-01', cycle_type: 'annual', cycle_length_months: 12,
    cycle_start_month: 1, cycle_start_day: 1, cycle_start_anchor: 'calendar',
    total_units_required: 30, annual_minimum_units: 30,
    min_structured_units: null, min_verifiable_units: null,
    max_non_clinical_units: null, max_non_clinical_percent: null,
    carry_over_allowed: false, pause_allowed: false,
    new_graduate_exemption: false, mandatory_topics_enabled: false,
    pro_rata_for_part_year: false, non_practising_exempt: false,
    postgrad_study_exempts: false, deferral_allowed: false,
    spread_rule_units: null, spread_rule_months: null,
  },
];

// Mandatory topic rules — linked to RULES by authority_key + role_key
const TOPIC_RULES = [
  // RCVS Vet Surgeon
  { authority_key: 'uk_rcvs', role_key: 'vet_surgeon', topic_name: 'Clinical skills development', topic_category: 'recommended', min_units_per_cycle: null, min_units_per_year: null, must_be_live: false, must_be_in_person: false, applies_if_holds_dea: false, applies_if_prescriber: false },
  { authority_key: 'uk_rcvs', role_key: 'vet_surgeon', topic_name: 'Practice management & professional skills', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  { authority_key: 'uk_rcvs', role_key: 'vet_surgeon', topic_name: 'Animal health & welfare', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  // GDC Dentist
  { authority_key: 'uk_gdc', role_key: 'dentist_gdc', topic_name: 'Medical emergencies', topic_category: 'mandatory', min_units_per_cycle: 10, min_units_per_year: 2, must_be_live: true, must_be_in_person: true, applies_if_holds_dea: false, applies_if_prescriber: false },
  { authority_key: 'uk_gdc', role_key: 'dentist_gdc', topic_name: 'Disinfection & decontamination', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  { authority_key: 'uk_gdc', role_key: 'dentist_gdc', topic_name: 'Radiography & radiation protection', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false, applies_if_does_radiography: true },
  { authority_key: 'uk_gdc', role_key: 'dentist_gdc', topic_name: 'Safeguarding adults & children', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  { authority_key: 'uk_gdc', role_key: 'dentist_gdc', topic_name: 'Oral cancer early detection', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  // GDC Dental Hygienist
  { authority_key: 'uk_gdc', role_key: 'hygienist_gdc', topic_name: 'Medical emergencies', topic_category: 'mandatory', min_units_per_cycle: 10, min_units_per_year: 2, must_be_live: true, must_be_in_person: true },
  { authority_key: 'uk_gdc', role_key: 'hygienist_gdc', topic_name: 'Disinfection & decontamination', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  { authority_key: 'uk_gdc', role_key: 'hygienist_gdc', topic_name: 'Safeguarding adults & children', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  // GDC Dental Nurse
  { authority_key: 'uk_gdc', role_key: 'nurse_gdc', topic_name: 'Medical emergencies', topic_category: 'mandatory', min_units_per_cycle: 10, min_units_per_year: 2, must_be_live: true, must_be_in_person: true },
  { authority_key: 'uk_gdc', role_key: 'nurse_gdc', topic_name: 'Disinfection & decontamination', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  { authority_key: 'uk_gdc', role_key: 'nurse_gdc', topic_name: 'Safeguarding adults & children', topic_category: 'recommended', min_units_per_cycle: null, must_be_live: false, must_be_in_person: false },
  // US AVMA
  { authority_key: 'us_avma', role_key: 'vet_surgeon_avma', topic_name: 'Controlled substances (DEA)', topic_category: 'mandatory', min_units_per_cycle: 3, min_units_per_year: null, must_be_live: false, must_be_in_person: false, applies_if_holds_dea: true },
  { authority_key: 'us_avma', role_key: 'vet_surgeon_avma', topic_name: 'Opioid prescribing', topic_category: 'mandatory', min_units_per_cycle: 2, min_units_per_year: null, must_be_live: false, must_be_in_person: false, applies_if_prescriber: true },
  // US NBDHE
  { authority_key: 'us_nbdhe', role_key: 'hygienist_us', topic_name: 'Infection control', topic_category: 'mandatory', min_units_per_cycle: 2, must_be_live: false, must_be_in_person: false },
  { authority_key: 'us_nbdhe', role_key: 'hygienist_us', topic_name: 'Medical emergencies', topic_category: 'mandatory', min_units_per_cycle: 2, must_be_live: true, must_be_in_person: true },
  // Ireland VCI
  { authority_key: 'ie_vci', role_key: 'vet_surgeon_ie', topic_name: 'Clinical topics', topic_category: 'mandatory', min_units_per_cycle: 10, must_be_live: false, must_be_in_person: false },
  { authority_key: 'ie_vci', role_key: 'vet_surgeon_ie', topic_name: 'Management & professional development', topic_category: 'capped', min_units_per_cycle: null, max_units_per_cycle: 5, max_percent_of_total: 25, must_be_live: false, must_be_in_person: false },
];

// Demo practitioner (seeded for the widget demo)
const DEMO_PRACTITIONER = {
  first_name: 'Andrew', last_name: 'Kemp',
  email: 'andrew.kemp@vetstream.com',
  country_of_practice: 'GB',
};

// Demo registration settings (authority_key + role_key reference, resolved at seed time)
const DEMO_REGISTRATION = {
  authority_key: 'uk_rcvs', role_key: 'vet_surgeon',
  registration_number: 'RCVS-2020-001234',
  registration_date: '2020-09-01',
  registration_status: 'active',
  is_new_graduate: false,
  holds_dea_registration: false,
  holds_prescribing_rights: false,
  practice_type: 'clinical',
  fte_percentage: 100,
  active_from: '2020-09-01',
};

// Demo active cycle
const DEMO_CYCLE = {
  cycle_number: 5,
  cycle_start_date: '2026-01-01',
  cycle_end_date: '2026-12-31',
  units_required: 35,
  min_structured_required: 20,
  min_verifiable_required: null,
  max_non_clinical_allowed: null,
  units_completed: 20,
  structured_completed: 12,
  verifiable_completed: 0,
  non_clinical_completed: 0,
  mandatory_topics_met: false,
  spread_rule_met: null,
  status: 'in_progress',
  is_paused: false,
};

// Demo settings (mirrors the widgetConfig learner preferences)
const DEMO_SETTINGS = {
  displayUnitPreference: 'hours',
  showTopicsPanel: true,
  showCycleStrip: true,
  compactMode: false,
};

module.exports = {
  COUNTRIES, AUTHORITIES, ROLES, RULES, TOPIC_RULES,
  DEMO_PRACTITIONER, DEMO_REGISTRATION, DEMO_CYCLE, DEMO_SETTINGS,
};
