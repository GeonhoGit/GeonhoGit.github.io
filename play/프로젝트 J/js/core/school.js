// 시설, 학생 특성, 마법 숙련도, 특별 투자
"use strict";

/* =========================================================
   시설, 학생 특성, 마법 숙련도
   ========================================================= */
const FAC = {
  gym:{n:'훈련장', d:'공격·수비 훈련의 성장량이 늘어납니다.', eff:lv => `공격·수비 성장 +${R(lv*15)}%`},
  library:{n:'도서관', d:'판단 훈련 성장량과 마법 숙련 경험치가 늘어납니다.', eff:lv => `판단 성장 +${R(lv*25)}%, 숙련 경험치 +${R(lv*20)}%`},
  dorm:{n:'기숙사', d:'쉬거나 벤치에 있을 때 더 회복하고, 훈련 피로가 줄어듭니다.', eff:lv => `휴식 +${R(18+lv*6)}, 벤치 +${R(10+lv*3)}, 훈련 피로 −${R(Math.max(1, 4-lv))}`},
  scout:{n:'스카우트 사무소', d:'신입생 후보가 늘고 수준이 오르며, 잠재력을 정확히 볼 수 있습니다.', eff:lv => `후보 ${6+Math.floor(lv)}명, 후보 수준 +${R(lv*2)}, 잠재력 ${lv ? '정확히 보임' : '대략만 보임'}`},
};
const FAC_COST = [200, 400, 700, 1100, 1600], FAC_MAX = 5;
const FAC_POW = [0, 1, 2, 3, 3.5, 4];  // 단계별 실제 효과 배율
const facLevel = k => (S && S.fac && S.fac[k]) || 0;
const facLv = k => FAC_POW[facLevel(k)] || 0;
function facGrowMult(focus){ return focus === 'int' ? 1 + facLv('library')*.25 : 1 + facLv('gym')*.15; }

const TRAITS = {
  comeback:{n:'역전의 명수', d:'지고 있을 때 공격력 +20%'},
  vanguard:{n:'선봉장', d:'경기 시작 15초 동안 공격력 +20%'},
  clutch:{n:'승부사', d:'마지막 15초와 연장전에 공격력 +20%'},
  tenacity:{n:'끈기', d:'기절과 빙결 시간이 절반'},
  iron:{n:'강철 체력', d:'최대 체력 +12%'},
  focus:{n:'집중력', d:'주문 재사용 시간 −10%'},
  mood:{n:'분위기 메이커', d:'함께 출전한 아군 공격력 +6%'},
  phoenix:{n:'불굴', d:'부활 시간 −30%'},
  prodigy:{n:'원소의 총아', d:'원소 일치 보너스가 10%에서 20%로'},
  late:{n:'대기만성', d:'1~2학년 성장 −30%, 3~4학년 성장 +60%'},
  early:{n:'천재형', d:'1~2학년 성장 +40%, 3~4학년 성장 −30%'},
  diligent:{n:'성실함', d:'훈련해도 컨디션이 줄지 않음'},
  choker:{n:'새가슴', d:'마지막 15초와 연장전에 공격력 −15%', neg:true},
  fragile:{n:'유리몸', d:'출전 후 컨디션 감소 1.5배', neg:true},
};
const TRK = Object.keys(TRAITS);
function genTraits(){
  const pos = TRK.filter(k => !TRAITS[k].neg), neg = TRK.filter(k => TRAITS[k].neg);
  const t = [Math.random() < .18 ? pick(neg) : pick(pos)];
  if (Math.random() < .25){ let x = pick(pos); while (t.includes(x)) x = pick(pos); t.push(x); }
  return t;
}
const hasT = (st, k) => !!(st && st.traits && st.traits.includes(k));
function traitChips(st){ return (st.traits || []).map(k => `<span class="trait ${TRAITS[k].neg ? 'neg' : ''}" title="${TRAITS[k].d}">${TRAITS[k].n}</span>`).join(' '); }
function traitList(st){ return (st.traits || []).map(k => `<div class="tr-line"><span class="trait ${TRAITS[k].neg ? 'neg' : ''}">${TRAITS[k].n}</span> <span class="muted">${TRAITS[k].d}</span></div>`).join(''); }
function traitAtk(B, u){
  const tr = u.st.traits; if (!tr || !tr.length) return 1;
  let m = 1; const late = B.t >= B.dur - 15;
  if (tr.includes('comeback') && B.score[u.team] < B.score[1-u.team]) m *= 1.2;
  if (tr.includes('vanguard') && B.t < 15) m *= 1.2;
  if (tr.includes('clutch') && late) m *= 1.2;
  if (tr.includes('choker') && late) m *= .85;
  return m;
}
function stunU(u, s){ u.stun = Math.max(u.stun, hasT(u.st, 'tenacity') ? s/2 : s); }
function traitGrow(st){
  const young = st.year <= 2;
  if (hasT(st, 'late')) return young ? .7 : 1.6;
  if (hasT(st, 'early')) return young ? 1.4 : .7;
  return 1;
}
function condAfter(st, played){
  const dl = facLv('dorm');
  const c = clamp(st.cond + (played ? -12*(hasT(st, 'fragile') ? 1.5 : 1) : 10 + dl*3), 20, 100);
  if (st.train === 'rest') return clamp(c + 18 + dl*6, 0, 100);
  if (!st.train) return c;  // 훈련을 고르지 않으면 훈련 피로도 없음
  return clamp(c - (hasT(st, 'diligent') ? 0 : Math.max(1, 4 - dl)), 20, 100);
}

// 숙련도: Lv1~5, 단계마다 능력치 +2%, Lv3이면 주력 마법이 됨
const MAST_XP = [0, 20, 50, 100, 160, 240];
function mastLv(st, id){ const x = (st.mastery && st.mastery[id]) || 0; let l = 0; while (l < 5 && x >= MAST_XP[l+1]) l++; return l; }
const mastMult = (st, id) => 1 + mastLv(st, id)*.02;
function mastRows(st, n = 3){
  const m = st.mastery || {};
  const ids = Object.keys(m).filter(id => m[id] > 0).sort((a,b) => m[b] - m[a]).slice(0, n);
  if (!ids.length) return '<div class="muted" style="font-size:.82rem">아직 숙련된 마법이 없습니다.</div>';
  return ids.map(id => { const l = mastLv(st, id), x = m[id];
    const pr = l >= 5 ? 100 : (x - MAST_XP[l]) / (MAST_XP[l+1] - MAST_XP[l]) * 100;
    return `<div class="mast"><span style="color:${EL[CH[id].e].c}">${CH[id].n}</span><span class="num">Lv${l}</span><div class="bar mid"><i style="width:${pr}%"></i></div></div>`; }).join('');
}
function potHtml(p){
  if (facLv('scout') >= 1 || p.potLo == null) return `<span class="stars" title="잠재력 ${p.pot}">${stars(p.pot)}</span>`;
  return `<span class="stars" title="스카우트 사무소를 1단계 이상 올리면 정확히 보입니다">잠재력 ★${p.potLo}~${p.potHi}</span>`;
}
function migrate(s){
  s.fac = s.fac || {gym:0, library:0, dorm:0, scout:0};
  s.schools.forEach(sc => sc.students.forEach(st => { if (!st.traits) st.traits = genTraits(); if (!st.mastery) st.mastery = {}; }));
  (s.prospects || []).forEach(st => { if (!st.traits) st.traits = genTraits(); if (!st.mastery) st.mastery = {}; });
  if (!s.diff) s.diff = 'normal'; s.chem = s.chem || {}; s.items = s.items || [];
  if (!s.div){ s.div = 2; s.other = genOtherDiv(s, Math.max(0, (s.season || 1) - 1)); }
  s.schools[0].students.forEach(st => { if (st.morale == null) st.morale = 70; });
  if (s.season >= 4) s.expansion2 = true;
  if (!s.goals || s.goals.season !== s.season){ const prev = S; S = s; makeGoals(); S = prev; }
  return s;
}

function viewFacility(){
  return `<div class="spread" style="margin-bottom:1rem"><div><h2 style="margin:0">시설</h2><p class="muted">골드로 학교 시설을 올립니다. 보유 골드 <span class="coin"></span>${S.gold}</p></div></div>
    <div class="fac-grid">${Object.keys(FAC).map(k => {
      const f = FAC[k], lv = facLevel(k), cost = FAC_COST[lv], max = lv >= FAC_MAX;
      return `<section class="panel fac">
        <div class="spread"><h3 style="margin:0">${f.n}</h3><span class="pips" aria-label="${lv}단계">${'●'.repeat(lv)}${'○'.repeat(FAC_MAX-lv)}</span></div>
        <p class="muted" style="font-size:.9rem">${f.d}</p>
        <p style="font-size:.9rem">지금: ${lv ? f.eff(FAC_POW[lv]) : '효과 없음'}</p>
        ${max ? '<p class="good" style="font-size:.9rem">최고 단계입니다.</p>' : `<p style="font-size:.9rem" class="muted">다음 단계: <span class="good">${f.eff(FAC_POW[lv+1])}</span></p>
        <button class="btn small" data-a="upgrade" data-v="${k}" ${S.gold >= cost ? '' : 'disabled'}><span class="coin"></span>${cost} 들여 ${lv+1}단계로</button>`}
      </section>`; }).join('')}</div>
    ${investHtml()}${shopHtml()}`;
}

/* ---------- 특별 투자 (후반 골드 사용처) ---------- */
const campCost = () => Math.min(650, 250 + 50*(S.season - 1));
const COACH_COST = 500;
const scholarCost = st => 200 + 150*st.pot;
const coachActive = () => !!(S.myCoach && S.myCoach.season === S.season);
const canInvest = () => S.phase === 'hub' || S.phase === 'final' || S.phase === 'cup';
function coachCandidates(){ return [...(S.hall || [])].sort((a,b) => hallScore(b) - hallScore(a)).slice(0, 3); }
function investHtml(){
  const camp = S.campSeason === S.season, cc = campCost(), cands = coachCandidates();
  return `<h2 style="margin:1.6rem 0 .3rem">특별 투자</h2><p class="muted" style="margin-bottom:.8rem">시즌마다 새로 쓸 수 있는 투자입니다. 시설을 다 올린 뒤의 골드 사용처입니다.</p>
  <div class="fac-grid">
    <section class="panel fac"><div class="spread"><h3 style="margin:0">전지훈련</h3><span class="${camp ? 'good' : 'muted'}" style="font-size:.85rem">${camp ? '이번 시즌 완료' : '시즌당 1회'}</span></div>
      <p class="muted" style="font-size:.9rem">학생 전원의 컨디션을 100으로 회복하고, 훈련 중인 능력치를 1.2 올립니다. 휴식 중인 학생은 가장 낮은 능력치가 오릅니다.</p>
      <button class="btn small" data-a="camp" ${camp || !canInvest() || S.gold < cc ? 'disabled' : ''}><span class="coin"></span>${cc} 들여 전지훈련</button></section>
    <section class="panel fac"><div class="spread"><h3 style="margin:0">졸업생 코치</h3><span class="${coachActive() ? 'good' : 'muted'}" style="font-size:.85rem">${coachActive() ? `${esc(S.myCoach.name)} 코치 재직 중` : '시즌당 1명'}</span></div>
      <p class="muted" style="font-size:.9rem">명예의 전당에 오른 졸업생을 이번 시즌 코치로 모십니다. 남은 시즌 동안 경기에서 우리 학생 능력치가 3% 오릅니다.</p>
      ${coachActive() ? '' : cands.length ? `<div class="row" style="gap:.4rem;margin-top:auto">${cands.map((h, i) => `<button class="btn small" data-a="hireCoach" data-v="${i}" ${!canInvest() || S.gold < COACH_COST ? 'disabled' : ''}>${esc(h.name)} 모시기 <span class="coin"></span>${COACH_COST}</button>`).join('')}</div>` : '<p class="muted" style="font-size:.85rem;margin-top:auto">아직 졸업생이 없습니다. 첫 졸업식 뒤부터 모실 수 있습니다.</p>'}</section>
    <section class="panel fac"><div class="spread"><h3 style="margin:0">장학금</h3><span class="muted" style="font-size:.85rem">학생마다 시즌당 1회</span></div>
      <p class="muted" style="font-size:.9rem">학생의 잠재력을 한 단계 올립니다. 잠재력이 높을수록 비싸고, 4학년은 받을 수 없습니다.</p>
      <button class="btn ghost small" data-a="go" data-v="students" style="margin-top:auto">학생 탭에서 지급하기</button></section>
  </div>`;
}
const narrow = () => (window.innerWidth || 1000) < 860;
// 휴대폰에서는 긴 패널을 접어 둠
function foldOnMobile(title, html){ return narrow() ? `<details class="m-fold"><summary>${title}</summary>${html}</details>` : html; }
