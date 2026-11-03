// 연습 경기는 화면 상태 안에서만 실행하며 공식 경기의 난수와 상태를 보존합니다.
"use strict";

function withPracticeSeed(seed, fn){
  const original = Math.random;
  let state = seed >>> 0;
  Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  try { return fn(); } finally { Math.random = original; }
}
function initPractice(){
  if (V.practice) return V.practice;
  const slot = [0,1,2].find(i => lineupAt(i)), plan = lineupAt(slot);
  const hasNextMatch = ['cup','final'].includes(S.phase) || S.phase === 'hub' && S.week < S.schedule.length;
  const opponent = hasNextMatch ? opponentId() : S.schools.find(sc=>!sc.player).id;
  V.practice = {slot:slot ?? null, opponent, map:'plain', strategy:plan ? plan.strategy : 'pressure', formation:plan ? [...plan.formation] : [0,1,2], seed:21211, fixture:null, results:[], lastBattle:null, note:''};
  return V.practice;
}
function configurePractice(key, value){
  const p = initPractice();
  if (key === 'lineup'){
    const n = lineupSlot(value), plan = lineupAt(n); if (!plan) return false;
    p.slot = n; p.strategy = plan.strategy; p.formation = [...plan.formation];
  } else if (key === 'opponent'){
    if (!/^[1-9]\d*$/.test(String(value)) || !school(+value)) return false;
    p.opponent = +value;
  } else if (key === 'map'){
    if (!Object.hasOwn(MAPS,value)) return false;
    p.map = value;
  } else return false;
  p.fixture = null; p.results = []; p.lastBattle = null; p.note = '';
  return true;
}
function setPracticeStrategy(key){
  if (!Object.hasOwn(STRATEGIES,key)) return false;
  initPractice().strategy = key; return true;
}
function swapPracticeFormation(value){
  if (typeof value !== 'string' || !/^[0-2]:[0-2]$/.test(value)) return false;
  const [a,b] = value.split(':').map(Number), p = initPractice();
  if (a === b) return false;
  [p.formation[a],p.formation[b]] = [p.formation[b],p.formation[a]]; return true;
}
function practiceFixture(){
  const p = initPractice(), plan = lineupAt(p.slot);
  if (!plan){ p.note = '밴픽을 마친 뒤 출전 조합을 먼저 저장하세요.'; return null; }
  if (lineupStatus(plan,false).some(x => x.reason)) { p.note = '졸업·이적하거나 사용할 수 없는 마법이 있습니다. 본관에서 조합을 확인하고 밴픽에서 교체하여 다시 저장하세요.'; return null; }
  if (p.fixture) return p.fixture;
  const oldDraft = D;
  try {
    return withPracticeSeed(p.seed, () => {
      const op = school(p.opponent), stById = {};
      me().students.concat(op.students).forEach(st => stById[st.id] = JSON.parse(JSON.stringify(st)));
      D = {practice:true, bans:[[],[]], picks:[plan.picks.map(x => ({sid:x.sid,champ:x.champ})),[]], roster:[me().students.map(s=>s.id),op.students.map(s=>s.id)], stById, strategies:[plan.strategy,schoolStrategy(op)]};
      for (let i=0;i<3;i++){ const champ = aiChoose(1,'pick'); D.picks[1].push({champ,sid:aiAssign(1,champ)}); }
      const teams = [me(),op].map((sc,t) => D.picks[t].map((x,i) => ({champ:x.champ,st:stById[x.sid],slot:i,bonus:teamBonus(sc,true)+(t===0?chemBonus(x.sid,plan.picks.map(q=>q.sid)):0)})));
      p.fixture = {teams, enemyStrategy:D.strategies[1]};
      return p.fixture;
    });
  } finally { D = oldDraft; }
}
function runPractice(){
  if (!S || V.view !== 'practice') return false;
  const p = initPractice(), fixture = practiceFixture(); if (!fixture) return false;
  const teams = JSON.parse(JSON.stringify(fixture.teams));
  teams[0].forEach((x,i)=>x.slot=p.formation[i]);
  const bt = withPracticeSeed(p.seed, () => {
    const local = newBattle(teams,p.map,[p.strategy,fixture.enemyStrategy]);
    local.autoTac[0] = true; runHeadless(local); return local;
  });
  p.results.push({strategy:p.strategy,formation:[...p.formation],score:[...bt.score],winner:bt.winner,
    units:bt.units.filter(u=>u.team===0).map(u=>({sid:u.st.id,name:u.st.name,champ:u.champ,k:u.k,d:u.d,dmg:R(u.dmg),heal:R(u.heal)}))});
  p.results = p.results.slice(-6); p.lastBattle = bt; p.note = '';
  return true;
}
function viewPractice(){
  const p = initPractice(), plan = lineupAt(p.slot), rows = ['위','중앙','아래'];
  return `<section class="panel" style="margin-bottom:1rem"><h2>연습 경기 · 전술 비교</h2>
    <p class="muted">저장한 출전 조합으로 상대·전장을 고정하고 전술과 배치를 비교합니다. 양 팀 자동 작전이며, 골드·성장·피로·시즌 기록은 변하지 않습니다.</p>
    <p class="muted" style="font-size:.85rem">같은 조건은 같은 결과를 냅니다. 전술이나 배치를 바꾸면 이후 전투 전개도 달라집니다. 조합·상대·전장을 바꾸거나 이 화면을 떠나면 비교를 새로 시작합니다.</p>
    <div class="cards" style="margin-top:1rem">
      <div class="field"><label for="practice-lineup">출전 조합</label><select id="practice-lineup" data-practice="lineup"><option value="" disabled ${plan?'':'selected'}>저장한 조합 없음</option>${[0,1,2].filter(i=>lineupAt(i)).map(i=>`<option value="${i}" ${i===p.slot?'selected':''}>${LINEUP_NAMES[i]}</option>`).join('')}</select></div>
      <div class="field"><label for="practice-opponent">상대</label><select id="practice-opponent" data-practice="opponent">${S.schools.filter(s=>!s.player).map(s=>`<option value="${s.id}" ${s.id===p.opponent?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="practice-map">전장</label><select id="practice-map" data-practice="map">${MAPK.map(k=>`<option value="${k}" ${k===p.map?'selected':''}>${MAPS[k].n}</option>`).join('')}</select></div>
    </div>${mapCardHtml(p.map,true)}
    <h3 style="margin-top:1rem">팀 전술</h3><div class="row">${Object.keys(STRATEGIES).map(k=>`<button class="btn ghost small" data-a="practiceStrategy" data-v="${k}" aria-pressed="${p.strategy===k}">${STRATEGIES[k].n}</button>`).join('')}</div>
    ${plan ? `<h3 style="margin-top:1rem">출전 배치</h3>${[0,1,2].map(slot=>{const i=p.formation.indexOf(slot),x=plan.picks[i];return `<div class="spread" style="padding:.5rem 0"><span>${rows[slot]} · ${esc(x.name)} · ${CH[x.champ] ? CH[x.champ].n : '사용 불가'}</span><div class="row"><button class="btn ghost small" aria-label="${esc(x.name)} 위로 이동" data-a="practiceSwap" data-v="${i}:${p.formation.indexOf(slot-1)}" ${slot===0?'disabled':''}>↑</button><button class="btn ghost small" aria-label="${esc(x.name)} 아래로 이동" data-a="practiceSwap" data-v="${i}:${p.formation.indexOf(slot+1)}" ${slot===2?'disabled':''}>↓</button></div></div>`;}).join('')}` : '<p style="margin-top:1rem">밴픽을 마친 뒤 출전 조합을 먼저 저장하세요.</p>'}
    ${p.note?`<p class="bad" role="status">${esc(p.note)}</p>`:''}
    <button class="btn" style="margin-top:1rem" data-a="practiceRun" ${plan?'':'disabled'}>연습 실행</button></section>
    ${p.results.length ? `<section class="panel"><h3>최근 비교 ${p.results.length}회</h3><p class="muted" style="font-size:.85rem">상대 조합: ${p.fixture.teams[1].map(x=>CH[x.champ].n).join(' · ')} / ${STRATEGIES[p.fixture.enemyStrategy].n}</p><div style="overflow-x:auto"><table><thead><tr><th>전술</th><th>위 / 중앙 / 아래</th><th>결과</th><th>피해</th><th>회복</th><th>죽음</th></tr></thead><tbody>${p.results.map(r=>`<tr><td>${STRATEGIES[r.strategy].n}</td><td>${[0,1,2].map(slot=>esc(r.units[r.formation.indexOf(slot)].name)).join(' / ')}</td><td>${r.winner===0?'승':'패'} ${r.score.join(':')}</td>${['dmg','heal','d'].map(k=>`<td class="num">${r.units.reduce((s,u)=>s+u[k],0)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h3 style="margin-top:1rem">최근 연습 학생별 기록</h3><div style="overflow-x:auto"><table><thead><tr><th>학생</th><th>처치</th><th>죽음</th><th>피해</th><th>회복</th></tr></thead><tbody>${p.results.at(-1).units.map(u=>`<tr><td>${esc(u.name)}</td>${['k','d','dmg','heal'].map(k=>`<td class="num">${u[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>${highlightsHtml(p.lastBattle)}`:''}`;
}
