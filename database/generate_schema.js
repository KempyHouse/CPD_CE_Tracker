/**
 * generate_schema.js
 * Generates the CPD/CE Tracker database schema as a formatted Excel workbook.
 * Run: node database/generate_schema.js
 */

const ExcelJS = require('exceljs');
const path = require('path');

const OUT = path.join(__dirname, 'CPD_CE_Tracker_Schema.xlsx');

// ── Colour palette ──────────────────────────────────────────────────────────
const COLOURS = {
  PK:      { fgColor: { argb: 'FFFFD700' } }, // Gold
  FK:      { fgColor: { argb: 'FF92D050' } }, // Green
  ENUM:    { fgColor: { argb: 'FFFFC000' } }, // Orange
  CALC:    { fgColor: { argb: 'FFD9D9D9' } }, // Grey
  BOOL:    { fgColor: { argb: 'FFDCE6F1' } }, // Light blue
  HEADER:  { fgColor: { argb: 'FF2D3C4E' } }, // Dark navy (brand)
  TAB_HDR: { fgColor: { argb: 'FF5C3FA3' } }, // Purple (brand)
  WHITE:   { fgColor: { argb: 'FFFFFFFF' } },
  NONE:    { fgColor: { argb: 'FFFFFFFF' } },
};

const FONT_HDR  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
const FONT_BODY = { size: 10, name: 'Calibri' };
const FONT_BOLD = { bold: true, size: 10, name: 'Calibri' };
const BORDER    = {
  top:    { style: 'thin', color: { argb: 'FFD9D9D9' } },
  left:   { style: 'thin', color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  right:  { style: 'thin', color: { argb: 'FFD9D9D9' } },
};

// ── Helper: add a formatted table sheet ─────────────────────────────────────
function addTableSheet(wb, sheetName, tableName, description, columns, rows) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Col widths
  ws.columns = [
    { key: 'field',    width: 38 },
    { key: 'type',     width: 22 },
    { key: 'keytype',  width: 10 },
    { key: 'nullable', width: 10 },
    { key: 'desc',     width: 70 },
  ];

  // Row 1 — table title banner
  ws.mergeCells('A1:E1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${tableName}   |   ${description}`;
  titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', ...COLOURS.HEADER };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 24;

  // Row 2 — blank spacer
  ws.getRow(2).height = 4;

  // Row 3 — column headers
  const hdrRow = ws.getRow(3);
  hdrRow.height = 18;
  ['Field Name', 'Data Type', 'Key', 'Nullable', 'Description'].forEach((h, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = h;
    cell.font = FONT_HDR;
    cell.fill = { type: 'pattern', pattern: 'solid', ...COLOURS.TAB_HDR };
    cell.border = BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  });

  // Data rows
  rows.forEach((r, idx) => {
    const row = ws.addRow(r);
    row.height = 16;
    const keyType = r[2]; // PK, FK, ENUM, CALC, BOOL, -
    let fill = COLOURS.NONE;
    if (keyType === 'PK')   fill = COLOURS.PK;
    if (keyType === 'FK')   fill = COLOURS.FK;
    if (keyType === 'ENUM') fill = COLOURS.ENUM;
    if (keyType === 'CALC') fill = COLOURS.CALC;
    if (keyType === 'BOOL') fill = COLOURS.BOOL;

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = colNum === 1 ? FONT_BOLD : FONT_BODY;
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', wrapText: colNum === 5, indent: 1 };
      if (colNum === 1 || colNum === 3) {
        cell.fill = { type: 'pattern', pattern: 'solid', ...fill };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', ...COLOURS.NONE };
      }
    });

    // Zebra stripe
    if (idx % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum !== 1 && colNum !== 3) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        }
      });
    }
  });

  // Auto-filter on headers
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 5 } };
}

// ── Field definitions ───────────────────────────────────────────────────────
// Format: [field_name, data_type, key_type, nullable, description]

const T_PRACTITIONERS = [
  ['practitioner_id',    'UUID',        'PK',   'No',  'Primary key — unique identifier for the practitioner'],
  ['first_name',         'VARCHAR',     '-',    'No',  "Practitioner's first/given name"],
  ['last_name',          'VARCHAR',     '-',    'No',  "Practitioner's last/family name"],
  ['email',              'VARCHAR',     'UNIQ', 'No',  'Unique email address (login identity)'],
  ['date_of_birth',      'DATE',        '-',    'Yes', 'Optional date of birth'],
  ['country_of_practice','CHAR(2)',     'FK',   'Yes', 'ISO 3166-1 alpha-2 country code → countries'],
  ['profile_photo_url',  'VARCHAR',     '-',    'Yes', 'URL to practitioner profile photo'],
  ['created_at',         'TIMESTAMPTZ', '-',    'No',  'Record creation timestamp (UTC)'],
  ['updated_at',         'TIMESTAMPTZ', '-',    'No',  'Record last updated timestamp (UTC)'],
];

const T_REGISTRATIONS = [
  ['registration_id',                   'UUID',        'PK',   'No',  'Primary key — unique registration record'],
  ['practitioner_id',                   'UUID',        'FK',   'No',  'FK → practitioners. A practitioner may have multiple registrations'],
  ['authority_id',                      'UUID',        'FK',   'No',  'FK → registration_authorities. The regulatory body for this registration'],
  ['role_id',                           'UUID',        'FK',   'No',  'FK → professional_roles. The role under which they are registered'],
  ['registration_number',               'VARCHAR',     '-',    'Yes', 'Official registration number issued by the authority'],
  ['registration_date',                 'DATE',        '-',    'Yes', 'Date first registered with this authority'],
  ['registration_status',               'ENUM',        'ENUM', 'No',  'active | non_practising | suspended | lapsed | student | temporary'],
  ['is_new_graduate',                   'BOOLEAN',     'BOOL', 'No',  'TRUE if in new graduate period — triggers reduced/different CPD rules'],
  ['new_graduate_start_date',           'DATE',        '-',    'Yes', 'Start of new graduate programme (if applicable)'],
  ['is_specialist',                     'BOOLEAN',     'BOOL', 'No',  'TRUE if registered as a specialist (e.g. RCVS Specialist, AHPRA Specialist)'],
  ['specialty_area',                    'VARCHAR',     '-',    'Yes', 'Specialist area e.g. orthopaedics, periodontics'],
  ['is_advanced_practitioner',          'BOOLEAN',     'BOOL', 'No',  'TRUE if holds Advanced Practitioner status (e.g. RCVS AP)'],
  ['advanced_practitioner_designation', 'VARCHAR',     '-',    'Yes', 'AP designation e.g. "dentistry in cats"'],
  ['is_dual_registered',                'BOOLEAN',     'BOOL', 'No',  'TRUE if dual-registered in same authority (e.g. AUS hygienist + therapist)'],
  ['holds_dea_registration',            'BOOLEAN',     'BOOL', 'No',  'USA only — TRUE triggers mandatory controlled substances CE'],
  ['holds_prescribing_rights',          'BOOLEAN',     'BOOL', 'No',  'TRUE if has prescribing rights — may trigger opioid/drug safety CE requirements'],
  ['practice_type',                     'ENUM',        'ENUM', 'No',  'clinical | non_clinical | educator | academic | government | industry'],
  ['fte_percentage',                    'INTEGER',     '-',    'Yes', '% of full-time equivalent (0-100). Used for pro-rata calculations in some jurisdictions'],
  ['active_from',                       'DATE',        '-',    'No',  'Date this registration became active'],
  ['active_to',                         'DATE',        '-',    'Yes', 'Date this registration ended (NULL = currently active)'],
  ['created_at',                        'TIMESTAMPTZ', '-',    'No',  'Record creation timestamp (UTC)'],
  ['updated_at',                        'TIMESTAMPTZ', '-',    'No',  'Record last updated timestamp (UTC)'],
];

const T_REG_AUTHORITIES = [
  ['authority_id',           'UUID',        'PK', 'No',  'Primary key'],
  ['authority_name',         'VARCHAR',     '-',  'No',  'Full official name e.g. "General Dental Council"'],
  ['authority_abbreviation', 'VARCHAR',     '-',  'No',  'Short code e.g. GDC, RCVS, HPCSA, DBA, VCI'],
  ['country',                'CHAR(2)',     'FK', 'No',  'ISO country code → countries'],
  ['region',                 'VARCHAR',     '-',  'Yes', 'Sub-national region if applicable e.g. "Ontario", "Western Australia"'],
  ['sector',                 'ENUM',        'ENUM','No', 'veterinary | dental | both'],
  ['website_url',            'VARCHAR',     '-',  'Yes', 'Official authority website'],
  ['cpd_platform_url',       'VARCHAR',     '-',  'Yes', 'CPD submission portal URL e.g. GDC eGDC, RCVS 1CPD'],
  ['uses_hours',             'BOOLEAN',     'BOOL','No', 'TRUE if this authority measures CPD in hours'],
  ['uses_points',            'BOOLEAN',     'BOOL','No', 'TRUE if this authority uses points'],
  ['uses_ceus',              'BOOLEAN',     'BOOL','No', 'TRUE if this authority uses CEUs (e.g. HPCSA)'],
  ['uses_credits',           'BOOLEAN',     'BOOL','No', 'TRUE if this authority uses credits (e.g. VCI Ireland)'],
  ['unit_label',             'VARCHAR',     '-',  'No',  'Display label for units e.g. "hours", "points", "CEUs", "credits"'],
  ['units_per_hour',         'DECIMAL(5,2)','-',  'No',  'Conversion factor: how many units = 1 hour (e.g. 1.0 for most; 2.0 for wetlabs in some authorities)'],
];

const T_PROFESSIONAL_ROLES = [
  ['role_id',           'UUID',    'PK',   'No',  'Primary key'],
  ['authority_id',      'UUID',    'FK',   'No',  'FK → registration_authorities. The authority that defines this role'],
  ['role_name',         'VARCHAR', '-',    'No',  'Full role name e.g. "Veterinary Surgeon", "Dental Nurse", "Oral Health Therapist"'],
  ['role_abbreviation', 'VARCHAR', '-',    'Yes', 'Short code e.g. DVM, RVN, RDN, DH, OHT'],
  ['sector',            'ENUM',    'ENUM', 'No',  'veterinary | dental | both'],
  ['tier',              'ENUM',    'ENUM', 'No',  'generalist | advanced_practitioner | specialist | paraprofessional | technician | nurse | assistant | new_graduate'],
];

const T_CPD_RULES = [
  ['rule_id',                  'UUID',        'PK',   'No',  'Primary key — one row per authority × role × effective period'],
  ['authority_id',             'UUID',        'FK',   'No',  'FK → registration_authorities'],
  ['role_id',                  'UUID',        'FK',   'No',  'FK → professional_roles'],
  ['effective_from',           'DATE',        '-',    'No',  'Date from which this rule set applies'],
  ['effective_to',             'DATE',        '-',    'Yes', 'Date rule was superseded. NULL = currently active'],
  ['cycle_type',               'ENUM',        'ENUM', 'No',  'annual | biennial | triennial | 4_year | 5_year | rolling_2 | rolling_3 | rolling_5'],
  ['cycle_length_months',      'INTEGER',     '-',    'No',  'Cycle duration in months e.g. 12, 24, 36, 60'],
  ['cycle_start_month',        'INTEGER',     '-',    'Yes', 'Month the cycle starts (1=Jan … 12=Dec). NULL if rolling'],
  ['cycle_start_day',          'INTEGER',     '-',    'Yes', 'Day of month the cycle starts'],
  ['cycle_start_anchor',       'ENUM',        'ENUM', 'No',  'calendar | registration_anniversary | fixed_date'],
  ['total_units_required',     'DECIMAL(8,2)','-',    'No',  'Total hours/points/CEUs required to complete the cycle'],
  ['annual_minimum_units',     'DECIMAL(8,2)','-',    'Yes', 'Minimum units required per year within the cycle (e.g. RCVS 35/yr)'],
  ['spread_rule_units',        'DECIMAL(8,2)','-',    'Yes', 'Minimum units required within any rolling window (e.g. GDC: 10 hrs in any 24 months)'],
  ['spread_rule_months',       'INTEGER',     '-',    'Yes', 'Length of the spread rule rolling window in months (e.g. 24)'],
  ['min_structured_units',     'DECIMAL(8,2)','-',    'Yes', 'Minimum structured CPD units per cycle (e.g. AUS 15 structured/3yr)'],
  ['min_verifiable_units',     'DECIMAL(8,2)','-',    'Yes', 'Minimum verifiable units per cycle (GDC: all 100 hrs must be verifiable)'],
  ['max_unstructured_units',   'DECIMAL(8,2)','-',    'Yes', 'Cap on unstructured/non-verifiable units that count toward the total'],
  ['max_non_clinical_units',   'DECIMAL(8,2)','-',    'Yes', 'Cap on non-clinical/non-scientific units (e.g. AUS 12 hrs/60 hr cycle)'],
  ['max_non_clinical_percent', 'DECIMAL(5,2)','-',    'Yes', 'Cap as % of total (e.g. DBA Australia 20%)'],
  ['carry_over_allowed',       'BOOLEAN',     'BOOL', 'No',  'TRUE if surplus units from the previous cycle may carry forward'],
  ['carry_over_max_units',     'DECIMAL(8,2)','-',    'Yes', 'Maximum units that can be carried over (if capped)'],
  ['pause_allowed',            'BOOLEAN',     'BOOL', 'No',  'TRUE if the cycle can be paused (e.g. RCVS allows 6-month pause)'],
  ['pause_max_months',         'INTEGER',     '-',    'Yes', 'Maximum number of months the cycle can be paused'],
  ['pause_reduced_units',      'DECIMAL(8,2)','-',    'Yes', 'Reduced units required during/after a pause period'],
  ['new_graduate_exemption',   'BOOLEAN',     'BOOL', 'No',  'TRUE if new graduates have reduced or waived requirements'],
  ['new_graduate_months',      'INTEGER',     '-',    'Yes', 'Duration in months that new graduate rules apply'],
  ['pro_rata_for_part_year',   'BOOLEAN',     'BOOL', 'No',  'TRUE if mid-year registrants get pro-rated requirements (e.g. AUS, Ireland)'],
  ['non_practising_exempt',    'BOOLEAN',     'BOOL', 'No',  'TRUE if non-practising registrants are exempt from CPD (e.g. RCVS non-practising register)'],
  ['postgrad_study_exempts',   'BOOLEAN',     'BOOL', 'No',  'TRUE if postgraduate study counts as equivalent to CPD (e.g. AUS, NZ)'],
  ['deferral_allowed',         'BOOLEAN',     'BOOL', 'No',  'TRUE if CPD cycle can be formally deferred (e.g. SAVC, VCNZ)'],
  ['notes',                    'TEXT',        '-',    'Yes', 'Free text for jurisdiction-specific edge cases not covered by other fields'],
  ['created_at',               'TIMESTAMPTZ', '-',    'No',  'Record creation timestamp'],
  ['updated_at',               'TIMESTAMPTZ', '-',    'No',  'Record last updated timestamp'],
];

const T_MANDATORY_TOPICS = [
  ['topic_rule_id',              'UUID',        'PK',   'No',  'Primary key'],
  ['rule_id',                    'UUID',        'FK',   'No',  'FK → cpd_requirement_rules. The rule this topic constraint is attached to'],
  ['topic_name',                 'VARCHAR',     '-',    'No',  'Topic name e.g. "Medical Emergencies", "Controlled Substances", "Ethics & Human Rights"'],
  ['topic_category',             'ENUM',        'ENUM', 'No',  'mandatory | recommended | capped'],
  ['min_units_per_cycle',        'DECIMAL(8,2)','-',    'Yes', 'Minimum units in this topic per full cycle (e.g. GDC: 10 hrs medical emergencies/5yr)'],
  ['min_units_per_year',         'DECIMAL(8,2)','-',    'Yes', 'Minimum units in this topic per year (e.g. GDC: 2 hrs medical emergencies/yr)'],
  ['max_units_per_cycle',        'DECIMAL(8,2)','-',    'Yes', 'Maximum units in this topic that count toward the total (e.g. VCI: max 6 hrs independent study)'],
  ['max_units_per_year',         'DECIMAL(8,2)','-',    'Yes', 'Maximum units in this topic per year'],
  ['max_percent_of_total',       'DECIMAL(5,2)','-',    'Yes', 'Maximum % of total CPD this topic can represent (e.g. VCI: 25% management skills)'],
  ['must_be_live',               'BOOLEAN',     'BOOL', 'No',  'TRUE if must be delivered live (e.g. Georgia USA: 1 hr live professionalism)'],
  ['must_be_in_person',          'BOOLEAN',     'BOOL', 'No',  'TRUE if must be attended in person (e.g. CPR/BLS practical sessions)'],
  ['applies_if_holds_dea',       'BOOLEAN',     'BOOL', 'No',  'TRUE if this topic rule only applies when practitioner holds DEA registration (USA)'],
  ['applies_if_prescriber',      'BOOLEAN',     'BOOL', 'No',  'TRUE if this topic rule only applies if practitioner has prescribing rights (e.g. opioid training)'],
  ['applies_if_does_radiography','BOOLEAN',     'BOOL', 'No',  'TRUE if this topic rule only applies if practitioner performs radiography (e.g. GDC)'],
  ['notes',                      'TEXT',        '-',    'Yes', 'Free text notes on this topic requirement'],
  ['created_at',                 'TIMESTAMPTZ', '-',    'No',  'Record creation timestamp'],
];

const T_CPD_CYCLES = [
  ['cycle_id',                 'UUID',        'PK',   'No',  'Primary key — one row per cycle instance per registration'],
  ['registration_id',          'UUID',        'FK',   'No',  'FK → registrations'],
  ['rule_id',                  'UUID',        'FK',   'No',  'FK → cpd_requirement_rules. The rule that governs this cycle'],
  ['cycle_number',             'INTEGER',     '-',    'No',  'Sequential cycle number (1, 2, 3…). Used for SAVC phase-in graduated requirements'],
  ['cycle_start_date',         'DATE',        '-',    'No',  'First day of this CPD cycle'],
  ['cycle_end_date',           'DATE',        '-',    'No',  'Last day of this CPD cycle'],
  ['units_required',           'DECIMAL(8,2)','-',    'No',  'Units required for this cycle — may differ from rule if pro-rated for part-year registration'],
  ['min_structured_required',  'DECIMAL(8,2)','-',    'Yes', 'Minimum structured units required for this specific cycle'],
  ['min_verifiable_required',  'DECIMAL(8,2)','-',    'Yes', 'Minimum verifiable units required for this specific cycle'],
  ['max_non_clinical_allowed', 'DECIMAL(8,2)','-',    'Yes', 'Maximum non-clinical units that count in this cycle'],
  ['units_completed',          'DECIMAL(8,2)','-',    'No',  'CALCULATED: total units completed, summed from approved cpd_activities'],
  ['structured_completed',     'DECIMAL(8,2)','-',    'No',  'CALCULATED: structured units completed'],
  ['verifiable_completed',     'DECIMAL(8,2)','-',    'No',  'CALCULATED: verifiable units completed'],
  ['non_clinical_completed',   'DECIMAL(8,2)','-',    'No',  'CALCULATED: non-clinical units completed'],
  ['mandatory_topics_met',     'BOOLEAN',     'BOOL', 'No',  'CALCULATED: TRUE if all mandatory topic minimums have been reached'],
  ['spread_rule_met',          'BOOLEAN',     'BOOL', 'Yes', 'CALCULATED: TRUE if spread rule is satisfied (e.g. GDC 10 hrs in any 24-month window). NULL if not applicable'],
  ['status',                   'ENUM',        'ENUM', 'No',  'in_progress | complete | non_compliant | deferred | paused | exempt'],
  ['is_paused',                'BOOLEAN',     'BOOL', 'No',  'TRUE if cycle is currently paused'],
  ['pause_start_date',         'DATE',        '-',    'Yes', 'Date the pause began'],
  ['pause_end_date',           'DATE',        '-',    'Yes', 'Date the pause ended (NULL if still paused)'],
  ['audit_selected',           'BOOLEAN',     'BOOL', 'No',  'TRUE if this cycle has been randomly selected for audit by the authority'],
  ['audit_submitted_date',     'DATE',        '-',    'Yes', 'Date audit evidence was submitted'],
  ['notes',                    'TEXT',        '-',    'Yes', 'Admin/edge-case notes'],
  ['created_at',               'TIMESTAMPTZ', '-',    'No',  'Record creation timestamp'],
  ['updated_at',               'TIMESTAMPTZ', '-',    'No',  'Record last updated timestamp'],
];

const T_CPD_ACTIVITIES = [
  ['activity_id',            'UUID',        'PK',   'No',  'Primary key'],
  ['registration_id',        'UUID',        'FK',   'No',  'FK → registrations'],
  ['cycle_id',               'UUID',        'FK',   'No',  'FK → cpd_cycles. The cycle this activity is logged against'],
  ['activity_title',         'VARCHAR',     '-',    'No',  'Title of the CPD activity'],
  ['activity_description',   'TEXT',        '-',    'Yes', 'Detailed description of the activity'],
  ['activity_date',          'DATE',        '-',    'No',  'Date the activity was undertaken'],
  ['provider_name',          'VARCHAR',     '-',    'Yes', 'Provider/organiser name e.g. BSAVA, Agilio, VetCEE'],
  ['provider_accreditation', 'VARCHAR',     '-',    'Yes', 'Provider accreditation code e.g. RACE, SAVC-accredited, GDC approved, RCDSO'],
  ['activity_type',          'ENUM',        'ENUM', 'No',  'conference_session | workshop | wetlab | seminar | webinar_live | webinar_recorded | online_course | self_directed_reading | journal_article_with_assessment | peer_discussion | clinical_audit | case_discussion | in_house_training | mentoring_given | mentoring_received | postgraduate_study | publication_authored | presentation_given | exam_question_writing | practice_visit | external_examining | short_course | management_course | resuscitation_training | other'],
  ['delivery_format',        'ENUM',        'ENUM', 'No',  'in_person | online_live | online_self_paced | blended | reading | podcast | peer_discussion | wetlab | conference | publication | postgraduate_study'],
  ['topic_category',         'VARCHAR',     '-',    'Yes', 'Topic area — links to mandatory_topic_rules.topic_name for compliance mapping'],
  ['is_clinical',            'BOOLEAN',     'BOOL', 'No',  'TRUE if clinical/scientific content; FALSE if management/non-clinical. Affects non-clinical caps'],
  ['is_verifiable',          'BOOLEAN',     'BOOL', 'No',  'TRUE if activity meets GDC definition of verifiable CPD (external evidence available)'],
  ['is_structured',          'BOOLEAN',     'BOOL', 'No',  'TRUE if activity meets AUS/NZ definition of structured CPD'],
  ['is_accredited',          'BOOLEAN',     'BOOL', 'No',  'TRUE if formally accredited by the relevant authority'],
  ['accreditation_number',   'VARCHAR',     '-',    'Yes', 'Accreditation reference number if applicable'],
  ['units_claimed',          'DECIMAL(8,2)','-',    'No',  'Units claimed by the practitioner (hours/points/CEUs as per authority)'],
  ['units_awarded',          'DECIMAL(8,2)','-',    'Yes', 'Units actually awarded after applying caps or rules. NULL = same as claimed'],
  ['units_multiplier',       'DECIMAL(4,2)','-',    'No',  'Multiplier applied to units (e.g. 2.0 for VCI wetlabs). Default 1.0'],
  ['certificates_url',       'VARCHAR',     '-',    'Yes', 'URL to uploaded certificate of attendance/completion'],
  ['evidence_document_url',  'VARCHAR',     '-',    'Yes', 'URL to any additional supporting evidence document'],
  ['reflection_text',        'TEXT',        '-',    'Yes', 'Practitioner reflection on learning outcome — required by RCVS 1CPD, GDC eCPD, DCNZ'],
  ['reflection_date',        'DATE',        '-',    'Yes', 'Date reflection was written'],
  ['peer_discussed',         'BOOLEAN',     'BOOL', 'No',  'TRUE if discussed with a peer — satisfies NZ DCNZ peer interaction requirement'],
  ['peer_name',              'VARCHAR',     '-',    'Yes', 'Name of peer the activity was discussed with'],
  ['pdp_goal_linked',        'UUID',        'FK',   'Yes', 'FK → pdp_goals. Optional link to the PDP goal this activity contributes to'],
  ['is_presenter',           'BOOLEAN',     'BOOL', 'No',  'TRUE if practitioner was the presenter/speaker (claiming presenter credit)'],
  ['is_author',              'BOOLEAN',     'BOOL', 'No',  'TRUE if practitioner is the author of a publication (claiming author credit)'],
  ['publication_doi',        'VARCHAR',     '-',    'Yes', 'DOI of the published article if applicable'],
  ['postgrad_year',          'INTEGER',     '-',    'Yes', 'Year of postgraduate study programme (if activity_type = postgraduate_study)'],
  ['status',                 'ENUM',        'ENUM', 'No',  'draft | submitted | approved | rejected | queried'],
  ['created_at',             'TIMESTAMPTZ', '-',    'No',  'Record creation timestamp'],
  ['updated_at',             'TIMESTAMPTZ', '-',    'No',  'Record last updated timestamp'],
];

const T_PDP_GOALS = [
  ['goal_id',           'UUID',        'PK',   'No',  'Primary key'],
  ['registration_id',   'UUID',        'FK',   'No',  'FK → registrations'],
  ['cycle_id',          'UUID',        'FK',   'No',  'FK → cpd_cycles. The cycle this goal belongs to'],
  ['goal_title',        'VARCHAR',     '-',    'No',  'Short title for the development goal'],
  ['goal_description',  'TEXT',        '-',    'Yes', 'Full description of what the practitioner intends to achieve'],
  ['field_of_practice', 'VARCHAR',     '-',    'Yes', 'Area of practice this goal relates to'],
  ['target_date',       'DATE',        '-',    'Yes', 'Target completion date'],
  ['status',            'ENUM',        'ENUM', 'No',  'planned | in_progress | met | carried_forward'],
  ['created_at',        'TIMESTAMPTZ', '-',    'No',  'Record creation timestamp'],
  ['updated_at',        'TIMESTAMPTZ', '-',    'No',  'Record last updated timestamp'],
];

const T_COUNTRIES = [
  ['country_code',         'CHAR(2)', 'PK', 'No',  'ISO 3166-1 alpha-2 country code (e.g. GB, AU, US, ZA, IE, NZ)'],
  ['country_name',         'VARCHAR', '-',  'No',  'Full country name'],
  ['default_authority_id', 'UUID',    'FK', 'Yes', 'FK → registration_authorities. Primary regulatory body for this country (if single-authority). Nullable for multi-authority countries'],
];

const T_DERIVED = [
  ['units_remaining',             'CALCULATED', 'CALC', 'N/A', 'units_required − units_completed'],
  ['percent_complete',            'CALCULATED', 'CALC', 'N/A', '(units_completed / units_required) × 100'],
  ['days_remaining_in_cycle',     'CALCULATED', 'CALC', 'N/A', 'cycle_end_date − CURRENT_DATE'],
  ['projected_completion_date',   'CALCULATED', 'CALC', 'N/A', 'Based on rolling average rate of activity logging over the last 90 days'],
  ['structured_deficit',          'CALCULATED', 'CALC', 'N/A', 'min_structured_required − structured_completed. Negative = surplus'],
  ['verifiable_deficit',          'CALCULATED', 'CALC', 'N/A', 'min_verifiable_required − verifiable_completed. Negative = surplus'],
  ['mandatory_topic_deficits',    'CALCULATED', 'CALC', 'N/A', 'Per topic: min_units_per_cycle − completed in that topic. One value per mandatory topic'],
  ['non_clinical_headroom',       'CALCULATED', 'CALC', 'N/A', 'max_non_clinical_allowed − non_clinical_completed. How many more non-clinical units will count'],
  ['spread_rule_window_units',    'CALCULATED', 'CALC', 'N/A', 'SUM of units in the most recent rolling N-month window. Used for GDC 10-hrs/24-month spread check'],
  ['annual_minimum_met',          'CALCULATED', 'CALC', 'N/A', 'BOOLEAN per calendar year within the cycle. TRUE if annual_minimum_units reached for that year'],
  ['carry_over_available',        'CALCULATED', 'CALC', 'N/A', 'Surplus units from prior cycle available to carry forward (if carry_over_allowed = TRUE)'],
  ['pause_hours_saved',           'CALCULATED', 'CALC', 'N/A', 'Reduction in units required granted as a result of an approved pause period'],
  ['compliance_traffic_light',    'CALCULATED', 'CALC', 'N/A', 'green | amber | red — based on projected completion trajectory vs cycle end date'],
  ['activity_log_rate_per_month', 'CALCULATED', 'CALC', 'N/A', 'Average units logged per month over last 90 days — used for projected completion'],
  ['topic_completion_matrix',     'CALCULATED', 'CALC', 'N/A', 'Per-topic breakdown: required | completed | deficit | met (boolean) — powers the topic compliance panel'],
];

// ── Main workbook builder ────────────────────────────────────────────────────
async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CPD/CE Tracker';
  wb.created = new Date();

  // ── Sheet 0: Overview ───────────────────────────────────────────────────
  const overview = wb.addWorksheet('Overview', {
    views: [{}],
  });
  overview.columns = [
    { key: 'a', width: 28 },
    { key: 'b', width: 60 },
  ];

  // Title
  overview.mergeCells('A1:B1');
  const ov1 = overview.getCell('A1');
  ov1.value = 'CPD/CE Tracker — Database Schema';
  ov1.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  ov1.fill = { type: 'pattern', pattern: 'solid', ...COLOURS.HEADER };
  ov1.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
  overview.getRow(1).height = 32;

  overview.mergeCells('A2:B2');
  const ov2 = overview.getCell('A2');
  ov2.value = 'PostgreSQL schema · 10 tables · Covers veterinary and dental CPD/CE across 15+ jurisdictions';
  ov2.font = { size: 10, italic: true, color: { argb: 'FF666666' }, name: 'Calibri' };
  ov2.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
  overview.getRow(2).height = 18;

  overview.getRow(3).height = 8; // spacer

  // Legend header
  const legendHdr = overview.getRow(4);
  legendHdr.getCell(1).value = 'Colour Legend';
  legendHdr.getCell(1).font = FONT_HDR;
  legendHdr.getCell(1).fill = { type: 'pattern', pattern: 'solid', ...COLOURS.TAB_HDR };
  legendHdr.getCell(2).fill = { type: 'pattern', pattern: 'solid', ...COLOURS.TAB_HDR };
  legendHdr.height = 18;

  const legendItems = [
    ['Gold background',   'PK — Primary Key'],
    ['Green background',  'FK — Foreign Key'],
    ['Orange background', 'ENUM — Enumeration type'],
    ['Grey background',   'CALC — Derived/calculated field (not stored)'],
    ['Blue background',   'BOOL — Boolean flag'],
  ];
  const legendFills = [COLOURS.PK, COLOURS.FK, COLOURS.ENUM, COLOURS.CALC, COLOURS.BOOL];
  legendItems.forEach(([a, b], i) => {
    const row = overview.addRow([a, b]);
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', ...legendFills[i] };
    row.getCell(1).font = FONT_BODY;
    row.getCell(2).font = FONT_BODY;
    row.getCell(1).border = BORDER;
    row.getCell(2).border = BORDER;
    row.height = 16;
  });

  overview.addRow([]);

  // Table of contents
  const tocHdr = overview.addRow(['Sheet', 'Table / Description']);
  tocHdr.getCell(1).font = FONT_HDR;
  tocHdr.getCell(1).fill = { type: 'pattern', pattern: 'solid', ...COLOURS.TAB_HDR };
  tocHdr.getCell(2).font = FONT_HDR;
  tocHdr.getCell(2).fill = { type: 'pattern', pattern: 'solid', ...COLOURS.TAB_HDR };
  tocHdr.height = 18;

  const toc = [
    ['1. practitioners',     'Individual professional user — 9 fields'],
    ['2. registrations',     'Authority registrations per practitioner — 22 fields'],
    ['3. reg_authorities',   'Regulatory bodies (GDC, RCVS, HPCSA…) — 14 fields'],
    ['4. professional_roles','Role definitions per authority — 6 fields'],
    ['5. cpd_rules',         'Core rules engine: one row per authority × role × period — 33 fields'],
    ['6. mandatory_topics',  'Per-topic CPD requirements — 16 fields'],
    ['7. cpd_cycles',        'Generated cycle instances per registration — 25 fields'],
    ['8. cpd_activities',    'Individual CPD activity log entries — 33 fields'],
    ['9. pdp_goals',         'Personal Development Plan goals — 10 fields'],
    ['10. countries',        'Country reference/lookup — 3 fields'],
    ['11. derived_fields',   'Computed values for the widget UI — 15 fields'],
  ];
  toc.forEach(([a, b], i) => {
    const row = overview.addRow([a, b]);
    row.getCell(1).font = FONT_BOLD;
    row.getCell(2).font = FONT_BODY;
    row.getCell(1).border = BORDER;
    row.getCell(2).border = BORDER;
    if (i % 2 === 1) {
      row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }; });
    }
    row.height = 16;
  });

  // ── Data sheets ─────────────────────────────────────────────────────────
  addTableSheet(wb, '1. practitioners',     'practitioners',          'The individual professional user', [], T_PRACTITIONERS);
  addTableSheet(wb, '2. registrations',     'registrations',          'Authority registrations — one practitioner can hold many', [], T_REGISTRATIONS);
  addTableSheet(wb, '3. reg_authorities',   'registration_authorities','Regulatory bodies (GDC, RCVS, HPCSA, DBA, VCI…)', [], T_REG_AUTHORITIES);
  addTableSheet(wb, '4. professional_roles','professional_roles',     'Roles recognised by each authority', [], T_PROFESSIONAL_ROLES);
  addTableSheet(wb, '5. cpd_rules',         'cpd_requirement_rules',  'Core rules engine — one row per authority × role × effective period', [], T_CPD_RULES);
  addTableSheet(wb, '6. mandatory_topics',  'mandatory_topic_rules',  'Per-topic CPD requirements attached to a rule', [], T_MANDATORY_TOPICS);
  addTableSheet(wb, '7. cpd_cycles',        'cpd_cycles',             'Generated CPD cycle instances per registration', [], T_CPD_CYCLES);
  addTableSheet(wb, '8. cpd_activities',    'cpd_activities',         'Individual CPD activities logged by the practitioner', [], T_CPD_ACTIVITIES);
  addTableSheet(wb, '9. pdp_goals',         'pdp_goals',              'Personal Development Plan goals (RCVS, GDC, DCNZ)', [], T_PDP_GOALS);
  addTableSheet(wb, '10. countries',        'countries',              'Country reference/lookup table', [], T_COUNTRIES);
  addTableSheet(wb, '11. derived_fields',   'Derived / Calculated Fields', 'Computed values for the widget UI — not stored in the database', [], T_DERIVED);

  await wb.xlsx.writeFile(OUT);
  console.log(`Workbook written to: ${OUT}`);
}

buildWorkbook().catch(err => { console.error(err); process.exit(1); });
