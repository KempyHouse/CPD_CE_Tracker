-- =============================================================
-- CPD/CE TRACKER — DATABASE SCHEMA
-- PostgreSQL syntax
-- Generated: 2026-03-21
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────────────────────

CREATE TYPE registration_status_enum AS ENUM (
    'active', 'non_practising', 'suspended', 'lapsed', 'student', 'temporary'
);

CREATE TYPE practice_type_enum AS ENUM (
    'clinical', 'non_clinical', 'educator', 'academic', 'government', 'industry'
);

CREATE TYPE sector_enum AS ENUM (
    'veterinary', 'dental', 'both'
);

CREATE TYPE role_tier_enum AS ENUM (
    'generalist', 'advanced_practitioner', 'specialist', 'paraprofessional',
    'technician', 'nurse', 'assistant', 'new_graduate'
);

CREATE TYPE cycle_type_enum AS ENUM (
    'annual', 'biennial', 'triennial', '4_year', '5_year',
    'rolling_2', 'rolling_3', 'rolling_5'
);

CREATE TYPE cycle_anchor_enum AS ENUM (
    'calendar', 'registration_anniversary', 'fixed_date'
);

CREATE TYPE topic_category_enum AS ENUM (
    'mandatory', 'recommended', 'capped'
);

CREATE TYPE cycle_status_enum AS ENUM (
    'in_progress', 'complete', 'non_compliant', 'deferred', 'paused', 'exempt'
);

CREATE TYPE activity_type_enum AS ENUM (
    'conference_session', 'workshop', 'wetlab', 'seminar',
    'webinar_live', 'webinar_recorded', 'online_course',
    'self_directed_reading', 'journal_article_with_assessment',
    'peer_discussion', 'clinical_audit', 'case_discussion',
    'in_house_training', 'mentoring_given', 'mentoring_received',
    'postgraduate_study', 'publication_authored', 'presentation_given',
    'exam_question_writing', 'practice_visit', 'external_examining',
    'short_course', 'management_course', 'resuscitation_training', 'other'
);

CREATE TYPE delivery_format_enum AS ENUM (
    'in_person', 'online_live', 'online_self_paced', 'blended',
    'reading', 'podcast', 'peer_discussion', 'wetlab',
    'conference', 'publication', 'postgraduate_study'
);

CREATE TYPE activity_status_enum AS ENUM (
    'draft', 'submitted', 'approved', 'rejected', 'queried'
);

CREATE TYPE goal_status_enum AS ENUM (
    'planned', 'in_progress', 'met', 'carried_forward'
);


-- =============================================================
-- TABLE 1: countries
-- Reference/lookup table — defined first as it is referenced by others
-- =============================================================
CREATE TABLE countries (
    country_code         CHAR(2)         PRIMARY KEY,
    country_name         VARCHAR(100)    NOT NULL,
    default_authority_id UUID            NULL    -- FK added after registration_authorities
);


-- =============================================================
-- TABLE 2: registration_authorities
-- One row per regulatory body (GDC, RCVS, HPCSA, DBA, etc.)
-- =============================================================
CREATE TABLE registration_authorities (
    authority_id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_name          VARCHAR(200)    NOT NULL,
    authority_abbreviation  VARCHAR(20)     NOT NULL,
    country                 CHAR(2)         NOT NULL REFERENCES countries(country_code),
    region                  VARCHAR(100)    NULL,       -- e.g. 'Ontario', 'Western Australia'
    sector                  sector_enum     NOT NULL,
    website_url             VARCHAR(500)    NULL,
    cpd_platform_url        VARCHAR(500)    NULL,       -- e.g. GDC eGDC, RCVS 1CPD
    uses_hours              BOOLEAN         NOT NULL DEFAULT TRUE,
    uses_points             BOOLEAN         NOT NULL DEFAULT FALSE,
    uses_ceus               BOOLEAN         NOT NULL DEFAULT FALSE,
    uses_credits            BOOLEAN         NOT NULL DEFAULT FALSE,
    unit_label              VARCHAR(20)     NOT NULL DEFAULT 'hours',  -- 'hours','points','CEUs','credits'
    units_per_hour          DECIMAL(5,2)    NOT NULL DEFAULT 1.00,     -- conversion factor
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Now we can close the FK loop on countries
ALTER TABLE countries
    ADD CONSTRAINT fk_countries_default_authority
    FOREIGN KEY (default_authority_id)
    REFERENCES registration_authorities(authority_id)
    ON DELETE SET NULL;


-- =============================================================
-- TABLE 3: professional_roles
-- One row per distinct role recognised by any authority
-- =============================================================
CREATE TABLE professional_roles (
    role_id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id        UUID            NOT NULL REFERENCES registration_authorities(authority_id) ON DELETE CASCADE,
    role_name           VARCHAR(150)    NOT NULL,           -- e.g. 'Veterinary Surgeon', 'Dental Nurse'
    role_abbreviation   VARCHAR(20)     NULL,               -- e.g. 'DVM', 'RVN', 'RDN', 'DH'
    sector              sector_enum     NOT NULL,
    tier                role_tier_enum  NOT NULL DEFAULT 'generalist',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE 4: practitioners
-- The individual professional user
-- =============================================================
CREATE TABLE practitioners (
    practitioner_id     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    email               VARCHAR(255)    NOT NULL UNIQUE,
    date_of_birth       DATE            NULL,
    country_of_practice CHAR(2)         NULL REFERENCES countries(country_code),
    profile_photo_url   VARCHAR(500)    NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE 5: registrations
-- A practitioner may hold multiple registrations across authorities/roles
-- =============================================================
CREATE TABLE registrations (
    registration_id                     UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    practitioner_id                     UUID                    NOT NULL REFERENCES practitioners(practitioner_id) ON DELETE CASCADE,
    authority_id                        UUID                    NOT NULL REFERENCES registration_authorities(authority_id),
    role_id                             UUID                    NOT NULL REFERENCES professional_roles(role_id),

    -- Official registration details
    registration_number                 VARCHAR(100)            NULL,
    registration_date                   DATE                    NULL,
    registration_status                 registration_status_enum NOT NULL DEFAULT 'active',

    -- New graduate flags
    is_new_graduate                     BOOLEAN                 NOT NULL DEFAULT FALSE,
    new_graduate_start_date             DATE                    NULL,

    -- Specialist / advanced practitioner
    is_specialist                       BOOLEAN                 NOT NULL DEFAULT FALSE,
    specialty_area                      VARCHAR(200)            NULL,   -- e.g. 'orthopaedics', 'periodontics'
    is_advanced_practitioner            BOOLEAN                 NOT NULL DEFAULT FALSE,
    advanced_practitioner_designation   VARCHAR(200)            NULL,   -- e.g. 'dentistry in cats'

    -- Dual / special registrations
    is_dual_registered                  BOOLEAN                 NOT NULL DEFAULT FALSE,
    holds_dea_registration              BOOLEAN                 NOT NULL DEFAULT FALSE,  -- USA controlled substances CE
    holds_prescribing_rights            BOOLEAN                 NOT NULL DEFAULT FALSE,

    -- Practice context
    practice_type                       practice_type_enum      NOT NULL DEFAULT 'clinical',
    fte_percentage                      INTEGER                 NULL CHECK (fte_percentage BETWEEN 0 AND 100),

    -- Active dates
    active_from                         DATE                    NOT NULL,
    active_to                           DATE                    NULL,

    created_at                          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE 6: cpd_requirement_rules
-- Master rules: one row per authority × role × effective date
-- This is the heart of the widget
-- =============================================================
CREATE TABLE cpd_requirement_rules (
    rule_id                     UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id                UUID                NOT NULL REFERENCES registration_authorities(authority_id),
    role_id                     UUID                NOT NULL REFERENCES professional_roles(role_id),

    -- Versioning
    effective_from              DATE                NOT NULL,
    effective_to                DATE                NULL,   -- NULL = currently active

    -- Cycle structure
    cycle_type                  cycle_type_enum     NOT NULL,
    cycle_length_months         INTEGER             NOT NULL,   -- e.g. 12, 24, 36, 60
    cycle_start_month           INTEGER             NULL CHECK (cycle_start_month BETWEEN 1 AND 12),
    cycle_start_day             INTEGER             NULL CHECK (cycle_start_day BETWEEN 1 AND 31),
    cycle_start_anchor          cycle_anchor_enum   NOT NULL DEFAULT 'calendar',

    -- Core unit requirements
    total_units_required        DECIMAL(8,2)        NOT NULL,
    annual_minimum_units        DECIMAL(8,2)        NULL,   -- e.g. RCVS 35/yr

    -- Spread rules (e.g. GDC min 10 hrs in any 24-month window)
    spread_rule_units           DECIMAL(8,2)        NULL,
    spread_rule_months          INTEGER             NULL,

    -- Structured / verifiable split
    min_structured_units        DECIMAL(8,2)        NULL,   -- AUS 15 structured/3yr
    min_verifiable_units        DECIMAL(8,2)        NULL,   -- GDC all 100/5yr verifiable
    max_unstructured_units      DECIMAL(8,2)        NULL,

    -- Non-clinical caps
    max_non_clinical_units      DECIMAL(8,2)        NULL,   -- AUS 12/60 hrs non-scientific
    max_non_clinical_percent    DECIMAL(5,2)        NULL,   -- e.g. 20.0 for DBA Australia

    -- Carry-over
    carry_over_allowed          BOOLEAN             NOT NULL DEFAULT FALSE,
    carry_over_max_units        DECIMAL(8,2)        NULL,

    -- Pause rules (e.g. RCVS 6-month pause)
    pause_allowed               BOOLEAN             NOT NULL DEFAULT FALSE,
    pause_max_months            INTEGER             NULL,
    pause_reduced_units         DECIMAL(8,2)        NULL,

    -- New graduate rules
    new_graduate_exemption      BOOLEAN             NOT NULL DEFAULT FALSE,
    new_graduate_months         INTEGER             NULL,

    -- Pro-rata / exemptions
    pro_rata_for_part_year      BOOLEAN             NOT NULL DEFAULT FALSE,
    non_practising_exempt       BOOLEAN             NOT NULL DEFAULT FALSE,
    postgrad_study_exempts      BOOLEAN             NOT NULL DEFAULT FALSE,
    deferral_allowed            BOOLEAN             NOT NULL DEFAULT FALSE,

    notes                       TEXT                NULL,

    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE 7: mandatory_topic_rules
-- Specific topic requirements attached to a rule (many-to-one with cpd_requirement_rules)
-- =============================================================
CREATE TABLE mandatory_topic_rules (
    topic_rule_id               UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id                     UUID                NOT NULL REFERENCES cpd_requirement_rules(rule_id) ON DELETE CASCADE,

    topic_name                  VARCHAR(200)        NOT NULL,   -- e.g. 'Medical Emergencies', 'Ethics & Human Rights'
    topic_category              topic_category_enum NOT NULL DEFAULT 'mandatory',

    -- Minimums
    min_units_per_cycle         DECIMAL(8,2)        NULL,   -- e.g. GDC 10 hrs/5yr medical emergencies
    min_units_per_year          DECIMAL(8,2)        NULL,   -- e.g. GDC 2 hrs/yr medical emergencies

    -- Caps
    max_units_per_cycle         DECIMAL(8,2)        NULL,   -- e.g. VCI max 6 hrs independent study
    max_units_per_year          DECIMAL(8,2)        NULL,
    max_percent_of_total        DECIMAL(5,2)        NULL,   -- e.g. VCI 25% management skills

    -- Delivery constraints
    must_be_live                BOOLEAN             NOT NULL DEFAULT FALSE,  -- e.g. Georgia 1 hr live professionalism
    must_be_in_person           BOOLEAN             NOT NULL DEFAULT FALSE,  -- e.g. CPR/BLS practical

    -- Conditional applicability
    applies_if_holds_dea        BOOLEAN             NOT NULL DEFAULT FALSE,  -- USA DEA conditional
    applies_if_prescriber       BOOLEAN             NOT NULL DEFAULT FALSE,  -- opioid training
    applies_if_does_radiography BOOLEAN             NOT NULL DEFAULT FALSE,  -- GDC radiography

    notes                       TEXT                NULL,

    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE 8: cpd_cycles
-- A generated CPD cycle instance for a specific practitioner registration
-- =============================================================
CREATE TABLE cpd_cycles (
    cycle_id                    UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id             UUID                NOT NULL REFERENCES registrations(registration_id) ON DELETE CASCADE,
    rule_id                     UUID                NOT NULL REFERENCES cpd_requirement_rules(rule_id),

    cycle_number                INTEGER             NOT NULL DEFAULT 1,  -- for SAVC phase-in graduated requirements
    cycle_start_date            DATE                NOT NULL,
    cycle_end_date              DATE                NOT NULL,

    -- Requirements (may differ from rule if pro-rated)
    units_required              DECIMAL(8,2)        NOT NULL,
    min_structured_required     DECIMAL(8,2)        NULL,
    min_verifiable_required     DECIMAL(8,2)        NULL,
    max_non_clinical_allowed    DECIMAL(8,2)        NULL,

    -- Progress (computed from cpd_activities)
    units_completed             DECIMAL(8,2)        NOT NULL DEFAULT 0,
    structured_completed        DECIMAL(8,2)        NOT NULL DEFAULT 0,
    verifiable_completed        DECIMAL(8,2)        NOT NULL DEFAULT 0,
    non_clinical_completed      DECIMAL(8,2)        NOT NULL DEFAULT 0,

    -- Compliance flags (computed)
    mandatory_topics_met        BOOLEAN             NOT NULL DEFAULT FALSE,
    spread_rule_met             BOOLEAN             NULL,   -- NULL if rule doesn't apply

    -- Cycle status
    status                      cycle_status_enum   NOT NULL DEFAULT 'in_progress',

    -- Pause tracking
    is_paused                   BOOLEAN             NOT NULL DEFAULT FALSE,
    pause_start_date            DATE                NULL,
    pause_end_date              DATE                NULL,

    -- Audit
    audit_selected              BOOLEAN             NOT NULL DEFAULT FALSE,
    audit_submitted_date        DATE                NULL,

    notes                       TEXT                NULL,

    created_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE 9: cpd_activities
-- Individual CPD entries logged by the practitioner
-- =============================================================
CREATE TABLE cpd_activities (
    activity_id             UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id         UUID                    NOT NULL REFERENCES registrations(registration_id) ON DELETE CASCADE,
    cycle_id                UUID                    NOT NULL REFERENCES cpd_cycles(cycle_id),

    -- Activity details
    activity_title          VARCHAR(500)            NOT NULL,
    activity_description    TEXT                    NULL,
    activity_date           DATE                    NOT NULL,

    -- Provider / accreditation
    provider_name           VARCHAR(200)            NULL,   -- e.g. 'BSAVA', 'Agilio', 'VetCEE'
    provider_accreditation  VARCHAR(100)            NULL,   -- e.g. 'RACE', 'SAVC', 'GDC approved', 'RCDSO'
    is_accredited           BOOLEAN                 NOT NULL DEFAULT FALSE,
    accreditation_number    VARCHAR(100)            NULL,

    -- Classification
    activity_type           activity_type_enum      NOT NULL,
    delivery_format         delivery_format_enum    NOT NULL,
    topic_category          VARCHAR(200)            NULL,   -- links to mandatory_topic_rules.topic_name

    -- CPD type flags (different authorities use different definitions)
    is_clinical             BOOLEAN                 NOT NULL DEFAULT TRUE,   -- scientific/clinical vs non-clinical
    is_verifiable           BOOLEAN                 NOT NULL DEFAULT FALSE,  -- GDC definition
    is_structured           BOOLEAN                 NOT NULL DEFAULT FALSE,  -- AUS/NZ definition

    -- Units
    units_claimed           DECIMAL(8,2)            NOT NULL,
    units_awarded           DECIMAL(8,2)            NULL,   -- may differ if capped
    units_multiplier        DECIMAL(4,2)            NOT NULL DEFAULT 1.00,   -- e.g. 2.0 for VCI wetlabs

    -- Evidence
    certificates_url        VARCHAR(500)            NULL,
    evidence_document_url   VARCHAR(500)            NULL,

    -- Reflection (RCVS 1CPD, GDC eCPD, DCNZ frameworks)
    reflection_text         TEXT                    NULL,
    reflection_date         DATE                    NULL,

    -- Peer discussion (NZ DCNZ requirement)
    peer_discussed          BOOLEAN                 NOT NULL DEFAULT FALSE,
    peer_name               VARCHAR(200)            NULL,

    -- PDP linkage
    pdp_goal_linked         UUID                    NULL,   -- FK to pdp_goals added below

    -- Presenter / author credit
    is_presenter            BOOLEAN                 NOT NULL DEFAULT FALSE,
    is_author               BOOLEAN                 NOT NULL DEFAULT FALSE,
    publication_doi         VARCHAR(300)            NULL,

    -- Postgraduate study
    postgrad_year           INTEGER                 NULL,

    -- Status
    status                  activity_status_enum    NOT NULL DEFAULT 'draft',

    created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);


-- =============================================================
-- TABLE 10: pdp_goals
-- Personal Development Plans (required by RCVS, GDC, DCNZ)
-- =============================================================
CREATE TABLE pdp_goals (
    goal_id             UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id     UUID                NOT NULL REFERENCES registrations(registration_id) ON DELETE CASCADE,
    cycle_id            UUID                NOT NULL REFERENCES cpd_cycles(cycle_id),

    goal_title          VARCHAR(500)        NOT NULL,
    goal_description    TEXT                NULL,
    field_of_practice   VARCHAR(200)        NULL,
    target_date         DATE                NULL,
    status              goal_status_enum    NOT NULL DEFAULT 'planned',

    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Now close the FK loop from cpd_activities → pdp_goals
ALTER TABLE cpd_activities
    ADD CONSTRAINT fk_activity_pdp_goal
    FOREIGN KEY (pdp_goal_linked)
    REFERENCES pdp_goals(goal_id)
    ON DELETE SET NULL;


-- =============================================================
-- INDEXES
-- =============================================================

-- Practitioners
CREATE INDEX idx_practitioners_email       ON practitioners(email);
CREATE INDEX idx_practitioners_country     ON practitioners(country_of_practice);

-- Registrations
CREATE INDEX idx_registrations_practitioner ON registrations(practitioner_id);
CREATE INDEX idx_registrations_authority    ON registrations(authority_id);
CREATE INDEX idx_registrations_role         ON registrations(role_id);
CREATE INDEX idx_registrations_status       ON registrations(registration_status);

-- CPD rules
CREATE INDEX idx_rules_authority            ON cpd_requirement_rules(authority_id);
CREATE INDEX idx_rules_role                 ON cpd_requirement_rules(role_id);
CREATE INDEX idx_rules_effective            ON cpd_requirement_rules(effective_from, effective_to);

-- Topic rules
CREATE INDEX idx_topic_rules_rule           ON mandatory_topic_rules(rule_id);

-- Cycles
CREATE INDEX idx_cycles_registration        ON cpd_cycles(registration_id);
CREATE INDEX idx_cycles_rule                ON cpd_cycles(rule_id);
CREATE INDEX idx_cycles_dates               ON cpd_cycles(cycle_start_date, cycle_end_date);
CREATE INDEX idx_cycles_status              ON cpd_cycles(status);

-- Activities
CREATE INDEX idx_activities_registration    ON cpd_activities(registration_id);
CREATE INDEX idx_activities_cycle           ON cpd_activities(cycle_id);
CREATE INDEX idx_activities_date            ON cpd_activities(activity_date);
CREATE INDEX idx_activities_type            ON cpd_activities(activity_type);
CREATE INDEX idx_activities_status          ON cpd_activities(status);

-- PDP goals
CREATE INDEX idx_pdp_registration           ON pdp_goals(registration_id);
CREATE INDEX idx_pdp_cycle                  ON pdp_goals(cycle_id);


-- =============================================================
-- COMPUTED / DERIVED FIELDS — Widget UI Reference
-- These are NOT stored; they are calculated at query time.
-- =============================================================
--
-- units_remaining             = units_required - units_completed
-- percent_complete            = (units_completed / units_required) * 100
-- days_remaining_in_cycle     = cycle_end_date - CURRENT_DATE
-- projected_completion_date   = based on average activity rate
-- structured_deficit          = min_structured_required - structured_completed
-- mandatory_topic_deficits    = per topic: min_required - completed
-- non_clinical_headroom       = max_non_clinical_allowed - non_clinical_completed
-- spread_rule_window_units    = SUM of units in any rolling N-month window
-- annual_minimum_met          = boolean per calendar year within cycle
-- carry_over_available        = surplus from prior cycle (if carry_over_allowed)
-- pause_hours_saved           = reduction granted by pause period
-- compliance_traffic_light    = 'green' / 'amber' / 'red' based on trajectory
--
-- =============================================================
