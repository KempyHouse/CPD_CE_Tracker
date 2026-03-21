/* global lucide */
'use strict';
// ── Authority presets ───────────────────────────────────────────────────────
const PRESETS={
  uk_rcvs:{authority:'RCVS',required:35,structured:20,unitType:'hours',cycle:'annual',splitLabel:'Structured / Non-structured',topics:['Clinical skills','Practice management','Ethics & welfare'],carryOver:false,pauseAllowed:true,pauseMax:6,newGradRequired:20,proRata:false,nonClinCap:null,deferral:false,nonPractisingExempt:true,spreadRule:null},
  uk_rvn:{authority:'RCVS',required:35,structured:20,unitType:'hours',cycle:'annual',splitLabel:'Structured / Non-structured',topics:['Clinical skills','Animal welfare','Professional skills'],carryOver:false,pauseAllowed:true,pauseMax:6,newGradRequired:20,proRata:false,nonClinCap:null,deferral:false,nonPractisingExempt:true,spreadRule:null},
  us_avma:{authority:'State Board',required:30,structured:0,unitType:'hours',cycle:'annual',splitLabel:'Category 1 / Category 2',topics:['Controlled substances','Patient safety'],carryOver:true,carryOverPct:0.5,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:null,deferral:false,nonPractisingExempt:false,spreadRule:null},
  us_nbdhe:{authority:'NBDHE',required:25,structured:0,unitType:'ceus',cycle:'biennial',splitLabel:'Clinical / Non-clinical',topics:['Infection control','Medical emergencies'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:null,deferral:false,nonPractisingExempt:false,spreadRule:null},
  au_ahpra_vet:{authority:'AHPRA',required:60,structured:15,unitType:'hours',cycle:'triennial',splitLabel:'Structured / Non-structured',topics:['Scientific knowledge','Practice management'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:true,nonClinCap:null,deferral:false,nonPractisingExempt:false,spreadRule:null},
  au_ahpra_dental:{authority:'AHPRA',required:60,structured:20,unitType:'hours',cycle:'triennial',splitLabel:'Verifiable / Non-verifiable',topics:['Medical emergencies','Radiography'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:true,nonClinCap:{max:12,label:'Non-scientific cap (20%)',pct:20},deferral:false,nonPractisingExempt:false,spreadRule:null},
  ie_vci:{authority:'VCI',required:20,structured:10,unitType:'credits',cycle:'annual',splitLabel:'Category A / Category B',topics:['Clinical topics','Management'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:true,nonClinCap:{max:5,label:'Management cap (25%)',pct:25},deferral:false,nonPractisingExempt:false,spreadRule:null,wetlabMultiplier:2},
  ie_dci:{authority:'DCI',required:20,structured:10,unitType:'hours',cycle:'annual',splitLabel:'Verifiable / Non-verifiable',topics:['Clinical topics','Patient safety'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:null,deferral:false,nonPractisingExempt:false,spreadRule:{minUnits:10,windowMonths:24,label:'10 hrs min / any 2yr window'}},
  nz_vcnz:{authority:'VCNZ',required:40,structured:0,unitType:'hours',cycle:'annual',splitLabel:'Directed / Self-directed',topics:['Clinical competence','Ethics'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:null,deferral:true,nonPractisingExempt:false,spreadRule:null},
  nz_dcnz:{authority:'DCNZ',required:25,structured:0,unitType:'hours',cycle:'annual',splitLabel:'Directed / Self-directed',topics:['Clinical topics','Peer interaction'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:null,deferral:true,nonPractisingExempt:false,spreadRule:null},
  za_savc:{authority:'SAVC',required:40,structured:20,unitType:'hours',cycle:'annual',splitLabel:'Category A / Category B',topics:['Technical skills','Ethics'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:{max:20,label:'Category B cap (50%)',pct:50},deferral:true,nonPractisingExempt:false,spreadRule:null},
  ca_cvma:{authority:'CVMA',required:40,structured:0,unitType:'hours',cycle:'annual',splitLabel:'Formal / Informal',topics:['Clinical competence','Practice standards'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:null,deferral:false,nonPractisingExempt:false,spreadRule:null},
  in_vci_india:{authority:'VCI',required:30,structured:0,unitType:'hours',cycle:'annual',splitLabel:'Formal / Informal',topics:['Clinical practice','Animal welfare'],carryOver:false,pauseAllowed:false,newGradRequired:null,proRata:false,nonClinCap:null,deferral:false,nonPractisingExempt:false,spreadRule:null},
};
// State overrides
const STATE_OVERRIDES={ca:{required:75,cycle:'biennial'},tx:{required:16,cycle:'annual'},ny:{required:24,cycle:'biennial'},fl:{required:30,cycle:'biennial'},on:{required:40,cycle:'annual'}};
// State/Province options per country group
const STATE_OPTIONS={
  us_avma:[{v:'',l:'— No state override (national 30 hrs) —'},{v:'ca',l:'California (75 hrs / 2yr)'},{v:'tx',l:'Texas (16 hrs / yr)'},{v:'ny',l:'New York (24 hrs / 2yr)'},{v:'fl',l:'Florida (30 hrs / 2yr)'}],
  us_nbdhe:[{v:'',l:'— No state override —'},{v:'ca',l:'California (75 hrs / 2yr)'},{v:'tx',l:'Texas (16 hrs / yr)'},{v:'ny',l:'New York (24 hrs / 2yr)'},{v:'fl',l:'Florida (30 hrs / 2yr)'}],
  au_ahpra_vet:[{v:'',l:'— National standard (AHPRA) —'},{v:'nsw',l:'New South Wales'},{v:'vic',l:'Victoria'}],
  au_ahpra_dental:[{v:'',l:'— National standard (AHPRA) —'},{v:'nsw',l:'New South Wales'},{v:'vic',l:'Victoria'}],
  ca_cvma:[{v:'',l:'— No province override —'},{v:'on',l:'Ontario (40 hrs / yr)'}],
};
// Countries available per sector
const COUNTRY_BY_SECTOR={
  vet:[
    {v:'uk_rcvs',l:'🇬🇧 United Kingdom — RCVS'},
    {v:'uk_rvn', l:'🇬🇧 UK — RCVS (RVN)'},
    {v:'us_avma',l:'🇺🇸 USA — AVMA / State Board'},
    {v:'au_ahpra_vet',l:'🇦🇺 Australia — AHPRA (Vet)'},
    {v:'ie_vci', l:'🇮🇪 Ireland — VCI'},
    {v:'nz_vcnz',l:'🇳🇿 New Zealand — VCNZ'},
    {v:'za_savc',l:'🇿🇦 South Africa — SAVC'},
    {v:'ca_cvma',l:'🇨🇦 Canada — CVMA'},
    {v:'in_vci_india',l:'🇮🇳 India — VCI'},
  ],
  dental:[
    {v:'us_nbdhe',      l:'🇺🇸 USA — NBDHE (Dental Hygienist)'},
    {v:'au_ahpra_dental',l:'🇦🇺 Australia — AHPRA (Dental)'},
    {v:'ie_dci',        l:'🇮🇪 Ireland — Dental Council'},
    {v:'nz_dcnz',       l:'🇳🇿 New Zealand — DCNZ'},
  ],
};
const SECTOR_DEFAULTS={vet:'uk_rcvs',dental:'au_ahpra_dental'};
function updateCountryDropdown(){
  const dd=el('selCountry');if(!dd)return;
  const opts=COUNTRY_BY_SECTOR[S.sector]||COUNTRY_BY_SECTOR.vet;
  dd.innerHTML=opts.map(o=>`<option value="${o.v}"${o.v===S.country?' selected':''}>${o.l}</option>`).join('');
  // If current country not valid for this sector, reset to sector default
  const valid=opts.some(o=>o.v===S.country);
  if(!valid){S.country=SECTOR_DEFAULTS[S.sector]||opts[0].v;dd.value=S.country}
}
// Country groups that have no sub-national variation
const NO_STATE=['uk_rcvs','uk_rvn','ie_vci','ie_dci','nz_vcnz','nz_dcnz','za_savc','in_vci_india'];
function updateStateDropdown(){
  const dd=el('selState');if(!dd)return;
  const opts=STATE_OPTIONS[S.country];
  const disabled=NO_STATE.includes(S.country)||!opts;
  dd.disabled=disabled;
  dd.style.opacity=disabled?'0.4':'1';
  dd.style.cursor=disabled?'not-allowed':'auto';
  if(disabled){
    dd.innerHTML='<option value="">— Not applicable for this jurisdiction —</option>';
    S.state='';
  } else {
    dd.innerHTML=opts.map(o=>`<option value="${o.v}">${o.l}</option>`).join('');
    // Only keep current state if still valid
    const valid=opts.some(o=>o.v===S.state);
    if(!valid){S.state='';dd.value=''}
  }
}
// Role → topics + split label (overrides preset topics)
const ROLE_DEF={
  vet_surgeon:{topics:['Clinical skills','Practice management','Ethics & welfare'],splitLabel:'Structured / Non-structured',hideSplit:false},
  rvn:{topics:['Clinical skills','Animal welfare','Professional skills'],splitLabel:'Structured / Non-structured',hideSplit:false},
  vet_tech:{topics:['Technical skills','Patient care','Safety'],splitLabel:'Category 1 / Category 2',hideSplit:false},
  vet_tech_specialist:{topics:['Technical skills','Specialist discipline'],splitLabel:'Structured / Non-structured',hideSplit:false},
  vet_paraprofessional:{topics:['Animal handling','Basic clinical care'],splitLabel:null,hideSplit:true},
  dentist:{topics:['Clinical topics','Medical emergencies','Radiography'],splitLabel:'Verifiable / Non-verifiable',hideSplit:false},
  dental_hygienist:{topics:['Infection control','Medical emergencies','Patient care'],splitLabel:'Verifiable / Non-verifiable',hideSplit:false},
  dental_therapist:{topics:['Clinical topics','Patient safety','Safeguarding'],splitLabel:'Verifiable / Non-verifiable',hideSplit:false},
  dental_nurse:{topics:['Clinical topics','Infection control','Safeguarding'],splitLabel:'Verifiable / Non-verifiable',hideSplit:false},
  dental_technician:{topics:['Technical skills','Materials safety'],splitLabel:'Verifiable / Non-verifiable',hideSplit:false},
  oral_health_therapist:{topics:['Clinical topics','Medical emergencies','Patient communication'],splitLabel:'Verifiable / Non-verifiable',hideSplit:false},
};
// Per-topic rules
const TOPIC_RULES={
  'Medical emergencies':{minPerCycle:10,minPerYear:2,mustBeLive:true,mustBeInPerson:true},
  'Controlled substances (DEA)':{minPerCycle:3,mustBeLive:false},
  'Controlled substances':{minPerCycle:3,mustBeLive:false},
  'Ethics & professionalism':{minPerCycle:1,mustBeLive:true},
  'Opioid prescribing':{minPerCycle:2,mustBeLive:false},
};
// State
const S={
  country:'uk_rcvs',state:'',registrationYear:'2020',registrationStatus:'active',
  role:'vet_surgeon',cycle:'annual',baseRequired:35,structuredMin:20,unitType:'hours',
  authority:'RCVS',splitLabel:'Structured / Non-structured',
  topics:['Clinical skills','Practice management','Ethics & welfare'],
  carryOver:false,carryOverPct:0,prevCompleted:0,
  pauseAllowed:true,pauseMax:6,pauseMonths:3,
  newGradRequired:20,proRata:false,regMonthsAgo:6,
  nonClinCap:null,deferral:false,nonPractisingExempt:true,spreadRule:null,
  completed:20,structuredDone:12,nonClinDone:0,displayUnit:'hours',
  showTopics:true,showSplit:true,showCycle:true,compact:false,
  hasMandatoryTopics:true,hasDEA:false,cycleStart:'2026-01-01',sector:'vet',
};
const CIRC=2*Math.PI*45;
// Helpers
function cycleMonthsFor(c){return{annual:12,biennial:24,triennial:36,'5year':60,rolling3:36}[c]||12}
function cycleMonths(){return cycleMonthsFor(S.cycle)}
function cycleEnd(){const d=new Date(S.cycleStart);d.setMonth(d.getMonth()+cycleMonths());d.setDate(d.getDate()-1);return d}
function daysLeft(){return Math.max(0,Math.ceil((cycleEnd()-new Date())/86400000))}
function isNewGrad(){const yr=parseInt(S.registrationYear);return(new Date().getFullYear()-yr)<=1}
function isUS(){return['us_avma','us_nbdhe'].includes(S.country)||['ca','tx','ny','fl'].includes(S.state)}
function uLbl(n,short){const v=n%1===0?n.toFixed(0):n.toFixed(1);const u=S.displayUnit==='hours'?'hrs':S.displayUnit==='points'?'pts':S.displayUnit==='ceus'?'CEUs':'cr';return short?v+' '+u:v+' '+u}
function fmtDate(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
// Priority hierarchy → effective required
function effectiveRequired(){
  const status=S.registrationStatus;
  if(status==='non_practising'||status==='student')return 0;
  let req=S.baseRequired;
  // State override (priority 5 — before new grad)
  const so=STATE_OVERRIDES[S.state];
  if(so&&so.required)req=so.required;
  // New grad (priority 4)
  if(isNewGrad()&&S.newGradRequired>0)req=S.newGradRequired;
  // Pro-rata mid-year (priority 5b)
  if(S.proRata&&S.regMonthsAgo>0){const total=cycleMonths();const rem=Math.max(0,total-S.regMonthsAgo);req=Math.round(req*rem/total)}
  // Paused (priority 3)
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
  if(!S.carryOver)return 0;
  const surplus=Math.max(0,S.prevCompleted-S.baseRequired);
  const cap=S.carryOverPct>0?Math.floor(S.baseRequired*S.carryOverPct):surplus;
  return Math.min(surplus,cap)
}
// Apply preset
function applyPreset(key){
  const p=PRESETS[key];if(!p)return;
  Object.assign(S,{
    authority:p.authority,baseRequired:p.required,structuredMin:p.structured,
    unitType:p.unitType,displayUnit:p.unitType,cycle:p.cycle,
    splitLabel:p.splitLabel,topics:[...p.topics],
    carryOver:p.carryOver,carryOverPct:p.carryOverPct||0,
    pauseAllowed:p.pauseAllowed,pauseMax:p.pauseMax||0,
    newGradRequired:p.newGradRequired||0,proRata:p.proRata,
    nonClinCap:p.nonClinCap,deferral:p.deferral,
    nonPractisingExempt:p.nonPractisingExempt,spreadRule:p.spreadRule,
  });
  // authority properties also set
  const wetlabKey=PRESETS[key]&&PRESETS[key].wetlabMultiplier?PRESETS[key].wetlabMultiplier:null;
  S.wetlabMultiplier=wetlabKey;
  const rd=ROLE_DEF[S.role];if(rd){S.topics=[...rd.topics];if(rd.splitLabel)S.splitLabel=rd.splitLabel}
  syncControls()
}
function syncControls(){
  setRng('numRequired','numRequiredVal',S.baseRequired);
  setRng('numStructMin','numStructMinVal',S.structuredMin);
  setRng('numCompleted','numCompletedVal',Math.min(S.completed,S.baseRequired));
  setRng('numStructDone','numStructDoneVal',Math.min(S.structuredDone,S.baseRequired));
  sel('selCycle').value=S.cycle;
}
function setRng(id,vid,v){const e=el(id);e.value=v;el(vid).textContent=v}
function el(id){return document.getElementById(id)}
function sel(id){return document.getElementById(id)}
// Render
function render(){
  const req=effectiveRequired();const cyc=effectiveCycle();
  const p=pct(req);const cs=complianceStatus(p);
  const status=S.registrationStatus;const ng=isNewGrad();
  const fillColour=p>=100?'#2e7d52':cs==='amber'?'#d97706':cs==='red'?'#b91c1c':'#5c3fa3';
  // Profile ring sync
  const ringCirc=2*Math.PI*35;const rfg=el('ring-fg');
  if(rfg){rfg.style.strokeDasharray=ringCirc;rfg.style.strokeDashoffset=ringCirc-(p/100)*ringCirc}
  const ppct=el('profile-pct');if(ppct)ppct.textContent=p+'%';
  // Badges
  const badges=el('w-badges');if(badges){
    badges.innerHTML='';
    if(ng&&S.newGradRequired>0)badges.innerHTML+='<span class="wpill-badge wpill-newgrad">🎓 New Graduate</span>';
    if(status==='specialist')badges.innerHTML+='<span class="wpill-badge wpill-specialist">🔬 Specialist</span>';
    if(status==='advanced')badges.innerHTML+='<span class="wpill-badge wpill-ap">✦ Advanced Practitioner</span>';
  }
  // Status banners
  const bannerEl=el('w-status-banner');if(bannerEl){
    if(status==='non_practising'){bannerEl.className='w-banner blue';bannerEl.classList.remove('hidden');bannerEl.textContent='ℹ Non-practising — CPD not required by this authority'}
    else if(status==='student'){bannerEl.className='w-banner grey';bannerEl.classList.remove('hidden');bannerEl.textContent='ℹ Student registration — CPD requirements begin after full registration'}
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
  const sCyc=el('sCycle');if(sCyc){const cycLbl={annual:'Annual',biennial:'Biennial',triennial:'3-year','5year':'5-year',rolling3:'Rolling 3yr'}[cyc]||cyc;sCyc.textContent=cycLbl+' ('+S.authority+')'}
  // Split bar
  const wSplit=el('wSplit');if(wSplit){
    const rd=ROLE_DEF[S.role];const hideSplit=rd&&rd.hideSplit;
    wSplit.classList.toggle('hidden',!S.showSplit||S.compact||hideSplit);
    if(S.showSplit&&!S.compact&&!hideSplit&&req>0){
      const totalPct=Math.min(100,(S.completed/req)*100);
      const sPct=Math.min(totalPct,(S.structuredDone/req)*100);
      el('splitBarA').style.width=totalPct+'%';el('splitBarA').style.background=fillColour;
      el('splitBarB').style.width=sPct+'%';el('splitBarB').style.background=fillColour;
      el('splitLbl').textContent=S.splitLabel;
      const structDeficit=S.structuredDone<S.structuredMin;
      el('splitVal').textContent=uLbl(S.structuredDone)+' / '+uLbl(S.structuredMin)+' structured';
      el('splitVal').className='split-hdr-val'+(structDeficit?' amber':'');
      // Spread rule chip
      const sc=el('spreadChip');if(sc){
        if(S.spreadRule){sc.classList.remove('hidden');sc.className='split-chip '+(S.structuredDone>=S.spreadRule.minUnits?'ok':'warn');sc.textContent=(S.structuredDone>=S.spreadRule.minUnits?'✓ ':'⚠ ')+S.spreadRule.label}
        else sc.classList.add('hidden')
      }
    }
  }
  // Non-clinical cap
  const wNC=el('wNonClin');if(wNC){
    if(S.nonClinCap&&!S.compact){wNC.classList.remove('hidden');const over=S.nonClinDone>S.nonClinCap.max;el('ncLbl').textContent=S.nonClinCap.label;el('ncVal').textContent=uLbl(S.nonClinDone)+' / '+uLbl(S.nonClinCap.max);el('ncVal').className='nonclin-val'+(over?' over':'');const ncPct=Math.min(100,(S.nonClinDone/req)*100);const ncCap=Math.min(100,(S.nonClinCap.max/req)*100);el('ncBar').style.width=Math.min(ncPct,ncCap)+'%';el('ncBar').style.background=over?'#b91c1c':fillColour;el('ncBarOver').style.width=over?Math.min(ncPct-ncCap,100-ncCap)+'%':'0%'}
    else wNC.classList.add('hidden')
  }
  // Carry-over chip
  const wCarry=el('wCarry');if(wCarry){
    if(carryAmt>0&&!S.compact){wCarry.classList.remove('hidden');el('carryAmt').textContent=uLbl(carryAmt)}
    else wCarry.classList.add('hidden')
  }
  // Topics
  const wTopics=el('wTopics');if(wTopics){
    const show=S.showTopics&&S.hasMandatoryTopics&&!S.compact;wTopics.classList.toggle('hidden',!show);
    if(show){
      let topicList=[...S.topics];
      if(S.hasDEA&&isUS())topicList.push('Controlled substances (DEA)');
      const perTopic=req/topicList.length;let done=0;
      el('topicsList').innerHTML=topicList.map((t,i)=>{
        const tr=TOPIC_RULES[t]||{};const thresh=i*perTopic;
        const status2=S.completed>=thresh+perTopic?'done':S.completed>thresh?'partial':'todo';
        if(status2==='done')done++;
        const completed2=status2==='done'?perTopic:status2==='partial'?S.completed-thresh:0;
        const icon=status2==='done'?'✓':status2==='partial'?'◐':'○';
        const liveBadge=tr.mustBeLive?'<span class="topic-flag">LIVE</span>':'';
        const minBadge=tr.minPerCycle?` min ${tr.minPerCycle} hrs`:'';
        return`<div class="topic-row"><span class="topic-dot ${status2}">${icon}</span><span class="topic-name">${t}${liveBadge}<span style="font-size:9.5px;color:#9aaabb">${minBadge}</span></span><span class="topic-hrs">${status2==='todo'?'0 '+S.displayUnit.slice(0,3):uLbl(+completed2.toFixed(1))}</span></div>`
      }).join('');
      el('topicsCount').textContent=done+' of '+topicList.length+' met'
    }
  }
  // Compliance
  const wC=el('wCompliance');if(wC){
    wC.className='w-compliance c-'+cs;
    const txt={green:p>=100?'Complete — all requirements met':'On track — good progress',amber:'At risk — falling behind schedule',red:'Action needed — critical gap',blue:'Non-practising — CPD not required',grey:'Student — requirements activate on full registration'};
    const badge={green:p>=100?'Complete ✓':'On Track',amber:'At Risk',red:'Action Needed',blue:'Not Required',grey:'Student'};
    el('cText').textContent=txt[cs];el('cBadge').textContent=badge[cs]
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
  // Unit pills — auto-derived from authority unit type, no manual toggle
  const UNIT_LABELS={hours:'Hours',ceus:'CEUs',credits:'Credits',points:'Points'};
  const pills=document.querySelectorAll('.unit-pill');
  pills.forEach(pill=>{
    if(pill.dataset.unit==='hours'){
      pill.textContent='Hours';pill.classList.add('active');pill.classList.remove('hidden');
    } else {
      // Second pill: show only if authority uses a non-hours unit
      if(S.unitType!=='hours'){
        pill.textContent=UNIT_LABELS[S.unitType]||S.unitType;
        pill.dataset.unit=S.unitType;
        pill.classList.remove('hidden');
        pill.classList.toggle('active',S.displayUnit===S.unitType);
        // Sync first pill active state
        pills[0]&&pills[0].classList.toggle('active',S.displayUnit==='hours');
      } else {
        pill.classList.add('hidden');pill.classList.remove('active');
      }
    }
  });
  // DEA toggle — disable if not US
  const deaRow=el('deaRow');if(deaRow)deaRow.classList.toggle('disabled',!isUS());
  // Pro-rata controls visibility
  const proRataRow=el('proRataRow');const regMonthsRow=el('regMonthsRow');
  if(proRataRow)proRataRow.classList.toggle('hidden',!S.proRata);
  if(regMonthsRow)regMonthsRow.classList.toggle('hidden',!S.proRata);
  // Pause months row
  const pauseRow=el('pauseMonthsRow');if(pauseRow)pauseRow.classList.toggle('hidden',S.registrationStatus!=='paused');
  renderRuleSummary()
}
// ── Active Rules transparency panel ────────────────────────────────────────
function renderRuleSummary(){
  const req=effectiveRequired();const cyc=effectiveCycle();
  const status=S.registrationStatus;const ng=isNewGrad();
  const so=STATE_OVERRIDES[S.state];
  // Priority banner
  let priorityMsg='';
  if(status==='non_practising')priorityMsg='Priority 1 active: Non-practising — CPD requirement waived (0 units required)';
  else if(status==='student')priorityMsg='Priority 2 active: Student registration — CPD ring disabled until full registration';
  else if(status==='paused')priorityMsg=`Priority 3 active: Paused (${S.pauseMonths} months) — requirement reduced pro-rata to ${req} ${S.unitType}`;
  else if(ng&&S.newGradRequired>0)priorityMsg=`Priority 4 active: New graduate — requirement reduced from ${S.baseRequired} to ${S.newGradRequired} ${S.unitType}`;
  else if(S.proRata&&S.regMonthsAgo>0)priorityMsg=`Priority 5 active: Pro-rata mid-year registrant (${S.regMonthsAgo} months ago) — requirement reduced to ${req} ${S.unitType}`;
  else if(so&&so.required)priorityMsg=`Priority 5 active: State override (${S.state.toUpperCase()}) — requirement set to ${so.required} hrs / ${so.cycle}`;
  const banner=el('rulePriorityBanner');const bannerTxt=el('rulePriorityText');
  if(banner){priorityMsg?banner.classList.remove('hidden'):banner.classList.add('hidden');if(bannerTxt)bannerTxt.textContent=priorityMsg}
  // Row builder
  const unitSuffix={hours:'hrs',points:'pts',credits:'cr',ceus:'CEUs'}[S.unitType]||S.unitType;
  function row(lbl,val,cls){return`<div class="rule-item"><span class="rule-lbl">${lbl}</span><span class="rule-val${cls?' '+cls:''}">${val}</span></div>`}
  const nonPract=status==='non_practising';const student=status==='student';
  const stateChip=so&&so.required?` <span class="rule-override ro-state">STATE OVERRIDE</span>`:'';
  const ngChip=ng&&S.newGradRequired>0?` <span class="rule-override ro-newgrad">NEW GRAD</span>`:'';
  const pauseChip=status==='paused'?` <span class="rule-override ro-paused">PAUSED</span>`:'';
  const proRataChip=S.proRata&&S.regMonthsAgo>0?` <span class="rule-override ro-prorata">PRO-RATA</span>`:'';
  const reqDisplay=nonPract||student?`0 ${unitSuffix} (exempt)`:`${req} ${unitSuffix}${stateChip}${ngChip}${pauseChip}${proRataChip}`;
  const cycLabel={annual:'Annual (12 months)',biennial:'Biennial (24 months)',triennial:'Triennial (36 months)','5year':'5-year rolling',rolling3:'Rolling 3-year window'}[cyc]||cyc;
  const carryAmt=carryOverAvailable();
  const grid=el('rulesGrid');
  if(!grid)return;
  grid.innerHTML=[
    row('Regulatory Authority',S.authority),
    row('Units Required / Cycle',reqDisplay,nonPract||student?'muted':''),
    row('Cycle Type',cycLabel),
    row('Authority Unit Type',{hours:'Hours (hrs) — standard for this authority',points:'Points (pts)',credits:`Credits (cr) — 1 credit = 1 hour${S.wetlabMultiplier?` | Wetlab / hands-on activities earn ${S.wetlabMultiplier}× credits per contact hour`:''}`,ceus:'CE Units (CEUs) — 1 CEU = 1 hour, standard US dental'}[S.unitType]||S.unitType),
    row('Structured / Verifiable Min',S.structuredMin>0?`${S.structuredMin} ${unitSuffix} minimum`:'None required',S.structuredMin>0?'':'muted'),
    row('Split Bar Label',S.splitLabel||'—',S.splitLabel?'':'muted'),
    row('Mandatory Topics',S.hasMandatoryTopics&&S.topics.length?S.topics.join(', '):'Not required for this authority / role',S.hasMandatoryTopics?'':'muted'),
    row('DEA / Prescribing CE',S.hasDEA&&isUS()?'Required — 3 hrs min / cycle':'Not applicable',S.hasDEA&&isUS()?'':'muted'),
    row('Non-clinical Cap',S.nonClinCap?`${S.nonClinCap.max} ${unitSuffix} max (${S.nonClinCap.pct}%) — ${S.nonClinCap.label}`:'No cap for this authority',S.nonClinCap?'amber':'muted'),
    row('Spread Rule',S.spreadRule?S.spreadRule.label:'No spread rule for this authority',S.spreadRule?'amber':'muted'),
    row('Carry-over',S.carryOver?(carryAmt>0?`${carryAmt} ${unitSuffix} available from previous cycle`:'Permitted — no surplus from previous cycle'):'Not permitted by this authority',S.carryOver&&carryAmt>0?'purple':'muted'),
    row('Pause / Deferral',S.pauseAllowed?`Up to ${S.pauseMax} months — proportional hour reduction`:(S.deferral?'Deferral on application only':'Not permitted'),S.pauseAllowed?'':'muted'),
    row('Pro-rata (mid-year reg.)',S.proRata?'Applicable — formula: required × (months remaining ÷ cycle months)':'Not applicable for this authority',S.proRata?'amber':'muted'),
    row('New Graduate Rule',ng&&S.newGradRequired>0?`Reduced to ${S.newGradRequired} ${unitSuffix} (first cycle only)`:'Not in new graduate window',ng&&S.newGradRequired>0?'amber':'muted'),
    row('Registration Status',{active:'Active / Full — standard requirements apply',non_practising:'Non-practising — CPD exempt',student:'Student — CPD not yet required',paused:'Paused — pro-rata reduction applied',specialist:'Specialist — standard hours, specialist topics',advanced:'Advanced Practitioner — standard hours with AP badge'}[status]||status,nonPract||student?'amber':''),
  ].join('')
}
// Event wiring helpers
function onRng(id,vid,prop,cb){el(id).addEventListener('input',function(){S[prop]=parseFloat(this.value);el(vid).textContent=parseFloat(this.value).toFixed(this.step&&parseFloat(this.step)<1?1:0);if(cb)cb();render()})}
function onSel(id,prop,cb){el(id).addEventListener('change',function(){S[prop]=this.value;if(cb)cb();render()})}
function onTog(id,prop,cb){el(id).addEventListener('change',function(){S[prop]=this.checked;if(cb)cb();render()})}
// Init after DOM ready
function initWidget(){
  lucide.createIcons();
  // Country → repopulate state dropdown, then apply preset
  el('selCountry').addEventListener('change',function(){S.country=this.value;S.state='';applyPreset(this.value);updateStateDropdown();render()});
  // State
  el('selState').addEventListener('change',function(){S.state=this.value;render()});
  // Reg year
  onSel('selRegYear','registrationYear');
  // Reg status
  onSel('selRegStatus','registrationStatus');
  // Role
  el('selRole').addEventListener('change',function(){S.role=this.value;const rd=ROLE_DEF[S.role];if(rd){S.topics=[...rd.topics];if(rd.splitLabel)S.splitLabel=rd.splitLabel};render()});
  // Cycle
  onSel('selCycle','cycle');
  // Sliders
  onRng('numRequired','numRequiredVal','baseRequired',()=>{S.structuredMin=Math.min(S.structuredMin,S.baseRequired)});
  onRng('numStructMin','numStructMinVal','structuredMin');
  onRng('numCompleted','numCompletedVal','completed');
  onRng('numStructDone','numStructDoneVal','structuredDone');
  onRng('numNonClin','numNonClinVal','nonClinDone');
  onRng('numPrevCompleted','numPrevCompletedVal','prevCompleted');
  onRng('numPauseMonths','numPauseMonthsVal','pauseMonths');
  onRng('numRegMonths','numRegMonthsVal','regMonthsAgo');
  // Toggles
  onTog('togTopics','hasMandatoryTopics');
  onTog('togSplit','showSplit');
  onTog('togDEA','hasDEA');
  onTog('togShowTopics','showTopics');
  onTog('togShowCycle','showCycle');
  onTog('togCompact','compact');
  onTog('togProRata','proRata');
  // Cycle start
  el('selCycleStart').addEventListener('change',function(){S.cycleStart=this.value;render()});
  // Sector tabs
  document.querySelectorAll('.s-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.s-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');S.sector=tab.dataset.sector;
      S.country=SECTOR_DEFAULTS[S.sector]||'uk_rcvs';
      S.state='';updateCountryDropdown();applyPreset(S.country);updateStateDropdown();render()
    })
  });
  // Unit pills
  document.querySelectorAll('.unit-pill').forEach(pill=>{
    pill.addEventListener('click',()=>{S.displayUnit=pill.dataset.unit==='hours'?'hours':'points';render()})
  });
  // Block dead links
  document.querySelectorAll('a[href="#"]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
  // Init
  updateCountryDropdown();applyPreset('uk_rcvs');updateStateDropdown();render()
}
document.addEventListener('DOMContentLoaded',initWidget);
