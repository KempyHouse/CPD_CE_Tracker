'use strict';
// ── API Cache — populated on page load from the backend ───────────────────
const API_CACHE = {
  authorities: [],        // from GET /api/authorities
  roles: {},              // authority_key → role[]
  rules: {},              // 'authority_key:role_key' → rule obj with topics
  currentTopics: [],      // detailed topics for the active rule
  practitioner: null,     // from GET /api/practitioners/me
  cycle: null,            // from GET /api/cycles/current
};
// State overrides — US/CA regional variations (to be seeded to DB as rule rows in next sprint)
const STATE_OVERRIDES={ca:{required:75,cycle:'biennial'},tx:{required:16,cycle:'annual'},ny:{required:24,cycle:'biennial'},fl:{required:30,cycle:'biennial'},on:{required:40,cycle:'annual'}};
const STATE_OPTIONS={
  us_avma:[{v:'',l:'— No state override —'},{v:'ca',l:'California (75 hrs / 2yr)'},{v:'tx',l:'Texas (16 hrs / yr)'},{v:'ny',l:'New York (24 hrs / 2yr)'},{v:'fl',l:'Florida (30 hrs / 2yr)'}],
  us_nbdhe:[{v:'',l:'— No state override —'},{v:'ca',l:'California (75 hrs / 2yr)'},{v:'tx',l:'Texas (16 hrs / yr)'},{v:'ny',l:'New York (24 hrs / 2yr)'},{v:'fl',l:'Florida (30 hrs / 2yr)'}],
  ca_cvma:[{v:'',l:'— No province override —'},{v:'on',l:'Ontario (40 hrs / yr)'}],
};

// ── UK/RCVS Jurisdiction Auto-determination ────────────────────────────────
// Returns null if we can't auto-determine (non-UK or non-RCVS authority),
// or an object with the auto-derived rule values.
function deriveJurisdictionRules(sector, country, role, status) {
  // Only apply UK RCVS auto-rules
  if (country !== 'uk_rcvs') return null;

  const nonPractising = ['non_practising', 'removed', 'suspended', 'not_on_register'].includes(status);
  const practising    = ['active', 'full', 'practising'].includes(status);

  if (nonPractising) {
    return {
      cycle: 'annual',            // cycle still tracked but hours = 0
      requiredHours: 0,
      carryOver: false,
      source: 'RCVS — Non-practising / removed (voluntary CPD only)',
      locked: true,
    };
  }

  if (practising) {
    const hoursMap = {
      vet_surgeon:        35,
      rvn:                15,
      student_rvn:         0,    // not yet required
      advanced_practitioner: 35, // same annual cycle; 5-yr designation tracked separately
    };
    const required = hoursMap[role] ?? null;  // null = role not in map, fall through to DB
    if (required === null) return null;        // unknown role → let DB rule decide
    return {
      cycle: 'annual',
      requiredHours: required,
      carryOver: false,  // RCVS: no carry-over
      source: `RCVS — Auto-determined: ${required} hrs/yr, Annual (1 Jan–31 Dec), no carry-over`,
      locked: true,
    };
  }

  return null; // unrecognised status → DB rule wins
}

// Returns true if the cycle type and required hours are auto-locked by jurisdiction rules
function isJurisdictionAutoLocked() {
  return !!deriveJurisdictionRules(S.sector, S.country, S.role, S.registrationStatus);
}
// ── State — authoritative widget data store ────────────────────────────────
const S={
  sector:'vet',country:'uk_rcvs',state:'',role:'vet_surgeon',
  registrationStatus:'active',registrationYear:'2020',
  // Authority/rule fields (set by configBuilder)
  authority:'RCVS',cpd_term:'CPD',cpd_term_full:'Continuing Professional Development',
  splitBarConcept:'structured',  // 'structured' | 'verifiable' | 'none'
  baseRequired:35,structuredMin:20,unitType:'hours',displayUnit:'hours',
  cycle:'annual',splitLabel:'Structured / Non-structured',topics:[],
  carryOver:false,carryOverPct:0,prevCompleted:0,
  pauseAllowed:true,pauseMax:6,pauseMonths:0,
  newGradRequired:0,proRata:false,regMonthsAgo:0,
  nonClinCap:null,deferral:false,nonPractisingExempt:false,spreadRule:null,wetlabMultiplier:null,
  // Compliance / first-renewal / caps
  firstRenewalExempt:false,    // rule.first_renewal_ce_exempt — entire first renewal is CE-free
  firstRenewalProrataUnits:0,  // rule.first_renewal_prorata_units — reduced first-renewal hours (vs exempt)
  blsCreditCap:null,           // rule.bls_credit_cap — max BLS hrs credited (e.g. CO: 2)
  presenterCreditCap:null,     // rule.presenter_credit_cap — max presenter/teaching hrs (e.g. CO: 6)
  ceWindowMonths:null,         // rule.ce_window_months — rolling CE window (e.g. CT: 24 months despite annual renewal)
  selfStudyPermitted:true,     // rule.self_study_permitted — explicit self-study exclusion (e.g. CT RDH)
  maxSelfStudyNoTest:null,     // rule.max_self_study_no_test — DE Type A cap (non-interactive, no exam)
  maxSelfStudyCombined:null,   // rule.max_self_study_with_test — DE combined Type A+B cap
  cprRequiredNonCpe:false,     // rule.cpr_required_non_cpe — CPR renewal condition (earns 0 CE/CPE credit)
  // Progress (from cycle / sliders)
  completed:20,structuredDone:12,nonClinDone:0,
  // Reflection lifecycle
  reflectionRequired:false,  // gated by rule: reflection_required_for_compliance
  reflectedDone:0,           // hours where stage='reflected'
  // Display prefs
  showTopics:true,showSplit:true,showCycle:true,compact:false,
  hasMandatoryTopics:true,hasDEA:false,cycleStart:'2026-01-01',
  isStatutorilyRegistered:true,tier:'generalist',
  // Authority UI labels (from ui_labels JSON)
  uiLabels:{},unitShort:'hrs',
};
const CIRC=2*Math.PI*45;

// ── API helpers ────────────────────────────────────────────────────────────
async function apiFetch(path){const r=await fetch(path);if(!r.ok)throw new Error(`API ${path} → ${r.status}`);return r.json()}

// ── Config Builder: converts DB rule → S fields ────────────────────────────
function configBuilder(authorityKey,roleKey){
  const auth=API_CACHE.authorities.find(a=>a.authority_key===authorityKey);
  const cacheKey=`${authorityKey}:${roleKey}`;
  const rule=API_CACHE.rules[cacheKey];
  if(!auth||!rule)return null;
  const cycleMap={annual:'annual',biennial:'biennial',triennial:'triennial','5_year':'5year',rolling_3:'rolling3'};
  const cycleType=cycleMap[rule.cycle_type]||rule.cycle_type;
  const nonClinCap=rule.max_non_clinical_units
    ?{max:rule.max_non_clinical_units,pct:rule.max_non_clinical_percent||0,label:`${rule.max_non_clinical_percent||'?'}% cap (${auth.split_label||'non-clinical'})`}
    :null;
  const spreadRule=rule.spread_rule_units
    ?{minUnits:rule.spread_rule_units,windowMonths:rule.spread_rule_months,label:`${rule.spread_rule_units} hrs min / any ${rule.spread_rule_months/12}yr window`}
    :null;
  const topics=(rule.topics||[]).map(t=>t.topic_name);
  const uiLabels=auth.ui_labels||(auth.ui_labels_parsed)||{};
  return{
    authority:rule.authority_abbreviation||auth.authority_abbreviation,
    cpd_term:auth.cpd_term||'CPD',
    cpd_term_full:auth.cpd_term_full||'Continuing Professional Development',
    unitType:auth.unit_label||'hours',
    splitLabel:auth.split_label||'',
    splitBarConcept:auth.split_bar_concept||'structured',
    uiLabels,
    unitShort:uiLabels.unit_short||auth.unit_label||'hrs',
    baseRequired:rule.total_units_required||0,
    structuredMin:rule.min_structured_units||rule.min_verifiable_units||0,
    cycle:cycleType,
    topics,
    hasMandatoryTopics:!!(rule.mandatory_topics_enabled||auth.mandatory_topics_enabled),
    reflectionRequired:!!rule.reflection_required_for_compliance,
    carryOver:!!rule.carry_over_allowed,carryOverPct:0,
    pauseAllowed:!!rule.pause_allowed,pauseMax:rule.pause_max_months||0,
    newGradRequired:rule.new_graduate_reduced_units||0,
    proRata:!!rule.pro_rata_for_part_year,
    nonClinCap,deferral:!!rule.deferral_allowed,
    nonPractisingExempt:!!rule.non_practising_exempt,
    spreadRule,wetlabMultiplier:null,
    isStatutorilyRegistered:rule.is_statutorily_registered!==0,
    tier:rule.tier||'generalist',
    firstRenewalExempt:!!rule.first_renewal_ce_exempt,
    firstRenewalProrataUnits:rule.first_renewal_prorata_units||0,
    blsCreditCap:rule.bls_credit_cap||null,
    presenterCreditCap:rule.presenter_credit_cap||null,
    ceWindowMonths:rule.ce_window_months||null,
    selfStudyPermitted:rule.self_study_permitted!==0,
    maxSelfStudyNoTest:rule.max_self_study_no_test||null,
    maxSelfStudyCombined:rule.max_self_study_with_test||null,
    cprRequiredNonCpe:!!rule.cpr_required_non_cpe,
  };
}

// ── Load all data from API on init ─────────────────────────────────────────
async function loadFromAPI(){
  try{
    // Parallel: authorities + practitioner + cycle + all rules
    const[authorities,allRules,practitioner,cycle]=await Promise.all([
      apiFetch('/api/authorities'),
      apiFetch('/api/rules'),
      apiFetch('/api/practitioners/me').catch(()=>null),
      apiFetch('/api/cycles/current').catch(()=>null),
    ]);
    API_CACHE.authorities=authorities;
    API_CACHE.practitioner=practitioner;
    API_CACHE.cycle=cycle;
    // Build rules + roles cache from flat rules list
    for(const rule of allRules){
      const key=`${rule.authority_key}:${rule.role_key}`;
      API_CACHE.rules[key]=rule; // topics attached after next call if needed
      if(!API_CACHE.roles[rule.authority_key])API_CACHE.roles[rule.authority_key]=[];
      if(!API_CACHE.roles[rule.authority_key].find(r=>r.role_key===rule.role_key)){
        API_CACHE.roles[rule.authority_key].push({
          role_key:rule.role_key,role_name:rule.role_name,
          tier:rule.tier,is_statutorily_registered:rule.is_statutorily_registered,
          role_abbreviation:rule.role_abbreviation,sector:rule.sector,
        });
      }
    }
    // Load topics for the active rule
    if(cycle&&cycle.rule_id){
      const activeRuleKey=`${cycle.authority_key}:${cycle.role_key}`;
      if(!API_CACHE.rules[activeRuleKey]){
        try{API_CACHE.rules[activeRuleKey]=await apiFetch(`/api/rules/${cycle.rule_id}`);}catch(e){}
      }else if(!(API_CACHE.rules[activeRuleKey].topics)){
        try{const full=await apiFetch(`/api/rules/${cycle.rule_id}`);API_CACHE.rules[activeRuleKey]=full;}catch(e){}
      }
      API_CACHE.currentTopics=API_CACHE.rules[activeRuleKey]?.topics||[];
    }
    // Populate S from practitioner + cycle data
    const reg=practitioner?.registration;
    if(reg){
      const apiSector=reg.sector||'veterinary';
      S.sector=apiSector==='veterinary'?'vet':'dental';
      S.country=reg.authority_key||'uk_rcvs';
      S.role=reg.role_key||'vet_surgeon';
      S.registrationStatus=reg.registration_status||'active';
      S.hasDEA=!!reg.holds_dea_registration;
    }
    if(cycle){
      S.completed=cycle.units_completed||0;
      // Use the correct completed field based on the authority's split framework
      S.structuredDone=S.splitBarConcept==='verifiable'
        ?(cycle.verifiable_completed||0)
        :(cycle.structured_completed||0);
      S.nonClinDone=cycle.non_clinical_completed||0;
      S.cycleStart=cycle.cycle_start_date||'2026-01-01';
      S.reflectedDone=cycle.reflected_completed||0;
      S.reflectionRequired=!!cycle.reflection_required_for_compliance;
    }
    // Apply display settings
    const ds=practitioner?.demo_settings||{};
    if(ds.sector)S.sector=ds.sector;
    if(ds.cycle)S.cycle=ds.cycle;
    if(ds.baseRequired!=null)S.baseRequired=ds.baseRequired;
    if(ds.structuredMin!=null)S.structuredMin=ds.structuredMin;
    if(ds.prevCompleted!=null)S.prevCompleted=ds.prevCompleted;
    if(ds.pauseMonths!=null)S.pauseMonths=ds.pauseMonths;
    if(ds.regMonthsAgo!=null)S.regMonthsAgo=ds.regMonthsAgo;
    if(ds.registrationStatus)S.registrationStatus=ds.registrationStatus;
    if(ds.registrationYear!=null)S.registrationYear=ds.registrationYear;
    if(ds.hasMandatoryTopics!==undefined)S.hasMandatoryTopics=ds.hasMandatoryTopics;
    if(ds.showSplit!==undefined)S.showSplit=ds.showSplit;
    if(ds.hasDEA!==undefined)S.hasDEA=ds.hasDEA;
    // display always defaults to show-all: if(ds.showTopicsPanel!==undefined)S.showTopics=ds.showTopicsPanel;
    // if(ds.showCycleStrip!==undefined)S.showCycle=ds.showCycleStrip;
    // if(ds.compactMode!==undefined)S.compact=ds.compactMode;
    if(ds.proRata!==undefined)S.proRata=ds.proRata;
    if(ds.cycleStart)S.cycleStart=ds.cycleStart;
  }catch(e){
    console.warn('[API] loadFromAPI failed, using defaults:',e.message);
  }
}

// ── Populate dropdowns from API cache ─────────────────────────────────────
function updateCountryDropdown(){
  const dd=el('selCountry');if(!dd)return;
  const apiSector=S.sector==='vet'?'veterinary':'dental';
  const FLAG={GB:'🇬🇧',US:'🇺🇸',AU:'🇦🇺',IE:'🇮🇪',NZ:'🇳🇿',ZA:'🇿🇦',CA:'🇨🇦',IN:'🇮🇳'};
  const opts=API_CACHE.authorities.filter(a=>a.sector===apiSector||a.sector==='both');
  dd.innerHTML=opts.map(a=>`<option value="${a.authority_key}"${a.authority_key===S.country?' selected':''}>${FLAG[a.country]||''} ${a.country_name||a.country} — ${a.authority_abbreviation}</option>`).join('');
  const valid=opts.some(a=>a.authority_key===S.country);
  if(!valid&&opts.length){S.country=opts[0].authority_key;dd.value=S.country}
}
function updateStateDropdown(){
  const dd=el('selState');if(!dd)return;
  const opts=STATE_OPTIONS[S.country];
  const disabled=!opts;
  dd.disabled=disabled;dd.style.opacity=disabled?'0.4':'1';dd.style.cursor=disabled?'not-allowed':'auto';
  if(disabled){dd.innerHTML='<option value="">— Not applicable for this jurisdiction —</option>';S.state='';}
  else{
    dd.innerHTML=opts.map(o=>`<option value="${o.v}">${o.l}</option>`).join('');
    const valid=opts.some(o=>o.v===S.state);if(!valid){S.state='';dd.value='';}
  }
}
function updateRoleDropdown(){
  const dd=el('selRole');if(!dd)return;
  const roles=API_CACHE.roles[S.country]||[];
  if(!roles.length){dd.innerHTML='<option value="">— No roles for this authority —</option>';return;}
  dd.innerHTML=roles.map(r=>{
    const hasRule=!!API_CACHE.rules[`${S.country}:${r.role_key}`];
    return`<option value="${r.role_key}"${r.role_key===S.role?' selected':''}${!hasRule?' disabled':''} title="${!hasRule?'No CPD rule defined for this role yet':''}">${r.role_name}${!hasRule?' — (no rule yet)':''}</option>`;
  }).join('');
  const cur=dd.querySelector(`option[value="${S.role}"]:not([disabled])`);
  if(!cur){
    const first=roles.find(r=>!!API_CACHE.rules[`${S.country}:${r.role_key}`]);
    if(first){S.role=first.role_key;dd.value=S.role;}
  }
}

// ── Apply preset from API cache ────────────────────────────────────────────
async function applyPreset(authorityKey){
  // Ensure roles for this authority are loaded
  if(!API_CACHE.roles[authorityKey]){
    try{
      const auth=await apiFetch(`/api/authorities/${authorityKey}`);
      API_CACHE.roles[authorityKey]=auth.roles||[];
    }catch(e){console.warn('[API] Failed to load roles for',authorityKey);}
  }
  // Ensure rule for this authority+role is loaded (fetches topics too)
  const cacheKey=`${authorityKey}:${S.role}`;
  if(!API_CACHE.rules[cacheKey]||!API_CACHE.rules[cacheKey].topics){
    try{
      const rule=await apiFetch(`/api/rules?authority=${authorityKey}&role=${S.role}`);
      if(rule&&rule.rule_id){
        // Fetch with topics
        const full=await apiFetch(`/api/rules/${rule.rule_id}`);
        API_CACHE.rules[cacheKey]=full;
      }else{
        // Role may not exist in this authority — find first available role+rule
        const roles=API_CACHE.roles[authorityKey]||[];
        const firstRole=roles.find(r=>API_CACHE.rules[`${authorityKey}:${r.role_key}`]);
        if(firstRole){S.role=firstRole.role_key;}
        const altKey=`${authorityKey}:${S.role}`;
        if(!API_CACHE.rules[altKey]||!API_CACHE.rules[altKey].topics){
          const altRule=await apiFetch(`/api/rules?authority=${authorityKey}&role=${S.role}`);
          if(altRule&&altRule.rule_id){
            const full=await apiFetch(`/api/rules/${altRule.rule_id}`);
            API_CACHE.rules[altKey]=full;
          }
        }
      }
    }catch(e){console.warn('[API] Failed to load rule for',authorityKey,S.role);}
  }
  const cfg=configBuilder(authorityKey,S.role);
  if(cfg){
    Object.assign(S,cfg);
    S.displayUnit=S.unitType;
    API_CACHE.currentTopics=API_CACHE.rules[`${authorityKey}:${S.role}`]?.topics||[];
  }
  syncControls();
}



// Helpers
function cycleMonthsFor(c){return{annual:12,biennial:24,triennial:36,'5year':60,rolling3:36}[c]||12}
function cycleMonths(){return cycleMonthsFor(S.cycle)}
function cycleEnd(){const d=new Date(S.cycleStart);d.setMonth(d.getMonth()+cycleMonths());d.setDate(d.getDate()-1);return d}
function daysLeft(){return Math.max(0,Math.ceil((cycleEnd()-new Date())/86400000))}
function isNewGrad(){const yr=parseInt(S.registrationYear);return(new Date().getFullYear()-yr)<=1}
function isUS(){return['us_avma','us_nbdhe'].includes(S.country)||['ca','tx','ny','fl'].includes(S.state)}
function uLbl(n){const v=n%1===0?n.toFixed(0):n.toFixed(1);const u=S.unitShort||(S.displayUnit==='hours'?'hrs':S.displayUnit==='points'?'pts':S.displayUnit==='ceus'?'CEUs':'cr');return v+' '+u}
function fmtDate(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
// Priority hierarchy → effective required
function effectiveRequired(){
  const status=S.registrationStatus;
  // Priority 0: jurisdiction auto-determination (overrides everything for locked authorities)
  const derived=deriveJurisdictionRules(S.sector,S.country,S.role,status);
  if(derived){
    let req=derived.requiredHours;
    // Still honour new-grad reduction within auto-determined cycle
    if(isNewGrad()&&S.newGradRequired>0&&req>0)req=S.newGradRequired;
    // Pro-rata still applies even for auto-determined authorities
    if(S.proRata&&S.regMonthsAgo>0){const total=cycleMonths();const rem=Math.max(0,total-S.regMonthsAgo);req=Math.round(req*rem/total)}
    if(status==='paused'&&S.pauseAllowed){const total=cycleMonths();const active=Math.max(0,total-S.pauseMonths);req=Math.round(req*active/total)}
    return Math.max(0,req);
  }
  // Legacy/non-auto path
  if(status==='non_practising'||status==='student')return 0;
  // First-renewal: full exempt (e.g. CA first renewal, CO ≤12 months)
  if(status==='first_renewal_exempt'||S.firstRenewalExempt)return 0;
  // First-renewal pro-rata (e.g. CO >12 months → 15 dental / 16 vet)
  if(status==='first_renewal_prorata'&&S.firstRenewalProrataUnits>0)return S.firstRenewalProrataUnits;
  // Inactive — CE waived
  if(status==='inactive')return 0;
  let req=S.baseRequired;
  const so=STATE_OVERRIDES[S.state];
  if(so&&so.required)req=so.required;
  if(isNewGrad()&&S.newGradRequired>0)req=S.newGradRequired;
  if(S.proRata&&S.regMonthsAgo>0){const total=cycleMonths();const rem=Math.max(0,total-S.regMonthsAgo);req=Math.round(req*rem/total)}
  if(status==='paused'&&S.pauseAllowed){const total=cycleMonths();const active=Math.max(0,total-S.pauseMonths);req=Math.round(req*active/total)}
  return Math.max(0,req)
}
function effectiveCycle(){const so=STATE_OVERRIDES[S.state];return so&&so.cycle?so.cycle:S.cycle}
function pct(req){return Math.min(100,Math.round((S.completed/req)*100))||0}
function complianceStatus(p){
  const status=S.registrationStatus;
  if(status==='non_practising')return'blue';
  if(status==='student')return'grey';
  if(p>=100)return'green';
  if(S.cycle==='rolling3')return'green';
  const now=new Date();const start=new Date(S.cycleStart);const total=cycleEnd()-start;
  const elapsed=now-start;const timePct=Math.min(100,Math.max(0,(elapsed/total)*100));
  if(p>=timePct-10)return'green';if(p>=timePct-30)return'amber';return'red'
}
function carryOverAvailable(){
  // Carry-over is never available for auto-locked jurisdictions (e.g. RCVS)
  if(deriveJurisdictionRules(S.sector,S.country,S.role,S.registrationStatus))return 0;
  if(!S.carryOver)return 0;
  const surplus=Math.max(0,S.prevCompleted-S.baseRequired);
  const cap=S.carryOverPct>0?Math.floor(S.baseRequired*S.carryOverPct):surplus;
  return Math.min(surplus,cap)
}
function syncControls(){
  setRng('numRequired','numRequiredVal',S.baseRequired);
  setRng('numStructMin','numStructMinVal',S.structuredMin);
  setRng('numCompleted','numCompletedVal',Math.min(S.completed,S.baseRequired));
  setRng('numStructDone','numStructDoneVal',Math.min(S.structuredDone,S.baseRequired));
  const cycSel=sel('selCycle');
  if(cycSel){cycSel.value=effectiveCycle();}
  // Lock/unlock cycle selector based on jurisdiction auto-derivation
  const locked=isJurisdictionAutoLocked();
  if(cycSel){cycSel.disabled=locked;cycSel.style.opacity=locked?'0.6':'1';cycSel.style.cursor=locked?'not-allowed':'auto';cycSel.title=locked?'Auto-determined from jurisdiction rules':''}
}
function setRng(id,vid,v){const e=el(id);if(!e)return;e.value=v;const ve=el(vid);if(ve)ve.textContent=v}
function el(id){return document.getElementById(id)}
function sel(id){return document.getElementById(id)}
// Persist slider changes back to API
function persistProgress(){
  fetch('/api/cycles/current',{method:'GET'})
    .then(r=>r.json())
    .then(cycle=>{
      if(!cycle||!cycle.cycle_id)return;
      fetch(`/api/cycles/${cycle.cycle_id}`,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({units_completed:S.completed,structured_completed:S.structuredDone,non_clinical_completed:S.nonClinDone})
      });
    }).catch(()=>{});
}

// ── Render ─────────────────────────────────────────────────────────────────
function render(){
  const req=effectiveRequired();const cyc=effectiveCycle();
  const p=pct(req);const cs=complianceStatus(p);
  const status=S.registrationStatus;const ng=isNewGrad();
  const fillColour=p>=100?'#2e7d52':cs==='amber'?'#d97706':cs==='red'?'#b91c1c':'#5c3fa3';
  // Profile ring sync
  const ringCirc=2*Math.PI*35;const rfg=el('ring-fg');
  if(rfg){rfg.style.strokeDasharray=ringCirc;rfg.style.strokeDashoffset=ringCirc-(p/100)*ringCirc}
  const ppct=el('profile-pct');if(ppct)ppct.textContent=p+'%';
  // CPD/CE term — dynamic from authority
  document.querySelectorAll('.cpd-term-label').forEach(e=>e.textContent=S.cpd_term||'CPD');
  // Badges
  const badges=el('w-badges');if(badges){
    badges.innerHTML='';
    if(ng&&S.newGradRequired>0)badges.innerHTML+='<span class="wpill-badge wpill-newgrad">🎓 New Graduate</span>';
    if(status==='specialist')badges.innerHTML+='<span class="wpill-badge wpill-specialist">🔬 Specialist</span>';
    if(status==='advanced')badges.innerHTML+='<span class="wpill-badge wpill-ap">✦ Advanced Practitioner</span>';
    if(!S.isStatutorilyRegistered)badges.innerHTML+='<span class="wpill-badge" style="background:#6b7280">Voluntary CPD</span>';
  }
  // Status banners
  const bannerEl=el('w-status-banner');if(bannerEl){
    if(status==='non_practising'){bannerEl.className='w-banner blue';bannerEl.classList.remove('hidden');bannerEl.textContent=`ℹ Non-practising — ${S.cpd_term} not required by this authority`}
    else if(status==='student'){bannerEl.className='w-banner grey';bannerEl.classList.remove('hidden');bannerEl.textContent=`ℹ Student registration — ${S.cpd_term} requirements begin after full registration`}
    else if(status==='inactive'){bannerEl.className='w-banner blue';bannerEl.classList.remove('hidden');bannerEl.textContent=`ℹ Inactive registration — CE not required during inactive renewal. You may NOT practise.`}
    else if(status==='first_renewal_exempt'||S.firstRenewalExempt){bannerEl.className='w-banner blue';bannerEl.classList.remove('hidden');bannerEl.textContent=`ℹ First renewal — CE exempt (registered within threshold). No CE required at this renewal.`}
    else if(status==='first_renewal_prorata'&&S.firstRenewalProrataUnits>0){bannerEl.className='w-banner amber';bannerEl.classList.remove('hidden');bannerEl.textContent=`🗓 First renewal — reduced requirement: ${uLbl(S.firstRenewalProrataUnits)} required (pro-rata)`}
    else if(status==='reactivating'){bannerEl.className='w-banner amber';bannerEl.classList.remove('hidden');bannerEl.textContent=`⚠ Reactivating — CE required for last active period AND inactive/expired period. Up to double the normal cycle requirement.`}
    else if(!S.selfStudyPermitted){bannerEl.className='w-banner amber';bannerEl.classList.remove('hidden');bannerEl.textContent=`⚠ Self-study (reading journals/books) is NOT a qualifying CE format for this role. Only live/interactive and approved online courses count.`}
    else if(S.cprRequiredNonCpe){bannerEl.className='w-banner blue';bannerEl.classList.remove('hidden');bannerEl.textContent=`ℹ CPR certification is required at renewal but earns ZERO CE credit. Ensure your CPR cert is current separately.`}
    else if(status==='paused'){bannerEl.className='w-banner amber';bannerEl.classList.remove('hidden');bannerEl.textContent=`⏸ Paused — reduced requirement: ${uLbl(req)} (${S.pauseMonths} months paused)`}
    else if(ng&&S.newGradRequired>0){bannerEl.className='w-banner amber';bannerEl.classList.remove('hidden');bannerEl.textContent='🎓 Reduced requirements apply in your first registration cycle'}
    else{bannerEl.classList.add('hidden')}
  }
  // Donut
  const dFill=el('dFill');const dStr=el('dStructured');
  const disabled=status==='non_practising'||status==='student';
  const donutWrap=el('donutWrap');if(donutWrap)donutWrap.classList.toggle('donut-disabled',disabled);
  const carryAmt=carryOverAvailable();const effectiveCompleted=Math.min(req,S.completed+carryAmt);
  const displayPct=req>0?Math.min(100,Math.round((effectiveCompleted/req)*100)):0;
  if(dFill){dFill.style.strokeDashoffset=CIRC-(displayPct/100)*CIRC;dFill.style.stroke=disabled?'#dce1ea':fillColour}
  if(dStr){const sp=req>0?Math.min(100,(S.structuredDone/req)*100):0;dStr.style.strokeDashoffset=CIRC-(sp/100)*CIRC;dStr.style.stroke=disabled?'#dce1ea':fillColour}
  const dPct=el('dPct');if(dPct)dPct.textContent=disabled?'–':displayPct+'%';
  // Stats
  const sComp=el('sCompleted');if(sComp)sComp.textContent=disabled?'—':uLbl(S.completed);
  const sReq=el('sRequired');if(sReq)sReq.textContent=disabled?'—':uLbl(req);
  const sRem=el('sRemaining');if(sRem){const rem=Math.max(0,req-S.completed);sRem.textContent=disabled?'—':(rem===0?'✓ Done':uLbl(rem));sRem.className='stat-val '+(rem===0?'success':cs==='red'?'danger':'amber')}
  const sCyc=el('sCycle');if(sCyc){
    const cycLbl={annual:'Annual',biennial:'Biennial',triennial:'3-year','5year':'5-year',rolling3:'Rolling 3yr'}[cyc]||cyc;
    // For jurisdictions with annual renewal but longer CE window (e.g. CT: annual renewal + 24-month window)
    const windowNote=S.ceWindowMonths&&S.ceWindowMonths!==cycleMonths()?` (${S.ceWindowMonths}-month CE window)`:'';
    sCyc.textContent=cycLbl+windowNote+' ('+S.authority+')'}
  // Split bar — hideSplit if paraprofessional / student tier
  const wSplit=el('wSplit');if(wSplit){
    // Hide split when: no minimum required, paraprofessional tier, or explicit 'none' concept
    const hideSplit=S.tier==='paraprofessional'||S.tier==='new_graduate'||S.structuredMin===0||S.splitBarConcept==='none';
    wSplit.classList.toggle('hidden',!S.showSplit||S.compact||hideSplit);
    if(S.showSplit&&!S.compact&&!hideSplit&&req>0){
      const isVerifiable=S.splitBarConcept==='verifiable';
      const totalPct=Math.min(100,(S.completed/req)*100);
      const sPct=Math.min(100,(S.structuredDone/req)*100);
      const nonVerifPct=isVerifiable?Math.min(100,Math.max(0,((S.nonClinDone||0)/req)*100)):0;
      const barA=el('splitBarA');const barB=el('splitBarB');
      if(barA){barA.style.left='0';barA.style.width=sPct+'%';barA.style.background=fillColour;barA.style.opacity='1';}
      if(barB){
        if(isVerifiable){
          // 3-segment: A=verifiable (solid), B=non-verifiable (amber after A)
          const capExceeded=S.nonClinCap&&S.nonClinDone>S.nonClinCap.max;
          barB.style.left=sPct+'%';
          barB.style.width=nonVerifPct>0?nonVerifPct+'%':'0';
          barB.style.background=capExceeded?'#b91c1c':'#d97706';
          barB.style.opacity=nonVerifPct>0?'0.75':'0';
        }else{
          // 2-segment: A=structured (solid), B=non-structured (faded, after A)
          barB.style.left=sPct+'%';
          barB.style.width=Math.max(0,totalPct-sPct)+'%';
          barB.style.background=fillColour;
          barB.style.opacity='0.2';
        }
      }
      el('splitLbl').textContent=S.splitLabel;
      const deficit=S.structuredDone<S.structuredMin;
      const concept=S.splitLabel.split('/')[0].trim().toLowerCase();
      el('splitVal').textContent=uLbl(S.structuredDone)+' / '+uLbl(S.structuredMin)+' '+concept;
      el('splitVal').className='split-hdr-val'+(deficit?' amber':'');
      // Chip: spread rule (structured) or non-verifiable cap warning (verifiable)
      const sc=el('spreadChip');if(sc){
        if(S.spreadRule){
          sc.classList.remove('hidden');sc.className='split-chip '+(S.structuredDone>=S.spreadRule.minUnits?'ok':'warn');
          sc.textContent=(S.structuredDone>=S.spreadRule.minUnits?'✓ ':'⚠ ')+S.spreadRule.label;
        }else if(isVerifiable&&S.nonClinCap&&S.nonClinDone>0){
          const over=S.nonClinDone>S.nonClinCap.max;
          sc.classList.remove('hidden');sc.className='split-chip '+(over?'warn':'ok');
          sc.textContent=(over?'⚠ Cap exceeded: ':'◐ Non-verifiable: ')+uLbl(S.nonClinDone)+' / '+uLbl(S.nonClinCap.max);
        }else{sc.classList.add('hidden');}
      }
    }
  }
  // Non-clinical cap bar — hide for verifiable authorities (cap already shown in split chip)
  const wNC=el('wNonClin');if(wNC){
    const showNC=S.nonClinCap&&!S.compact&&S.splitBarConcept!=='verifiable';
    if(showNC){wNC.classList.remove('hidden');const over=S.nonClinDone>S.nonClinCap.max;el('ncLbl').textContent=S.nonClinCap.label;el('ncVal').textContent=uLbl(S.nonClinDone)+' / '+uLbl(S.nonClinCap.max);el('ncVal').className='nonclin-val'+(over?' over':'');const ncPct=Math.min(100,(S.nonClinDone/req)*100);const ncCap=Math.min(100,(S.nonClinCap.max/req)*100);el('ncBar').style.width=Math.min(ncPct,ncCap)+'%';el('ncBar').style.background=over?'#b91c1c':fillColour;el('ncBarOver').style.width=over?Math.min(ncPct-ncCap,100-ncCap)+'%':'0%';}
    else wNC.classList.add('hidden');
  }
  // Carry-over chip
  const wCarry=el('wCarry');if(wCarry){
    if(carryAmt>0&&!S.compact){wCarry.classList.remove('hidden');el('carryAmt').textContent=uLbl(carryAmt)}
    else wCarry.classList.add('hidden')
  }
  // Reflection bar — shown for RCVS/GDC where reflection gates compliance
  const wReflect=el('wReflect');
  if(wReflect){
    if(S.reflectionRequired&&!S.compact){
      wReflect.classList.remove('hidden');
      const rDone=S.reflectedDone;
      const rPct=Math.min(100,(rDone/req)*100);
      const recPct=Math.min(100,(S.completed/req)*100);
      const rCompliant=rDone>=req;
      // Recorded bar (total hours — grey overlay)
      const barRec=el('barRecorded');
      if(barRec){barRec.style.width=recPct+'%';barRec.style.background='rgba(255,255,255,0.12)';}
      // Reflected bar (compliant portion — teal/amber based on completion)
      const barRef=el('barReflected');
      if(barRef){barRef.style.width=rPct+'%';barRef.style.background=rCompliant?'#14b8a6':fillColour;}
      // Labels
      const refLbl=el('reflectLbl');if(refLbl)refLbl.textContent='Reflected';
      const refVal=el('reflectVal');
      if(refVal){
        refVal.textContent=uLbl(rDone)+' / '+uLbl(req)+' reflected';
        refVal.className='reflect-val'+(rCompliant?'':' amber');
      }
      // Compliance gate chip
      const refChip=el('reflectGateChip');
      if(refChip){
        refChip.classList.remove('hidden');
        refChip.className='split-chip'+(rCompliant?' ok':' warn');
        refChip.textContent=rCompliant?'✓ Reflection complete':'⏳ Reflection needed for compliance';
      }
    } else {
      wReflect.classList.add('hidden');
      const refChip=el('reflectGateChip');if(refChip)refChip.classList.add('hidden');
    }
  }
  // Topics — bar row design (scales to any number of topics, mobile-safe)
  const wTopics=el('wTopics');if(wTopics){
    const show=S.showTopics&&!S.compact;wTopics.classList.toggle('hidden',!show);
    if(show){
      const topicList=S.topics.length?S.topics:['Clinical skills','Practice management','Professional development'];
      const topicDetails=API_CACHE.currentTopics||[];
      const perTopic=req/topicList.length;let done=0;
      const now2=new Date();const start2=new Date(S.cycleStart);
      const timePct2=Math.min(100,Math.max(0,((now2-start2)/(cycleEnd()-start2))*100));
      const splitLabel1=(S.uiLabels&&S.uiLabels.split_label_positive)||S.splitLabel.split('/')[0].trim()||'Structured';
      el('topicsList').innerHTML=topicList.map((t)=>{
        const td=topicDetails.find(x=>x.topic_name===t)||{};
        const minU=td.min_units_per_cycle||perTopic;
        // Approximate per-topic completion from overall structured progress
        const topicDone=Math.min(minU,(S.structuredDone/Math.max(req,1))*minU*1.15);
        const barPct=Math.min(100,Math.round((topicDone/minU)*100));
        const isDone=topicDone>=minU;if(isDone)done++;
        const isAtRisk=!isDone&&timePct2>55&&barPct<35;
        const sc=isDone?'topic-ok':isAtRisk?'topic-risk':'topic-warn';
        const shortfall=isDone?'':uLbl(+(minU-topicDone).toFixed(1));
        const verifiableChip=S.splitBarConcept==='verifiable'&&isDone?` · ${splitLabel1}`:'';
        const chipText=isDone?`✓ Done${verifiableChip}`:isAtRisk?`✗ Needs ${shortfall}`:`⚠ Needs ${shortfall}`;
        const liveFlag=td.must_be_live?'<span class="topic-flag">LIVE</span>':'';
        const spotlight=isAtRisk?' topic-bar-row--spotlight':'';
        return`<div class="topic-bar-row${spotlight}">
  <div class="tbr-top"><span class="tbr-name">${t}${liveFlag}</span><span class="tbr-chip ${sc}">${chipText}</span></div>
  <div class="tbr-bar-wrap"><div class="tbr-track"><div class="tbr-fill ${sc}" style="width:${barPct}%"></div></div><span class="tbr-count">${uLbl(+topicDone.toFixed(1))} / ${uLbl(minU)}</span></div>
</div>`;
      }).join('');
      el('topicsCount').textContent=done+' of '+topicList.length+' met';
    }
  }
  // Compliance
  const wC=el('wCompliance');if(wC){
    wC.className='w-compliance c-'+cs;
    const labels=S.uiLabels||{};
    const splitDeficit=S.structuredMin>0&&S.structuredDone<S.structuredMin;
    const capOver=S.splitBarConcept==='verifiable'&&S.nonClinCap&&S.nonClinDone>S.nonClinCap.max;
    // Build authority-specific amber/red messages
    let splitMsg='';
    if(splitDeficit){
      const shortfall=uLbl(+(S.structuredMin-S.structuredDone).toFixed(1));
      splitMsg=(labels.deficit_message||'You need {n} more '+S.splitLabel.split('/')[0].trim().toLowerCase()+' hrs').replace('{n}',shortfall);
    }
    const capMsg=capOver?(labels.cap_exceeded_message||'Cap exceeded — excess hours will not count'):'';
    const deficitAmber=capMsg||splitMsg||'At risk — falling behind schedule';
    const deficitRed=capMsg||splitMsg||'Action needed — critical gap';
    const txt={
      green:p>=100?`Complete — all ${S.cpd_term} requirements met`:`On track — good progress`,
      amber:deficitAmber,
      red:deficitRed,
      blue:`Non-practising — ${S.cpd_term} not required`,
      grey:'Student — requirements activate on full registration'
    };
    const badge={green:p>=100?'Complete ✓':'On Track',amber:'At Risk',red:'Action Needed',blue:'Not Required',grey:'Student'};
    el('cText').textContent=txt[cs];el('cBadge').textContent=badge[cs];
  }
  // Cycle strip
  const wCyc=el('wCycle');if(wCyc){
    const show=S.showCycle&&!S.compact;wCyc.classList.toggle('hidden',!show);
    if(show){
      if(cyc==='rolling3'){el('cycStart').textContent='Rolling window';el('cycEnd').textContent='Always current';el('cycDays').textContent='—';el('cycDays').style.color=''}
      else{const sd=new Date(S.cycleStart);el('cycStart').textContent=fmtDate(sd);el('cycEnd').textContent=fmtDate(cycleEnd());const dl=daysLeft();el('cycDays').textContent=dl+' days';el('cycDays').style.color=dl<60?'#b91c1c':dl<120?'#b45309':''}
    }
  }
  // Compact
  const cpdW=el('cpdWidget');if(cpdW)cpdW.classList.toggle('compact',S.compact);
  // Unit pills
  const UNIT_LABELS={hours:'Hours',ceus:'CEUs',credits:'Credits',points:'Points'};
  const pills=document.querySelectorAll('.unit-pill');
  pills.forEach(pill=>{
    if(pill.dataset.unit==='hours'){pill.textContent='Hours';pill.classList.add('active');pill.classList.remove('hidden');}
    else{if(S.unitType!=='hours'){pill.textContent=UNIT_LABELS[S.unitType]||S.unitType;pill.dataset.unit=S.unitType;pill.classList.remove('hidden');pill.classList.toggle('active',S.displayUnit===S.unitType);pills[0]&&pills[0].classList.toggle('active',S.displayUnit==='hours');}else{pill.classList.add('hidden');pill.classList.remove('active');}}
  });
  const deaRow=el('deaRow');if(deaRow)deaRow.classList.toggle('disabled',!isUS());
  const proRataRow=el('proRataRow');const regMonthsRow=el('regMonthsRow');
  if(proRataRow)proRataRow.classList.toggle('hidden',!S.proRata);
  if(regMonthsRow)regMonthsRow.classList.toggle('hidden',!S.proRata);
  const pauseRow=el('pauseMonthsRow');if(pauseRow)pauseRow.classList.toggle('hidden',S.registrationStatus!=='paused');
  // Hide the 'Previous cycle completed' slider for auto-locked jurisdictions — carry-over has no effect
  const prevCycleRow=el('prevCompletedRow');if(prevCycleRow)prevCycleRow.classList.toggle('hidden',isJurisdictionAutoLocked());
  if(window._syncSplitBtn)window._syncSplitBtn();
  renderRuleSummary()
}

// ── Active Rules transparency panel ────────────────────────────────────────
function renderRuleSummary(){
  const req=effectiveRequired();const cyc=effectiveCycle();
  const status=S.registrationStatus;const ng=isNewGrad();
  const so=STATE_OVERRIDES[S.state];
  const derived=deriveJurisdictionRules(S.sector,S.country,S.role,status);
  let priorityMsg='';
  if(derived){
    if(derived.requiredHours===0)
      priorityMsg=`Jurisdiction auto-determined: ${derived.source} — no CPD required`;
    else
      priorityMsg=`Jurisdiction auto-determined: ${derived.source}`;
  }else if(status==='non_practising')priorityMsg=`Priority 1 active: Non-practising — ${S.cpd_term} requirement waived (0 units required)`;
  else if(status==='student')priorityMsg=`Priority 2 active: Student registration — ${S.cpd_term} ring disabled until full registration`;
  else if(status==='paused')priorityMsg=`Priority 3 active: Paused (${S.pauseMonths} months) — requirement reduced pro-rata to ${req} ${S.unitType}`;
  else if(ng&&S.newGradRequired>0)priorityMsg=`Priority 4 active: New graduate — requirement reduced from ${S.baseRequired} to ${S.newGradRequired} ${S.unitType}`;
  else if(S.proRata&&S.regMonthsAgo>0)priorityMsg=`Priority 5 active: Pro-rata mid-year registrant (${S.regMonthsAgo} months ago) — requirement reduced to ${req} ${S.unitType}`;
  else if(so&&so.required)priorityMsg=`Priority 5 active: State override (${S.state.toUpperCase()}) — requirement set to ${so.required} hrs / ${so.cycle}`;
  const banner=el('rulePriorityBanner');const bannerTxt=el('rulePriorityText');
  if(banner){priorityMsg?banner.classList.remove('hidden'):banner.classList.add('hidden');if(bannerTxt)bannerTxt.textContent=priorityMsg}
  const unitSuffix={hours:'hrs',points:'pts',credits:'cr',ceus:'CEUs'}[S.unitType]||S.unitType;
  function row(lbl,val,cls){return`<div class="rule-item"><span class="rule-lbl">${lbl}</span><span class="rule-val${cls?' '+cls:''}"><span>${val}</span></span></div>`}
  const nonPract=status==='non_practising';const student=status==='student';
  const stateChip=so&&so.required?` <span class="rule-override ro-state">STATE OVERRIDE</span>`:'';
  const ngChip=ng&&S.newGradRequired>0?` <span class="rule-override ro-newgrad">NEW GRAD</span>`:'';
  const pauseChip=status==='paused'?` <span class="rule-override ro-paused">PAUSED</span>`:'';
  const proRataChip=S.proRata&&S.regMonthsAgo>0?` <span class="rule-override ro-prorata">PRO-RATA</span>`:'';
  const autoChip=derived?` <span class="rule-override ro-auto">AUTO</span>`:'';
  const exempt=nonPract||student||(derived&&derived.requiredHours===0);
  const reqDisplay=exempt?`0 ${unitSuffix} (exempt)${autoChip}`:`${req} ${unitSuffix}${autoChip||stateChip}${ngChip}${pauseChip}${proRataChip}`;
  const cycLabel={annual:'Annual (12 months)',biennial:'Biennial (24 months)',triennial:'Triennial (36 months)','5year':'5-year rolling',rolling3:'Rolling 3-year window'}[cyc]||cyc;
  const cycLabelFull=cycLabel+(derived?` <span class="rule-override ro-auto">AUTO-LOCKED</span>`:'');
  const carryAmt=carryOverAvailable();
  const carryVal=derived
    ?'Not permitted — RCVS: each CPD year is self-contained (no carry-over between years)'
    :S.carryOver?(carryAmt>0?`${carryAmt} ${unitSuffix} available from previous cycle`:'Permitted — no surplus from previous cycle')
    :'Not permitted by this authority';
  const grid=el('rulesGrid');if(!grid)return;
  grid.innerHTML=[
    row('Regulatory Authority',`${S.authority}`),

    row('Framework Term',`<strong>${S.cpd_term}</strong> (${S.cpd_term_full})`),
    row('Units Required / Cycle',reqDisplay,exempt?'muted':''),
    row('Cycle Type',cycLabelFull),
    row('Authority Unit Type',{hours:'Hours (hrs)',points:'Points (pts)',credits:`Credits (cr) — 1 credit = 1 hour${S.wetlabMultiplier?` | Wetlab earns ${S.wetlabMultiplier}× credits per contact hour`:''}`,ceus:'CE Units (CEUs) — 1 CEU = 1 hour'}[S.unitType]||S.unitType),
    row('Structured / Verifiable Min',S.structuredMin>0?`${S.structuredMin} ${unitSuffix} minimum ${S.splitLabel?'('+S.splitLabel.split('/')[0].trim()+')':''}`: 'None required',S.structuredMin>0?'':'muted'),
    row('Split Bar Label',S.splitLabel||'—',S.splitLabel?'':'muted'),
    row('Mandatory Topics',S.hasMandatoryTopics&&S.topics.length?S.topics.join(', '):'Not required for this authority / role',S.hasMandatoryTopics?'':'muted'),
    row('DEA / Prescribing CE',S.hasDEA&&isUS()?'Required — 3 hrs min / cycle':'Not applicable',S.hasDEA&&isUS()?'':'muted'),
    row('Non-clinical Cap',S.nonClinCap?`${S.nonClinCap.max} ${unitSuffix} max (${S.nonClinCap.pct}%) — ${S.nonClinCap.label}`:'No cap for this authority',S.nonClinCap?'amber':'muted'),
    row('Spread Rule',S.spreadRule?S.spreadRule.label:'No spread rule for this authority',S.spreadRule?'amber':'muted'),
    row('Carry-over',carryVal,derived||!S.carryOver?'muted':carryAmt>0?'purple':'muted'),
    row('Pause / Deferral',S.pauseAllowed?`Up to ${S.pauseMax} months — proportional hour reduction`:(S.deferral?'Deferral on application only':'Not permitted'),S.pauseAllowed?'':'muted'),
    row('Pro-rata (mid-year reg.)',S.proRata?'Applicable — formula: required × (months remaining ÷ cycle months)':'Not applicable for this authority',S.proRata?'amber':'muted'),
    row('New Graduate Rule',ng&&S.newGradRequired>0?`Reduced to ${S.newGradRequired} ${unitSuffix} (first cycle only)`:'Not in new graduate window',ng&&S.newGradRequired>0?'amber':'muted'),
    row('Statutory Registration',S.isStatutorilyRegistered?'Yes — mandatory CPD enforced':'No — voluntary CPD engagement only',S.isStatutorilyRegistered?'':'amber'),
    row('Registration Status',{active:'Active / Full — standard requirements apply',non_practising:`Non-practising — ${S.cpd_term} exempt`,student:'Student — CPD not yet required',paused:'Paused — pro-rata reduction applied',specialist:'Specialist — standard hours, specialist topics',advanced:'Advanced Practitioner — standard hours with AP badge'}[status]||status,nonPract||student?'amber':''),
    derived?row('Jurisdiction Rule Source',derived.source,'purple'):'',
  ].join('')
}



// ── Demo settings persistence ──────────────────────────────────────────────
let _pdsTimer=null;
function persistDemoSettings(){
  clearTimeout(_pdsTimer);
  _pdsTimer=setTimeout(()=>{
    fetch('/api/practitioners/me/settings',{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        sector:S.sector,cycle:S.cycle,
        baseRequired:S.baseRequired,structuredMin:S.structuredMin,
        prevCompleted:S.prevCompleted,pauseMonths:S.pauseMonths,regMonthsAgo:S.regMonthsAgo,
        registrationStatus:S.registrationStatus,registrationYear:S.registrationYear,
        hasMandatoryTopics:S.hasMandatoryTopics,showSplit:S.showSplit,hasDEA:S.hasDEA,
        showTopicsPanel:S.showTopics,showCycleStrip:S.showCycle,compactMode:S.compact,
        proRata:S.proRata,cycleStart:S.cycleStart,
      })
    }).catch(()=>{});
  },1200);
}
// Seed all form inputs from S state after load
function syncUIFromState(){
  const s=(id,v)=>{const e=el(id);if(e)e.value=v;};
  const sv=(id,v)=>{const e=el(id);if(e)e.textContent=v;};
  const st=(id,v)=>{const e=el(id);if(e)e.checked=!!v;};
  s('selCycle',S.cycle);s('selRegStatus',S.registrationStatus);s('selRegYear',S.registrationYear);
  s('selCycleStart',S.cycleStart);
  s('numRequired',S.baseRequired);sv('numRequiredVal',S.baseRequired);
  s('numStructMin',S.structuredMin);sv('numStructMinVal',S.structuredMin);
  s('numCompleted',S.completed);sv('numCompletedVal',parseFloat(S.completed).toFixed(1));
  s('numStructDone',S.structuredDone);sv('numStructDoneVal',parseFloat(S.structuredDone).toFixed(1));
  s('numNonClin',S.nonClinDone);sv('numNonClinVal',parseFloat(S.nonClinDone).toFixed(1));
  s('numPrevCompleted',S.prevCompleted);sv('numPrevCompletedVal',S.prevCompleted);
  s('numPauseMonths',S.pauseMonths);sv('numPauseMonthsVal',S.pauseMonths);
  s('numRegMonths',S.regMonthsAgo);sv('numRegMonthsVal',S.regMonthsAgo);
  st('togTopics',S.hasMandatoryTopics);st('togSplit',S.showSplit);st('togDEA',S.hasDEA);
  st('togShowTopics',S.showTopics);st('togShowCycle',S.showCycle);st('togCompact',S.compact);
  st('togProRata',S.proRata);
  document.querySelectorAll('.s-tab').forEach(t=>t.classList.toggle('active',t.dataset.sector===S.sector));
  document.querySelectorAll('.unit-pill').forEach(p=>p.classList.toggle('active',p.dataset.unit===(S.displayUnit==='hours'?'hours':'points')));
}
// Event wiring helpers
function onRng(id,vid,prop,cb){const e=el(id);if(!e)return;e.addEventListener('input',function(){S[prop]=parseFloat(this.value);const ve=el(vid);if(ve)ve.textContent=parseFloat(this.value).toFixed(this.step&&parseFloat(this.step)<1?1:0);if(cb)cb();persistDemoSettings();render()})}
function onSel(id,prop,cb){const e=el(id);if(!e)return;e.addEventListener('change',function(){S[prop]=this.value;if(cb)cb();persistDemoSettings();render()})}
function onTog(id,prop,cb){const e=el(id);if(!e)return;e.addEventListener('change',function(){S[prop]=this.checked;if(cb)cb();persistDemoSettings();render()})}
// Init after DOM ready
async function initWidget(){
  // Show loading state
  const w=el('cpdWidget');if(w)w.style.opacity='0.5';
  // Load all data from API
  await loadFromAPI();
  // Populate dropdowns from API cache
  updateCountryDropdown();updateStateDropdown();updateRoleDropdown();
  // Apply config for initial authority+role from DB
  await applyPreset(S.country);
  // Seed all form inputs from restored S state
  syncUIFromState();
  // Wire up event listeners
  el('selCountry')?.addEventListener('change',async function(){
    S.country=this.value;S.state='';
    await applyPreset(this.value);
    updateStateDropdown();updateRoleDropdown();render();
    // Persist authority change back to DB
    fetch('/api/practitioners/me/registration',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({authority_key:this.value,role_key:S.role})}).catch(()=>{});
  });
  el('selState')?.addEventListener('change',function(){S.state=this.value;render()});
  // selRegYear change handled below by calcRegMonths

  onSel('selRegStatus','registrationStatus');
  el('selRole')?.addEventListener('change',async function(){
    S.role=this.value;
    await applyPreset(S.country);render();
    fetch('/api/practitioners/me/registration',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({role_key:this.value})}).catch(()=>{});
  });
  onSel('selCycle','cycle');
  onRng('numRequired','numRequiredVal','baseRequired',()=>{S.structuredMin=Math.min(S.structuredMin,S.baseRequired)});
  onRng('numStructMin','numStructMinVal','structuredMin');
  onRng('numCompleted','numCompletedVal','completed',()=>setTimeout(persistProgress,1500));
  onRng('numStructDone','numStructDoneVal','structuredDone',()=>setTimeout(persistProgress,1500));
  onRng('numNonClin','numNonClinVal','nonClinDone');
  onRng('numPrevCompleted','numPrevCompletedVal','prevCompleted');
  onRng('numReflectedDone','numReflectedDoneVal','reflectedDone');

  onRng('numPauseMonths','numPauseMonthsVal','pauseMonths');
  onRng('numRegMonths','numRegMonthsVal','regMonthsAgo');
  onTog('togTopics','hasMandatoryTopics');
  onTog('togSplit','showSplit');
  onTog('togDEA','hasDEA');
  onTog('togShowTopics','showTopics');
  onTog('togShowCycle','showCycle');
  onTog('togCompact','compact');
  onTog('togProRata','proRata');
  el('selCycleStart')?.addEventListener('change',function(){S.cycleStart=this.value;persistDemoSettings();calcRegMonths();render()});

  // Auto-calculate months since registration from year + cycle start date
  function calcRegMonths(){
    const yr = parseInt(el('selRegYear')?.value);
    if (!yr || !S.cycleStart) return;
    // Use 1 Sep of the selected year as the assumed registration date (typical UK graduation)
    const regDate = new Date(yr, 8, 1); // month is 0-indexed; 8 = September
    const refDate  = new Date(S.cycleStart);
    let months = (refDate.getFullYear() - regDate.getFullYear()) * 12
               + (refDate.getMonth()    - regDate.getMonth());
    if (refDate.getDate() < regDate.getDate()) months--;
    months = Math.max(1, months);
    const slider = el('numRegMonths');
    const label  = el('numRegMonthsVal');
    if (slider) { slider.max = Math.max(parseInt(slider.max)||35, months); slider.value = months; }
    if (label)  label.textContent = months;
    S.regMonthsAgo = months;
  }
  // Wire selRegYear to also trigger auto-calc
  el('selRegYear')?.addEventListener('change', function(){ S.registrationYear=this.value; calcRegMonths(); persistDemoSettings(); render(); });
  calcRegMonths(); // run once on load

  // Sector tabs
  document.querySelectorAll('.s-tab').forEach(tab=>{
    tab.addEventListener('click',async()=>{
      document.querySelectorAll('.s-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');S.sector=tab.dataset.sector;
      const apiSector=S.sector==='vet'?'veterinary':'dental';
      const firstAuth=API_CACHE.authorities.find(a=>a.sector===apiSector||a.sector==='both');
      if(firstAuth)S.country=firstAuth.authority_key;
      S.state='';S.role='';
      updateCountryDropdown();await applyPreset(S.country);updateStateDropdown();updateRoleDropdown();
      persistDemoSettings();render();
    })
  });
  // Unit pills
  document.querySelectorAll('.unit-pill').forEach(pill=>{
    pill.addEventListener('click',()=>{S.displayUnit=pill.dataset.unit==='hours'?'hours':'points';render()})
  });
  document.querySelectorAll('a[href="#"]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
  // ── More menu toggle ──────────────────────────────────────────────────────
  const moreBtn=el('wMoreBtn');const moreMenu=el('wMoreMenu');
  if(moreBtn&&moreMenu){
    moreBtn.addEventListener('click',e=>{
      e.stopPropagation();
      const open=moreMenu.hidden;moreMenu.hidden=!open;moreBtn.setAttribute('aria-expanded',String(open));
    });
    document.addEventListener('click',()=>{if(moreMenu)moreMenu.hidden=true;});
  }
  // ── Topics toggle (syncs widget button <-> drawer checkbox) ───────────────
  function syncTopicsBtn(){
    const cb=el('togShowTopics');const btn=el('btnToggleTopics');
    if(btn&&cb){btn.setAttribute('aria-pressed',cb.checked?'true':'false');btn.textContent=cb.checked?'📋 Hide topics checklist':'📋 Show topics checklist';}
  }
  el('btnToggleTopics')?.addEventListener('click',()=>{
    const cb=el('togShowTopics');if(cb){cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));}
    syncTopicsBtn();if(el('wMoreMenu'))el('wMoreMenu').hidden=true;
  });
  el('togShowTopics')?.addEventListener('change',()=>syncTopicsBtn());
  syncTopicsBtn();
  // ── Split bar toggle (syncs widget button <-> drawer checkbox) ────────────
  function syncSplitBtn(){
    const cb=el('togSplit');const btn=el('btnToggleSplit');
    if(btn&&cb){
      const lbl=S.splitLabel||'Structured / Non-structured';
      btn.setAttribute('aria-pressed',cb.checked?'true':'false');
      btn.textContent=cb.checked?`📊 Hide ${lbl}`:`📊 Show ${lbl}`;
    }
  }
  window._syncSplitBtn=syncSplitBtn;
  el('btnToggleSplit')?.addEventListener('click',()=>{
    const cb=el('togSplit');if(cb){cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));}
    syncSplitBtn();if(el('wMoreMenu'))el('wMoreMenu').hidden=true;
  });
  el('togSplit')?.addEventListener('change',()=>syncSplitBtn());
  syncSplitBtn();
  // ── Cycle strip toggle ────────────────────────────────────────────────────
  function syncCycleBtn(){
    const cb=el('togShowCycle');const btn=el('btnToggleCycle');
    if(btn&&cb){btn.setAttribute('aria-pressed',cb.checked?'true':'false');btn.textContent=cb.checked?'📅 Hide cycle date strip':'📅 Show cycle date strip';}
  }
  el('btnToggleCycle')?.addEventListener('click',()=>{
    const cb=el('togShowCycle');if(cb){cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));}
    syncCycleBtn();if(el('wMoreMenu'))el('wMoreMenu').hidden=true;
  });
  el('togShowCycle')?.addEventListener('change',()=>syncCycleBtn());
  syncCycleBtn();
  // ── Compact mode toggle ───────────────────────────────────────────────────
  function syncCompactBtn(){
    const cb=el('togCompact');const btn=el('btnToggleCompact');
    if(btn&&cb){btn.setAttribute('aria-pressed',cb.checked?'true':'false');btn.textContent=cb.checked?'⬜ Exit compact mode':'⬜ Compact mode (donut + stats only)';}
  }
  el('btnToggleCompact')?.addEventListener('click',()=>{
    const cb=el('togCompact');if(cb){cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));}
    syncCompactBtn();if(el('wMoreMenu'))el('wMoreMenu').hidden=true;
  });
  el('togCompact')?.addEventListener('change',()=>syncCompactBtn());
  syncCompactBtn();




  // Remove loading state and render
  if(w){w.style.opacity='';w.style.transition='opacity 0.3s';}
  render();
}
// ── Global API for Activity Log drawer ─────────────────────────────────────
window.wRefresh = async function() { await loadFromAPI(); render(); };
window.getWidgetState = function() { return S; };
document.addEventListener('DOMContentLoaded',initWidget);
