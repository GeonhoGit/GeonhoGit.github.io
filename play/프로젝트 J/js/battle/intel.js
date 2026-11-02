// 상대 분석 기록
"use strict";

/* ---------- 상대 분석 ---------- */
function addIntel(id, picks, bans){
  if (id === 0 || id == null) return;
  const I = S.intel = S.intel || {};
  const key = school(id) ? school(id).name : id;
  const r = I[key] = I[key] || {picks:{}, bans:{}, games:0};
  r.games++;
  picks.forEach(c => r.picks[c] = (r.picks[c] || 0) + 1);
  bans.forEach(c => r.bans[c] = (r.bans[c] || 0) + 1);
}
const intelOf = id => (S.intel && S.intel[school(id) ? school(id).name : id]) || {picks:{}, bans:{}, games:0};
const topKeys = (o, n) => Object.keys(o).sort((a,b) => o[b] - o[a]).slice(0, n);
function intelHtml(id, compact){
  const sc = school(id), r = intelOf(id);
  const ace = [...sc.students].sort((a,b) => ovr(b) - ovr(a))[0];
  const els = countEls(sc.students.map(s => s.elem)), mainEl = topKeys(els, 1)[0];
  const picks = topKeys(r.picks, 3), bans = topKeys(r.bans, 2);
  const pickTxt = r.games ? (picks.length ? picks.map(c => `<span style="color:${EL[CH[c].e].c}">${CH[c].n}</span> <span class="muted num">${r.picks[c]}회</span>`).join(', ') : '-') : '<span class="muted">아직 기록 없음</span>';
  const banTxt = r.games ? (bans.length ? bans.map(c => `${CH[c].n} <span class="muted num">${r.bans[c]}회</span>`).join(', ') : '-') : '<span class="muted">아직 기록 없음</span>';
  return `<dl class="intel ${compact ? 'compact' : ''}">
    <dt>자주 고름</dt><dd>${pickTxt}</dd>
    <dt>자주 금지</dt><dd>${banTxt}</dd>
    <dt>에이스</dt><dd>${esc(ace.name)} <span class="ovr num" style="font-size:1rem">${R(ovr(ace))}</span> ${elChip(ace.elem)} ${compact ? '' : traitChips(ace)}<br><span class="muted" style="font-size:.82rem">주력 ${ace.fav.map(f => CH[f].n).join(', ')}</span></dd>
    ${compact ? '' : `<dt>학생 원소</dt><dd>${elChip(mainEl)} ${els[mainEl]}명 <span class="muted">(전체 ${sc.students.length}명)</span></dd>
    <dt>기록</dt><dd class="muted">${r.games}경기의 밴픽을 지켜봤습니다${sc.coach ? `, 코치 ${esc(sc.coach.name)} (+4%)` : ''}</dd>`}
  </dl>`;
}
// 상대가 자주 고르는 마법이면 금지 우선순위를 올리고 이유를 덧붙임
function intelBanBonus(id){ const r = intelOf(D.opp); return r.games ? (r.picks[id] || 0) / r.games * 14 : 0; }
