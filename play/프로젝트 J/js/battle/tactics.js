// 경기 중 작전 지시
"use strict";

/* ---------- 작전 지시 ---------- */
const TACTICS = {
  focus:{n:'집중 공격', d:'6초 동안 체력이 가장 낮은 적을 함께 노리고 피해 +15%', dur:6, key:'Q'},
  guard:{n:'수호 진형', d:'6초 동안 받는 피해 −30%', dur:6, key:'W'},
  regroup:{n:'재정비', d:'전원 진영으로 물러나 3초 동안 체력 30% 회복', dur:3, key:'E'},
  surge:{n:'주문 폭발', d:'모든 아군 주문을 즉시 다시 쓸 수 있게 함', dur:0, key:'R'},
};
const TACK = Object.keys(TACTICS), TAC_USES = 2;
const tacOn = (B, team, k) => !!(B.tac && B.tac[team].active[k] > 0);
function useTactic(B, team, k){
  const T = B.tac[team];
  if (B.over || B.paused || !TACTICS[k] || T.left <= 0 || T.used.includes(k)) return false;
  T.left--; T.used.push(k);
  if (!B.headless) sfx('tactic');
  completeTacticLesson(B, team);
  B.tacticLog.push({t:B.t, team, k, score:[...B.score]});
  if (k === 'surge') B.units.forEach(u => { if (u.team === team && u.alive) u.sk = 0; });
  else T.active[k] = TACTICS[k].dur;
  if (k === 'regroup') B.units.forEach(u => { if (u.team === team && u.alive){ u.retreat = 3; u.taunt = 0; } });
  B.feed.unshift({team, text:`${team === 0 ? '우리' : '상대'} 작전: ${TACTICS[k].n}`}); B.feed = B.feed.slice(0, 4);
  if (!B.headless) B.fx.push({k:'banner', s:`${team === 0 ? '우리' : '상대'} 작전: ${TACTICS[k].n}`, col: team === 0 ? '#dcb96e' : '#ef8aa2', t:0, life:1.6});
  return true;
}
// AI가 작전을 쓰는 규칙 (상대 팀, 그리고 건너뛰기·모의전에서는 우리 팀도)
function aiTactics(B, team){
  const T = B.tac[team];
  if (T.left <= 0 || B.t < T.next) return;
  T.next = B.t + .5;
  const mine = B.units.filter(u => u.team === team && u.alive);
  const hpAvg = mine.length ? mine.reduce((s,u) => s + u.hp/u.maxHp, 0) / mine.length : 1;
  const behind = B.score[team] < B.score[1-team], late = B.t >= B.dur - 12;
  const can = k => !T.used.includes(k);
  if (can('regroup') && mine.length >= 2 && hpAvg < .38 && B.t < B.dur - 5) return useTactic(B, team, 'regroup');
  if (can('guard') && tacOn(B, 1-team, 'focus')) return useTactic(B, team, 'guard');
  if (can('focus') && behind && B.t > 22) return useTactic(B, team, 'focus');
  if (late){ for (const k of ['focus','surge','guard']) if (can(k)) return useTactic(B, team, k); }
}
function tacticTick(B, dt){
  if (!B.tac) return;
  [0,1].forEach(t => {
    const a = B.tac[t].active; for (const k in a){ a[k] -= dt; if (a[k] <= 0) delete a[k]; }
    if (B.autoTac[t]) aiTactics(B, t);
  });
}
function tacticBar(){
  return `<div class="tactics" id="tactics" role="group" aria-label="작전 지시">
    <span class="tac-left muted" id="tacLeft"></span>
    ${TACK.map(k => `<button class="tac" data-a="tactic" data-v="${k}" title="${TACTICS[k].d} (단축키 ${TACTICS[k].key})"><b>${TACTICS[k].n}</b><small>${TACTICS[k].d}</small></button>`).join('')}
  </div>`;
}
function tacticState(){
  const box = document.getElementById('tactics'); if (!box || !B.tac) return;
  const T = B.tac[0];
  document.getElementById('tacLeft').textContent = `남은 작전 ${T.left}/${TAC_USES}`;
  box.querySelectorAll('.tac').forEach(b => {
    const k = b.dataset.v, used = T.used.includes(k);
    b.disabled = B.over || B.paused || B.autoTac[0] || used || T.left <= 0;
    b.classList.toggle('on', tacOn(B, 0, k));
    b.classList.toggle('used', used);
  });
}
function drawTactics(c){
  const {CW, K} = arena();
  [0,1].forEach(t => {
    const col = t === 0 ? '#dcb96e' : '#ef8aa2';
    if (tacOn(B, t, 'focus')){
      const fs = B.units.filter(o => o.alive && o.team !== t).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp);
      const f = fs[0];
      if (f){ const [x, y] = P(f.x, f.y); c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 27*K, 0, Math.PI*2); c.stroke();
        for (const a of [0, Math.PI/2, Math.PI, Math.PI*1.5]){ c.beginPath(); c.moveTo(x + Math.cos(a)*22*K, y + Math.sin(a)*22*K); c.lineTo(x + Math.cos(a)*33*K, y + Math.sin(a)*33*K); c.stroke(); } }
    }
    if (tacOn(B, t, 'guard')) B.units.forEach(u => { if (u.alive && u.team === t){ const [x, y] = P(u.x, u.y); c.strokeStyle = 'rgba(191,227,255,.8)'; c.lineWidth = 2; c.setLineDash([5,4]); c.beginPath(); c.arc(x, y, 23*K, 0, Math.PI*2); c.stroke(); c.setLineDash([]); } });
  });
  for (const f of B.fx){
    if (f.k !== 'banner') continue;
    const p = f.t/f.life;
    c.globalAlpha = p > .75 ? (1-p)/.25 : 1;
    c.font = `bold ${Math.round(24*K)}px "Song Myung", serif`; c.lineWidth = 5; c.strokeStyle = 'rgba(12,14,34,.92)';
    c.strokeText(f.s, CW/2, 30*K); c.fillStyle = f.col; c.fillText(f.s, CW/2, 30*K); c.globalAlpha = 1;
  }
}
