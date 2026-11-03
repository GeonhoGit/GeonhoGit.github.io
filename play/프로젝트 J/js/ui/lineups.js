// 저장한 출전 조합은 밴픽 순서를 지키며 한 명씩 다시 선택합니다.
"use strict";

const LINEUP_NAMES = ['주전 조합', '신입생 육성', '수비 조합'];
function renderLineupControls(){
  render();
  const panel = document.getElementById('lineup-controls'), fold = panel?.closest('details');
  if (fold) fold.open = true;
  panel?.scrollIntoView({block:'nearest'});
}
function lineupSlot(value){
  return (typeof value === 'number' && Number.isInteger(value) || typeof value === 'string' && /^[0-2]$/.test(value)) && +value >= 0 && +value < 3 ? +value : null;
}
function copyLineup(plan){
  if (!plan || !Array.isArray(plan.picks) || plan.picks.length !== 3 || plan.picks.some(p => !p || typeof p.sid !== 'string' || typeof p.champ !== 'string')) return null;
  if (new Set(plan.picks.map(p => p.sid)).size !== 3 || new Set(plan.picks.map(p => p.champ)).size !== 3) return null;
  const formation = Array.isArray(plan.formation) && plan.formation.length === 3 && new Set(plan.formation).size === 3 && plan.formation.every(n => [0,1,2].includes(n)) ? [...plan.formation] : [0,1,2];
  return {picks:plan.picks.map(p => ({sid:p.sid, champ:p.champ, name:typeof p.name === 'string' ? p.name : '이전 학생'})), formation, strategy:strategyKey(plan.strategy)};
}
function lineupAt(slot){
  const n = lineupSlot(slot);
  return n !== null && S && Array.isArray(S.lineups) ? copyLineup(S.lineups[n]) : null;
}
function loadActiveLineup(){
  if (!D || !S) return false;
  const plan = lineupAt(S.activeLineup);
  D.lineup = plan; D.lineupSlot = plan ? lineupSlot(S.activeLineup) : null;
  return !!plan;
}
function saveLineup(slot){
  const n = lineupSlot(slot);
  if (n === null || !S || !D || V.view !== 'draft' || curTurn() || D.picks[0].length !== 3) return false;
  if (D.picks[0].some(p => !findSt(me(), p.sid) || !CHK.includes(p.champ))) return false;
  const plan = copyLineup({picks:D.picks[0].map(p => ({...p, name:findSt(me(), p.sid).name})), formation:formationOf(), strategy:D.strategies[0]});
  if (!plan) return false;
  const slots = Array.isArray(S.lineups) ? S.lineups.slice(0,3) : [];
  slots[n] = plan; S.lineups = slots; S.activeLineup = n;
  D.lineup = copyLineup(plan); D.lineupSlot = n;
  return true;
}
function selectLineup(slot){
  const n = lineupSlot(slot), plan = lineupAt(slot);
  if (!plan || !S || !['hub','draft'].includes(V.view)) return false;
  S.activeLineup = n; S.teamStrategy = plan.strategy;
  if (V.view === 'draft' && D){
    D.lineup = copyLineup(plan); D.lineupSlot = n; D.strategies[0] = plan.strategy; D.pred = null;
    applyLineupFormation();
  }
  return true;
}
function clearLineup(){
  if (!S || !['hub','draft'].includes(V.view)) return false;
  S.activeLineup = null;
  if (V.view === 'draft' && D){ D.lineup = null; D.lineupSlot = null; }
  return true;
}
function lineupStatus(plan, inDraft){
  if (!plan) return [];
  return plan.picks.map(p => {
    const student = findSt(me(), p.sid), picked = inDraft ? D.picks[0].find(x => x.sid === p.sid) : null;
    let reason = '', chosen = false;
    if (!student || inDraft && !D.roster[0].includes(p.sid)) reason = '졸업·이적으로 명단에서 빠짐';
    else if (!Object.hasOwn(CH, p.champ) || !CHK.includes(p.champ)) reason = '현재 사용할 수 없는 마법';
    else if (picked){ if (picked.champ === p.champ) chosen = true; else reason = '학생을 다른 마법으로 이미 선택함'; }
    else if (inDraft && D.bans.some(bans => bans.includes(p.champ))) reason = '금지된 마법';
    else if (inDraft && D.picks.some(picks => picks.some(x => x.champ === p.champ))) reason = '이미 선택된 마법';
    return {...p, student, reason, chosen};
  });
}
function lineupPick(){
  if (!D || V.view !== 'draft' || !D.lineup) return null;
  const turn = curTurn(); if (!turn || turn.team !== 0 || turn.kind !== 'pick') return null;
  const option = lineupStatus(D.lineup, true).find(p => !p.reason && !p.chosen);
  return option ? {sid:option.sid, champ:option.champ} : null;
}
function applyLineupFormation(){
  if (!D || !D.lineup || curTurn() || D.picks[0].length !== 3) return false;
  const plan = copyLineup(D.lineup); if (!plan) return false;
  const f = D.picks[0].map(p => { const i = plan.picks.findIndex(saved => saved.sid === p.sid); return i < 0 ? null : plan.formation[i]; });
  const free = [0,1,2].filter(slot => !f.includes(slot));
  D.formation = f.map(slot => slot === null ? free.shift() : slot);
  D.pred = null;
  return true;
}
function lineupsHtml(){
  const inDraft = V.view === 'draft' && !!D, canSave = inDraft && !curTurn() && D.picks[0].length === 3;
  const active = inDraft ? D.lineupSlot : lineupSlot(S.activeLineup);
  return `<section id="lineup-controls" class="panel" style="margin-bottom:1rem"><h3>출전 조합 저장</h3>
    <p class="muted" style="font-size:.85rem">학생·마법·배치·팀 전술을 세 조합까지 저장합니다. 밴픽에서는 가능한 학생부터 한 명씩 불러옵니다.</p>
    <div class="stack" style="gap:.5rem">${LINEUP_NAMES.map((name, slot) => {
      const plan = lineupAt(slot), warnings = lineupStatus(plan, false).filter(p => p.reason);
      return `<div class="spread" style="gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--line)"><div><b>${name}</b>
        <div class="muted" style="font-size:.8rem">${plan ? plan.picks.map(p => `${esc(p.name)} · ${Object.hasOwn(CH,p.champ) ? CH[p.champ].n : '이전 마법'}`).join(' / ') : '아직 저장한 조합이 없습니다.'}</div>
        ${plan ? `<div class="muted" style="font-size:.8rem">전술: ${STRATEGIES[plan.strategy].n}</div>` : ''}
        ${warnings.map(p => `<div class="bad" style="font-size:.8rem">${esc(p.name)}: ${p.reason}</div>`).join('')}</div>
        <div class="row"><button class="btn ghost small" data-a="lineupSelect" data-v="${slot}" aria-pressed="${!!plan && active === slot}" ${plan ? '' : 'disabled'}>불러오기</button>
        ${canSave ? `<button class="btn ghost small" data-a="lineupSave" data-v="${slot}">${plan ? '현재 조합으로 갱신' : '현재 조합 저장'}</button>` : ''}</div></div>`;
    }).join('')}</div>
    ${!canSave ? '<p class="muted" style="font-size:.8rem;margin-top:.5rem">밴픽을 마치면 현재 조합을 저장할 수 있습니다.</p>' : ''}
    ${active !== null && lineupAt(active) ? '<button class="btn ghost small" style="margin-top:.5rem" data-a="lineupClear">조합 선택 해제</button>' : ''}</section>`;
}
function lineupPickHtml(){
  if (!D || !D.lineup || V.view !== 'draft') return '';
  const turn = curTurn(); if (!turn || turn.team !== 0 || turn.kind !== 'pick') return '';
  const option = lineupPick(), warnings = lineupStatus(D.lineup, true).filter(p => p.reason);
  return `<section class="panel" style="margin-bottom:1rem"><h3>${LINEUP_NAMES[D.lineupSlot] || '저장한 조합'}에서 선택</h3>
    ${option ? `<button class="btn" data-a="lineupPick">${esc(findSt(me(),option.sid).name)} · ${CH[option.champ].n} 선택</button>` : '<p class="muted">그대로 불러올 수 있는 조합이 없습니다. 다른 학생과 마법을 직접 선택하세요.</p>'}
    ${warnings.map(p => `<p class="bad" style="font-size:.85rem">${esc(p.name)} · ${Object.hasOwn(CH,p.champ) ? CH[p.champ].n : '이전 마법'}: ${p.reason}. 교체가 필요합니다.</p>`).join('')}</section>`;
}
function matchReadinessHtml(){
  if (!S) return '';
  const inDraft = V.view === 'draft' && !!D, plan = inDraft ? D.lineup : lineupAt(S.activeLineup);
  const selected = inDraft ? D.picks[0] : plan ? plan.picks : [];
  const students = selected.map(p => findSt(me(), p.sid)).filter(Boolean), pending = pendingTrain();
  const training = pending ? `훈련 수정 ${pending}건이 아직 반영되지 않았습니다.` : S.trainSet ? '이번 주 훈련을 확정했습니다.' : '이번 주 훈련 미확정 · 그대로 진행하면 지난 계획을 사용합니다.';
  const ready = me().students.filter(specializationReady).length;
  const story = S.stories && S.stories.active;
  let promise = '';
  if (story && story.stage === 'waiting'){
    const names = story.names.map(esc).join(' · '), picked = story.ids.filter(id => students.some(st => st.id === id)).length;
    const text = {chance:`${names} 출전 약속`, together:`${names} 함께 출전 약속`, space:`${names} 동시 출전 피하기`, prepare:`${names} 훈련하며 다음 기회 준비`}[story.choice];
    if (text) promise = `<p style="font-size:.85rem">학생 이야기: ${text}${students.length ? ` · 현재 명단 ${picked}/${story.ids.length}명 포함` : ''}</p>`;
  }
  return `<section class="panel" style="margin-bottom:1rem"><h3>경기 준비 확인</h3><p class="${pending || !S.trainSet ? 'bad' : 'good'}" style="font-size:.85rem">${training}</p>
    ${students.length ? `<div style="overflow-x:auto"><table><thead><tr><th>학생</th><th>컨디션</th><th>마법 도구</th></tr></thead><tbody>${students.map(st => {
      const item = gearOf(st);
      return `<tr><td>${esc(st.name)}</td><td class="num ${st.cond < 60 ? 'bad' : ''}">${R(st.cond)}${st.cond < 60 ? ' · 휴식 권장' : ''}</td><td>${item && GEAR[item.k] ? GEAR[item.k].n : '<span class="muted">미장착</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>` : `<p class="muted" style="font-size:.85rem">${inDraft ? '출전 학생을 선택하면 컨디션과 장비를 확인할 수 있습니다.' : '저장한 조합을 불러오면 예정 학생의 컨디션과 장비를 확인할 수 있습니다.'}</p>`}
    ${ready ? `<p style="font-size:.85rem">성장 전문화를 선택할 수 있는 학생 ${ready}명</p>` : ''}${promise}
    ${V.view === 'hub' ? '<div class="row" style="margin-top:.5rem"><button class="btn ghost small" data-a="go" data-v="train">훈련 확인</button><button class="btn ghost small" data-a="go" data-v="students">학생·장비 확인</button></div>' : ''}</section>`;
}
