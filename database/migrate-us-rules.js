'use strict';
/**
 * migrate-us-rules.js
 * Idempotent migration: adds all 50 US state + DC + territory
 * veterinary medical board authorities, DVM roles, CE rules, and
 * mandatory topic rules.  Safe to run on existing DBs.
 */
const { randomUUID: uuid } = require('crypto');
const { getDb } = require('./init');

// ─── All 50 states + DC + territories data ───────────────────────────────────
// cycle_type: 'annual' | 'biennial' | 'triennial'
// cycle_end: ISO month-day for fixed end, 'birth' for birth-month, null for issue-date
// even_only: true if cycle always ends in an even year
// odd_only: true if cycle always ends in an odd year
const US_STATES = [
  { code:'AL', key:'us_al_svmb', name:'Alabama Board of Veterinary Medical Examiners',   abbr:'AL BVME',  website:'https://www.almvb.alabama.gov',
    cycle:'annual',  months:12,  hrs:20, online_hrs:10,  online_pct:50,  ss_hrs:null, pm_hrs:4,  per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Min 16 scientific; max 4 non-medical; over 4yr: 60 sci + 20 mgmt' },
  { code:'AK', key:'us_ak_svmb', name:'Alaska State Board of Veterinary Examiners',       abbr:'AK SBVE',  website:'https://www.commerce.alaska.gov/web/cbpl/ProfessionalLicensing/VeterinaryExaminers',
    cycle:'biennial', months:24, hrs:30, online_hrs:null, online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'AZ', key:'us_az_svmb', name:'Arizona State Veterinary Medical Examining Board', abbr:'AZ SVMEB', website:'https://vetboard.az.gov',
    cycle:'biennial', months:24, hrs:20, online_hrs:null, online_pct:100, ss_hrs:5,  pm_hrs:2,  per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Max 5hr non-interactive self-study; max 2hr PM; conditional opioid for DEA holders' },
  { code:'AR', key:'us_ar_svmb', name:'Arkansas Livestock and Poultry Commission (Vet)',   abbr:'AR SVMB',  website:'https://www.arkansas.gov/arlpc',
    cycle:'annual',  months:12,  hrs:20, online_hrs:10,  online_pct:50,  ss_hrs:10, pm_hrs:8,  per_day:null, carryover:false, carryover_max:null, cycle_end:'03-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Min 10hr live/interactive; max 10hr pre-recorded; min 10hr scientific; max 8hr non-medical' },
  { code:'CA', key:'us_ca_svmb', name:'California Veterinary Medical Board',               abbr:'CA VMB',   website:'https://www.vmb.ca.gov',
    cycle:'biennial', months:24, hrs:36, online_hrs:null,online_pct:100, ss_hrs:6,  pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'birth', even_only:false, odd_only:false, birth:true,
    mandatory_topics_enabled:false, notes:'Max 6hr self-study; CE must be AAVSB RACE or CA VMB approved; renewal on last day of licence-issue month in 2nd year' },
  { code:'CO', key:'us_co_svmb', name:'Colorado State Board of Veterinary Medicine',       abbr:'CO SBVM',  website:'https://dpo.colorado.gov/VetMed',
    cycle:'biennial', months:24, hrs:32, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:8, per_day:null, carryover:false, carryover_max:null, cycle_end:'10-31', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 26hr scientific; max 8hr non-medical; 2hr delegation/supervision new from 2026' },
  { code:'CT', key:'us_ct_svmb', name:'Connecticut DPH Veterinary Licensing Section',      abbr:'CT DPH',   website:'https://portal.ct.gov/dph/practitioner-licensing--investigations/vet',
    cycle:'biennial', months:24, hrs:24, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:null, even_only:false, odd_only:false, birth:false,
    approval_standard:'BOARD_ONLY',
    mandatory_topics_enabled:false, notes:'RACE approval NOT required; board-approved only; keep records 3 years' },
  { code:'DE', key:'us_de_svmb', name:'Delaware Board of Veterinary Medicine',             abbr:'DE BVM',   website:'https://dpr.delaware.gov/boards/veterinarymedicine',
    cycle:'biennial', months:24, hrs:24, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'07-31', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'DC', key:'us_dc_svmb', name:'DC Board of Veterinary Medicine',                   abbr:'DC BVM',   website:'https://dchealth.dc.gov/service/veterinary-medicine-licensure',
    cycle:'biennial', months:24, hrs:36, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:true, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'FL', key:'us_fl_svmb', name:'Florida Board of Veterinary Medicine',              abbr:'FL BVM',   website:'https://floridasveterinarymedicine.gov',
    cycle:'biennial', months:24, hrs:30, online_hrs:null,online_pct:100, ss_hrs:15, pm_hrs:5, per_day:null, carryover:false, carryover_max:null, cycle_end:'05-31', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 1hr legend drugs; min 2hr FL law & rules; max 5hr comp/alt medicine; max 5hr PM; max 5hr mental health' },
  { code:'GA', key:'us_ga_svmb', name:'Georgia State Board of Veterinary Medicine',        abbr:'GA SBVM',  website:'https://sos.ga.gov/page/state-board-veterinary-medicine',
    cycle:'biennial', months:24, hrs:30, online_hrs:15,  online_pct:50,  ss_hrs:null, pm_hrs:null, per_day:12, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 18hr scientific; 2hr GA laws (1hr must be live); max 12hr/day; max 20hr from single programme; max 6hr in-house employer training; NO carryover' },
  { code:'HI', key:'us_hi_svmb', name:'Hawaii Board of Veterinary Examiners',             abbr:'HI BVE',   website:'https://cca.hawaii.gov/pvl/boards/veterinary/',
    cycle:'biennial', months:24, hrs:20, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'06-30', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'ID', key:'us_id_svmb', name:'Idaho State Board of Veterinary Medicine',         abbr:'ID SBVM',  website:'https://isbd.idaho.gov',
    cycle:'biennial', months:24, hrs:15, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'06-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'IL', key:'us_il_svmb', name:'Illinois Department of Financial and Professional Regulation (Vet)',abbr:'IL IDFPR', website:'https://idfpr.illinois.gov/profs/vetmedicine.asp',
    cycle:'biennial', months:24, hrs:40, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'01-31', even_only:false, odd_only:true, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'IN', key:'us_in_svmb', name:'Indiana Professional Licensing Agency — Veterinary Medicine', abbr:'IN PLA', website:'https://www.in.gov/pla/veterinary/',
    cycle:'biennial', months:24, hrs:40, online_hrs:null,online_pct:100, ss_hrs:20, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'10-15', even_only:false, odd_only:true, birth:false,
    mandatory_topics_enabled:false, notes:'Max 20hr self-study (must include written exam/post-evaluation)' },
  { code:'IA', key:'us_ia_svmb', name:'Iowa Board of Veterinary Medicine',                abbr:'IA BVM',   website:'https://iowaagriculture.gov/animal-industry-bureau-divisions/veterinary-medicine',
    cycle:'triennial', months:36, hrs:60, online_hrs:20, online_pct:33, ss_hrs:null, pm_hrs:20, per_day:null, carryover:true,  carryover_max:20, cycle_end:'06-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Highest US requirement (60hr/3yr); up to 20hr excess may carry over' },
  { code:'KS', key:'us_ks_svmb', name:'Kansas Board of Veterinary Examiners',             abbr:'KS BVE',   website:'https://www.ksvmeb.org',
    cycle:'annual',  months:12,  hrs:20, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'06-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Broad CE definition — includes specialist consultations and self-study journal articles with follow-up testing' },
  { code:'KY', key:'us_ky_svmb', name:'Kentucky Board of Veterinary Examiners',           abbr:'KY BVE',   website:'https://kbve.ky.gov',
    cycle:'biennial', months:24, hrs:30, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:10, per_day:null, carryover:false, carryover_max:null, cycle_end:'09-30', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Max 10hr PM/non-medical' },
  { code:'LA', key:'us_la_svmb', name:'Louisiana Board of Veterinary Medicine',           abbr:'LA BVM',   website:'https://www.lsbvm.org',
    cycle:'annual',  months:12,  hrs:20, online_hrs:10,  online_pct:50,  ss_hrs:10, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'09-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Max 10hr self-study/non-interactive' },
  { code:'ME', key:'us_me_svmb', name:'Maine Board of Veterinary Medicine',               abbr:'ME BVM',   website:'https://www.maine.gov/pfr/professionallicensing/professions/veterinary-medicine',
    cycle:'biennial', months:24, hrs:24, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:6,  per_day:null, carryover:false, carryover_max:null, cycle_end:'09-30', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Annual renewal; CE certified every even year; max 6hr PM/non-medical' },
  { code:'MD', key:'us_md_svmb', name:'Maryland Board of Veterinary Medical Examiners',  abbr:'MD BVME',  website:'https://mda.maryland.gov/vetboard',
    cycle:'annual',  months:12,  hrs:18, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:6, per_day:null, carryover:true,  carryover_max:null, cycle_end:'06-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Min 12hr medical/scientific; max 6hr non-medical; excess hours carry to next year (no cap stated)' },
  { code:'MA', key:'us_ma_svmb', name:'Massachusetts Board of Registration in Veterinary Medicine', abbr:'MA BRVM', website:'https://www.mass.gov/veterinary-medicine',
    cycle:'annual',  months:12,  hrs:15, online_hrs:null,online_pct:100, ss_hrs:6,  pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'02-28', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Max 6hr self-study; live webinars NOT counted toward 6hr cap' },
  { code:'MI', key:'us_mi_svmb', name:'Michigan Board of Veterinary Medicine',            abbr:'MI BVM',   website:'https://www.michigan.gov/lara/bureau-list/bpl/occ/professions/veterinary-medicine',
    cycle:'triennial', months:36, hrs:45, online_hrs:33, online_pct:73, ss_hrs:33, pm_hrs:null, per_day:12, carryover:false, carryover_max:null, cycle_end:null, even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 12hr live in-person (or 6hr live + 6hr synchronous); min 30hr scientific; min 1hr medical records; min 1hr vet law/CDS; max 12hr per 24h period; 3yr from licensure date' },
  { code:'MN', key:'us_mn_svmb', name:'Minnesota Board of Veterinary Medicine',           abbr:'MN BVM',   website:'https://mn.gov/boards/veterinary-medicine',
    cycle:'biennial', months:24, hrs:40, online_hrs:null,online_pct:100, ss_hrs:40, pm_hrs:10, per_day:null, carryover:false, carryover_max:null, cycle_end:'02-28', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Min 30hr interactive; max 40hr self-study at 1 CE per 3hr reading; max 10hr PM' },
  { code:'MS', key:'us_ms_svmb', name:'Mississippi Board of Veterinary Medicine',         abbr:'MS BVM',   website:'https://www.ms.gov/vetmed',
    cycle:'annual',  months:12,  hrs:15, online_hrs:5,   online_pct:33,  ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'08-01', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Min 10hr live/interactive' },
  { code:'MO', key:'us_mo_svmb', name:'Missouri Veterinary Medical Board',                abbr:'MO VMB',   website:'https://pr.mo.gov/veterinary.asp',
    cycle:'annual',  months:12,  hrs:10, online_hrs:null,online_pct:100, ss_hrs:2,  pm_hrs:4,  per_day:null, carryover:false, carryover_max:null, cycle_end:'11-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Lowest US requirement (10hr/yr); max 2hr self-study (journal reading); max 4hr PM/non-medical' },
  { code:'MT', key:'us_mt_svmb', name:'Montana Board of Veterinary Medicine',             abbr:'MT BVM',   website:'https://boards.bsd.dli.mt.gov/vet',
    cycle:'biennial', months:24, hrs:20, online_hrs:10,  online_pct:50,  ss_hrs:10, pm_hrs:5,  per_day:null, carryover:false, carryover_max:null, cycle_end:'11-01', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'CE reported in even years; max 10hr self-study; max 5hr PM' },
  { code:'NE', key:'us_ne_svmb', name:'Nebraska State Board of Veterinary Medicine and Surgery', abbr:'NE SBVMS', website:'https://www.nebraska.gov/veterinary',
    cycle:'biennial', months:24, hrs:32, online_hrs:8,   online_pct:25,  ss_hrs:8,  pm_hrs:8,  per_day:null, carryover:false, carryover_max:null, cycle_end:'04-01', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'One of most restrictive online allowances (25%); mandatory 3hr opioids incl 0.5hr PDMP' },
  { code:'NV', key:'us_nv_svmb', name:'Nevada State Board of Veterinary Medical Examiners', abbr:'NV SBVME', website:'https://nvvetboard.nv.gov',
    cycle:'annual',  months:12,  hrs:20, online_hrs:10,  online_pct:50,  ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Max 10hr distance learning or correspondence' },
  { code:'NH', key:'us_nh_svmb', name:'New Hampshire Veterinary Licensing Board',         abbr:'NH VLB',   website:'https://www.oplc.nh.gov/boards/veterinary-medicine',
    cycle:'biennial', months:24, hrs:30, online_hrs:15,  online_pct:50,  ss_hrs:null, pm_hrs:6,  per_day:null, carryover:false, carryover_max:null, cycle_end:null, even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 24hr medical; max 6hr non-medical; max 4hr comp/alt vet therapies; min 1hr medical records/law/ethics; min 1hr opioid; max 1hr wellness; min 15hr in-person or synchronous interactive' },
  { code:'NJ', key:'us_nj_svmb', name:'New Jersey State Board of Veterinary Medical Examiners', abbr:'NJ SBVME', website:'https://www.njconsumeraffairs.gov/bvet',
    cycle:'biennial', months:24, hrs:20, online_hrs:null,online_pct:100, ss_hrs:5,  pm_hrs:4,  per_day:null, carryover:false, carryover_max:null, cycle_end:'06-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 17hr surgery/medicine/dentistry; max 4hr PM; max 5hr self-study; min 1hr opioid' },
  { code:'NM', key:'us_nm_svmb', name:'New Mexico Board of Veterinary Medicine',          abbr:'NM BVM',   website:'https://www.rld.nm.gov/boards-and-commissions/individual-boards-and-commissions/veterinary',
    cycle:'annual',  months:12,  hrs:15, online_hrs:null,online_pct:100, ss_hrs:7.5,pm_hrs:5,  per_day:null, carryover:false, carryover_max:null, cycle_end:'birth', even_only:false, odd_only:false, birth:true,
    mandatory_topics_enabled:false, notes:'Max 5hr PM; max 11.5hr alt medicine; max 7.5hr non-contact/non-interactive; renewal on last day of birth month' },
  { code:'NY', key:'us_ny_svmb', name:'New York State Education Department — Veterinary Medicine', abbr:'NY NYSED', website:'https://www.op.nysed.gov/professions/veterinary-medicine',
    cycle:'triennial', months:36, hrs:45, online_hrs:null,online_pct:100, ss_hrs:22.5, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:null, even_only:false, odd_only:false, birth:false,
    approval_standard:'NY_BOARD_ONLY',
    mandatory_topics_enabled:true,  notes:'RACE-approved CE NOT accepted — NY State Education Dept approval required separately; max 22.5hr self-instructional/non-interactive; rolling 3yr from licensure' },
  { code:'NC', key:'us_nc_svmb', name:'North Carolina Veterinary Medical Board',          abbr:'NC VMB',   website:'https://www.ncvmb.org',
    cycle:'annual',  months:12,  hrs:20, online_hrs:10,  online_pct:50,  ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 5 of 10 online hrs must be interactive; min 2hr controlled substances abuse' },
  { code:'ND', key:'us_nd_svmb', name:'North Dakota Board of Veterinary Medical Examiners', abbr:'ND BVME', website:'https://www.ndbvme.nd.gov',
    cycle:'biennial', months:24, hrs:24, online_hrs:12,  online_pct:50,  ss_hrs:12, pm_hrs:8,  per_day:null, carryover:false, carryover_max:null, cycle_end:'07-01', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'CE certified in even years; max 8hr PM; max 8hr vet exchange programme' },
  { code:'OH', key:'us_oh_svmb', name:'Ohio State Veterinary Medical Licensing Board',    abbr:'OH SVMLB', website:'https://vet.ohio.gov',
    cycle:'biennial', months:24, hrs:30, online_hrs:18,  online_pct:60,  ss_hrs:15, pm_hrs:10, per_day:null, carryover:false, carryover_max:null, cycle_end:'03-01', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Max 15hr non-interactive/self-study; max 10hr PM/non-medical/professional development' },
  { code:'OK', key:'us_ok_svmb', name:'Oklahoma Board of Veterinary Medical Examiners',   abbr:'OK BVME',  website:'https://www.veterinary.ok.gov',
    cycle:'annual',  months:12,  hrs:20, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'06-30', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 2hr CDS law or practice act review (board meeting qualifies); min 1hr opioid pain management/use/addiction' },
  { code:'OR', key:'us_or_svmb', name:'Oregon Veterinary Medical Examining Board',        abbr:'OR VMEB',  website:'https://oregonvma.org',
    cycle:'biennial', months:24, hrs:30, online_hrs:null,online_pct:100, ss_hrs:4,  pm_hrs:6,  per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:true, birth:false,
    mandatory_topics_enabled:true,  notes:'CE reported in odd years; max 4hr reading approved scientific journals; max 6hr non-medical; min 1hr antibiotic stewardship + anaesthesia/analgesia' },
  { code:'PA', key:'us_pa_svmb', name:'Pennsylvania State Board of Veterinary Medicine',  abbr:'PA SBVM',  website:'https://www.dos.pa.gov/ProfessionalLicensing/BoardsCommissions/VeterinaryMedicine',
    cycle:'biennial', months:24, hrs:30, online_hrs:7.5, online_pct:25,  ss_hrs:7.5,pm_hrs:0,  per_day:null, carryover:false, carryover_max:null, cycle_end:'11-30', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'One of most restrictive online states (25%); NO credit for PM/non-medical CE' },
  { code:'RI', key:'us_ri_svmb', name:'Rhode Island Department of Health — Veterinary Medicine', abbr:'RI DOH', website:'https://health.ri.gov/licenses/detail.php?id=213',
    cycle:'biennial', months:24, hrs:24, online_hrs:8,   online_pct:33,  ss_hrs:4,  pm_hrs:4,  per_day:null, carryover:false, carryover_max:null, cycle_end:'05-01', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Max 4hr self-study/non-contact on-demand online; max 4hr PM' },
  { code:'SC', key:'us_sc_svmb', name:'South Carolina Board of Veterinary Medical Examiners', abbr:'SC BVME', website:'https://llr.sc.gov/vet',
    cycle:'biennial', months:24, hrs:30, online_hrs:15,  online_pct:50,  ss_hrs:3,  pm_hrs:8,  per_day:null, carryover:false, carryover_max:null, cycle_end:'03-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 22hr medical; max 8hr PM; max 3hr journal programmes; max 3hr audio programmes; min 2hr prescribing/monitoring CDS' },
  { code:'SD', key:'us_sd_svmb', name:'South Dakota Board of Veterinary Medical Examiners', abbr:'SD BVME', website:'https://dlr.sd.gov/veterinary',
    cycle:'biennial', months:24, hrs:32, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'07-01', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'TN', key:'us_tn_svmb', name:'Tennessee Board of Veterinary Medical Examiners',  abbr:'TN BVME',  website:'https://www.tn.gov/commerce/regboards/vetmed.html',
    cycle:'annual',  months:12,  hrs:20, online_hrs:10,  online_pct:50,  ss_hrs:null, pm_hrs:5,  per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Min 15hr medical; max 5hr non-medical; min 2hr law/CDS/ethics every 2 years' },
  { code:'TX', key:'us_tx_svmb', name:'Texas Board of Veterinary Medical Examiners',      abbr:'TX BVME',  website:'https://veterinary.texas.gov',
    cycle:'annual',  months:12,  hrs:17, online_hrs:5,   online_pct:29,  ss_hrs:3,  pm_hrs:5,  per_day:null, carryover:false, carryover_max:null, cycle_end:'birth', even_only:false, odd_only:false, birth:true,
    mandatory_topics_enabled:true,  notes:'Most restrictive online (~29%); max 3hr self-study; max 5hr PM + correspondence (with cert); 2hr opioids every 2 years; renewal on last day of birth month' },
  { code:'UT', key:'us_ut_svmb', name:'Utah Division of Professional Licensing — Veterinary Medicine', abbr:'UT DOPL', website:'https://dopl.utah.gov/vet',
    cycle:'biennial', months:24, hrs:24, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'09-30', even_only:true, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Opioid CE required — verify specific hours with board' },
  { code:'VT', key:'us_vt_svmb', name:'Vermont Board of Veterinary Medicine',             abbr:'VT BVM',   website:'https://sos.vermont.gov/veterinary-medicine',
    cycle:'biennial', months:24, hrs:24, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'05-31', even_only:false, odd_only:true, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'VA', key:'us_va_svmb', name:'Virginia Board of Veterinary Medicine',            abbr:'VA BVM',   website:'https://www.dhp.virginia.gov/medicine/veterinary',
    cycle:'annual',  months:12,  hrs:15, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:null },
  { code:'WA', key:'us_wa_svmb', name:'Washington State Department of Health — Veterinary Medicine', abbr:'WA DOH', website:'https://www.doh.wa.gov/LicensesPermitsandCertificates/ProfessionsNewReneworUpdate/VeterinaryBoards',
    cycle:'biennial', months:24, hrs:30, online_hrs:null,online_pct:100, ss_hrs:10, pm_hrs:10, per_day:null, carryover:false, carryover_max:null, cycle_end:'birth', even_only:false, odd_only:false, birth:true,
    mandatory_topics_enabled:true,  notes:'Min 20hr medical; max 10hr non-medical; max 10hr self-study; one-time 3hr suicide prevention training required; renewal on birth month' },
  { code:'WV', key:'us_wv_svmb', name:'West Virginia Board of Veterinary Medicine',      abbr:'WV BVM',   website:'https://www.wvbvm.org',
    cycle:'annual',  months:12,  hrs:18, online_hrs:4,   online_pct:22,  ss_hrs:null, pm_hrs:4,  per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'One of most restrictive online states (~22%); min 14hr medical; max 4hr PM' },
  { code:'WI', key:'us_wi_svmb', name:'Wisconsin Veterinary Examining Board',             abbr:'WI VEB',   website:'https://dsps.wi.gov/pages/Professions/Veterinarian',
    cycle:'biennial', months:24, hrs:30, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:true, birth:false,
    mandatory_topics_enabled:false, notes:'Min 25hr medical/scientific' },
  { code:'WY', key:'us_wy_svmb', name:'Wyoming Veterinary Board of Examiners',            abbr:'WY VBE',   website:'https://wvbc.wyo.gov',
    cycle:'biennial', months:24, hrs:24, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:6,  per_day:null, carryover:false, carryover_max:null, cycle_end:'12-31', even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:true,  notes:'Min 3hr controlled substances every 2 years; max 6hr PM' },
  { code:'PR', key:'us_pr_svmb', name:'Puerto Rico Board of Veterinary Medicine',        abbr:'PR BVM',   website:'https://www.estado.pr.gov',
    cycle:'biennial', months:24, hrs:32, online_hrs:10,  online_pct:31,  ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:null, even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'Puerto Rico; Ley Núm. 194 de 1979' },
  { code:'VI', key:'us_vi_svmb', name:'US Virgin Islands Board of Veterinary Medicine',  abbr:'USVI BVM', website:'https://www.dlca.vi.gov',
    cycle:'biennial', months:24, hrs:15, online_hrs:null,online_pct:100, ss_hrs:null, pm_hrs:null, per_day:null, carryover:false, carryover_max:null, cycle_end:null, even_only:false, odd_only:false, birth:false,
    mandatory_topics_enabled:false, notes:'US Virgin Islands; Code Title 27' },
];

// ─── Mandatory topic rules (one row per state × topic × trigger) ──────────────
const MANDATORY_TOPICS = [
  // Arizona — opioid/substance use disorder (DEA registrants + Sched-II prescribers only)
  { state_key:'us_az_svmb', topic:'Substance Use Disorder / Addiction',  min_per_cycle:3,  trigger:'CONDITIONAL_ROLE', attr_key:'holds_dea_registration', attr_val:'1', format_constraint:'Board/RACE approved; max 5hr non-interactive separately' },
  // Colorado — delegation & supervision (new from 2026)
  { state_key:'us_co_svmb', topic:'Delegation and Supervision',            min_per_cycle:2,  trigger:'ALL_ACTIVE',       attr_key:null, attr_val:null, effective_from_year:2026, format_constraint:'Board or RACE approved' },
  // Florida — legend drugs
  { state_key:'us_fl_svmb', topic:'Dispensing Legend Drugs',               min_per_cycle:1,  trigger:'ALL_ACTIVE',       attr_key:null, attr_val:null },
  // Florida — state law & rules
  { state_key:'us_fl_svmb', topic:'Florida Law and Rules',                 min_per_cycle:2,  trigger:'ALL_ACTIVE',       attr_key:null, attr_val:null },
  // Georgia — GA laws & professionalism (waived if not practising in GA)
  { state_key:'us_ga_svmb', topic:'Georgia Laws, Rules and Professionalism', min_per_cycle:2, trigger:'LOCATION_BASED', attr_key:'practises_in_jurisdiction', attr_val:'1', must_be_live:true, format_constraint:'Minimum 1hr must be live/interactive' },
  // Michigan — medical records
  { state_key:'us_mi_svmb', topic:'Medical Records',                       min_per_cycle:1,  trigger:'ALL_ACTIVE' },
  // Michigan — vet law / controlled substances
  { state_key:'us_mi_svmb', topic:'Veterinary Law / Controlled Substances Law', min_per_cycle:1, trigger:'ALL_ACTIVE' },
  // Nebraska — opioids
  { state_key:'us_ne_svmb', topic:'Opioids and PDMP',                     min_per_cycle:3,  trigger:'ALL_ACTIVE',       notes:'Includes 0.5hr on Prescription Drug Monitoring Programme (PDMP)' },
  // New Hampshire — medical records/law/ethics
  { state_key:'us_nh_svmb', topic:'Medical Records, Law or Ethics',        min_per_cycle:1,  trigger:'ALL_ACTIVE' },
  // New Hampshire — opioid prescribing
  { state_key:'us_nh_svmb', topic:'Opioid Use or Prescribing',             min_per_cycle:1,  trigger:'ALL_ACTIVE' },
  // New Jersey — opioid abuse
  { state_key:'us_nj_svmb', topic:'Opioid Drugs — Abuse, Addiction, Diversion', min_per_cycle:1, trigger:'ALL_ACTIVE' },
  // New York — controlled substances
  { state_key:'us_ny_svmb', topic:'Controlled Substances — Use, Misuse, Documentation, Safeguarding, Prescribing', min_per_cycle:2, trigger:'ALL_ACTIVE', format_constraint:'NY-approved provider only (not RACE)' },
  // North Carolina — controlled substance abuse
  { state_key:'us_nc_svmb', topic:'Abuse of Controlled Substances',        min_per_year:2,   trigger:'ALL_ACTIVE' },
  // Oklahoma — CDS law or practice act
  { state_key:'us_ok_svmb', topic:'Controlled Dangerous Substances Law or Practice Act Review', min_per_year:2, trigger:'ALL_ACTIVE', notes:'Attending board meeting also satisfies' },
  // Oklahoma — opioid
  { state_key:'us_ok_svmb', topic:'Opioid Pain Management / Use / Addiction', min_per_year:1, trigger:'ALL_ACTIVE' },
  // Oregon — antibiotic stewardship
  { state_key:'us_or_svmb', topic:'Judicious Antibiotic Use and Appropriate Anaesthesia/Analgesia', min_per_cycle:1, trigger:'ALL_ACTIVE' },
  // South Carolina — CDS prescribing/monitoring
  { state_key:'us_sc_svmb', topic:'Prescribing and Monitoring Controlled Substances', min_per_cycle:2, trigger:'ALL_ACTIVE' },
  // Texas — opioid
  { state_key:'us_tx_svmb', topic:'Opioid Training',                       min_per_cycle:2,  trigger:'ALL_ACTIVE',       notes:'2hr every 2 years; embedded in annual renewal' },
  // Utah — opioid
  { state_key:'us_ut_svmb', topic:'Opioid-Related CE',                     min_per_cycle:null, trigger:'ALL_ACTIVE',     notes:'Specific hours — verify with Utah DOPL' },
  // Washington — suicide prevention (one-time)
  { state_key:'us_wa_svmb', topic:'Suicide Prevention',                    min_per_cycle:3,  trigger:'ONE_TIME',        notes:'One-time 3hr requirement; specific approved providers' },
  // Wyoming — controlled substances
  { state_key:'us_wy_svmb', topic:'Controlled Substances',                 min_per_cycle:3,  trigger:'ALL_ACTIVE' },
];

// ─── Run migration ────────────────────────────────────────────────────────────
function run() {
  const db = getDb();
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Make sure schema is migrated first (from init.js)
  const { initDb } = require('./init');
  // initDb is idempotent-ish but we don't want to re-seed — just ensure migrations ran
  // The applyMigrations is called at the start of initDb, but since DB already exists
  // the seed block is skipped. So we call it directly:
  const applyMigrFn = require('./init').applyMigrations;
  if (typeof applyMigrFn === 'function') applyMigrFn(db);

  const stmtAuth = db.prepare('SELECT authority_id FROM registration_authorities WHERE authority_key = ?');
  const stmtRole = db.prepare('SELECT role_id FROM professional_roles WHERE role_key = ?');
  const stmtRule = db.prepare('SELECT rule_id FROM cpd_requirement_rules WHERE authority_id = ? AND role_id = ?');
  const stmtTopic = db.prepare('SELECT topic_rule_id FROM mandatory_topic_rules WHERE rule_id = ? AND topic_name = ?');

  const insAuth = db.prepare(`INSERT OR IGNORE INTO registration_authorities
    (authority_id, authority_key, authority_name, authority_abbreviation, country, sector,
     website_url, uses_hours, unit_label, units_per_hour, split_bar_concept,
     mandatory_topics_enabled, cpd_term, cpd_term_full)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const insRole = db.prepare(`INSERT OR IGNORE INTO professional_roles
    (role_id, role_key, authority_id, role_name, role_abbreviation, sector, tier, is_statutorily_registered)
    VALUES (?,?,?,?,?,?,?,?)`);

  const insRule = db.prepare(`INSERT OR IGNORE INTO cpd_requirement_rules
    (rule_id, authority_id, role_id, effective_from, effective_to,
     cycle_type, cycle_length_months, cycle_start_anchor,
     total_units_required, mandatory_topics_enabled,
     carry_over_allowed, carry_over_max_units,
     max_management_units, max_self_study_no_test,
     max_units_per_day,
     regime_type, approval_standard,
     max_online_hours, max_online_percent,
     renewal_even_year_only, birth_month_renewal, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const insTopic = db.prepare(`INSERT OR IGNORE INTO mandatory_topic_rules
    (topic_rule_id, rule_id, topic_name, topic_category,
     min_units_per_cycle, min_units_per_year,
     must_be_live, applies_if_holds_dea,
     trigger_type, trigger_attribute_key, trigger_attribute_value,
     effective_from_year, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const doAll = db.transaction(() => {
    const ruleIdMap = {}; // state_key → rule_id

    for (const s of US_STATES) {
      // 1. Authority
      let authId = stmtAuth.get(s.key)?.authority_id;
      if (!authId) {
        authId = uuid();
        insAuth.run(
          authId, s.key, s.name, s.abbr, 'US', 'veterinary',
          s.website || null, 1, 'hours', 1.0, 'online',
          s.mandatory_topics_enabled ? 1 : 0,
          'CE', 'Continuing Education'
        );
        console.log(`[MIGRATE] Added authority: ${s.key}`);
      }

      // 2. DVM Role
      const roleKey = `dvm_${s.code.toLowerCase()}`;
      let roleId = stmtRole.get(roleKey)?.role_id;
      if (!roleId) {
        roleId = uuid();
        insRole.run(roleId, roleKey, authId, 'Doctor of Veterinary Medicine', 'DVM', 'veterinary', 'generalist', 1);
        console.log(`[MIGRATE] Added role: ${roleKey}`);
      }

      // 3. Rule
      let ruleId = stmtRule.get(authId, roleId)?.rule_id;
      if (!ruleId) {
        ruleId = uuid();
        const cycleType = s.cycle === 'triennial' ? 'triennial' : s.cycle === 'biennial' ? 'biennial' : 'annual';
        insRule.run(
          ruleId, authId, roleId,
          '2024-01-01', null,
          cycleType, s.months, 'calendar',
          s.hrs, s.mandatory_topics_enabled ? 1 : 0,
          s.carryover ? 1 : 0, s.carryover_max || null,
          s.pm_hrs || null,
          s.ss_hrs || null,
          s.per_day || null,
          'US_HOURS_BASED',
          s.approval_standard || 'RACE_OR_BOARD',
          s.online_hrs || null,
          s.online_pct < 100 ? s.online_pct : null,
          s.even_only ? 1 : 0,
          s.birth ? 1 : 0,
          s.notes || null
        );
        console.log(`[MIGRATE] Added rule: ${s.key}:${roleKey}`);
      }

      ruleIdMap[s.key] = ruleId;
    }

    // 4. Mandatory topic rules
    for (const t of MANDATORY_TOPICS) {
      const ruleId = ruleIdMap[t.state_key];
      if (!ruleId) continue;
      if (stmtTopic.get(ruleId, t.topic)?.topic_rule_id) continue; // already exists
      insTopic.run(
        uuid(), ruleId, t.topic, 'mandatory',
        t.min_per_cycle || null,
        t.min_per_year || null,
        t.must_be_live ? 1 : 0,
        t.trigger === 'CONDITIONAL_ROLE' && t.attr_key === 'holds_dea_registration' ? 1 : 0,
        t.trigger || 'ALL_ACTIVE',
        t.attr_key || null,
        t.attr_val || null,
        t.effective_from_year || null,
        t.notes || t.format_constraint || null
      );
      console.log(`[MIGRATE] Added topic: ${t.state_key} — ${t.topic}`);
    }
  });

  doAll();
  db.close();
  console.log('[MIGRATE] US rules migration complete.');
}

// Export for use as a module or run directly
module.exports = { run };
if (require.main === module) run();
