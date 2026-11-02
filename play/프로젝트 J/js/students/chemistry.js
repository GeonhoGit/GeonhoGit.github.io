// 학생 케미
"use strict";

/* =========================================================
   학생 케미 (함께 출전할수록 호흡이 좋아짐)
   ========================================================= */
const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const CHEM_LV = [
  {min:-99, n:'앙숙', v:-.03, cls:'bad'},
  {min:0, n:'보통', v:0, cls:'muted'},
  {min:3, n:'호흡', v:.01, cls:'good'},
  {min:7, n:'단짝', v:.02, cls:'good'},
  {min:15, n:'환상의 짝', v:.03, cls:'good'},
];
const chemPts = (a, b) => ((S && S.chem) || {})[pairKey(a, b)] || 0;
function chemLv(a, b){ const p = chemPts(a, b); let i = 0; while (i < CHEM_LV.length - 1 && p >= CHEM_LV[i+1].min) i++; return i; }
const chemOf = (a, b) => CHEM_LV[chemLv(a, b)];
function chemBonus(sid, sids){ return sids.filter(x => x !== sid).reduce((s, x) => s + chemOf(sid, x).v, 0); }
function rollRival(st, others){
  S.chem = S.chem || {};
  others.forEach(o => { if (o.id !== st.id && Math.random() < .12) S.chem[pairKey(st.id, o.id)] = -4; });
}
// 첫 학생들 사이에는 앙숙이 많아야 한 쌍
function initChem(sc){ S.chem = {}; const st = sc.students; if (Math.random() < .6){ const [a, b] = shuffle([...st]); S.chem[pairKey(a.id, b.id)] = -4; } }
// 새 학생 합류: 기존 학생 중 누군가와 앙숙일 수 있음
function joinTeam(st){
  const my = me();
  rollRival(st, my.students);
  if (!my.students.includes(st)) my.students.push(st);
  st.cond = Math.max(st.cond || 0, 80);
}
function addChem(a, b, n){ S.chem = S.chem || {}; const k = pairKey(a, b); S.chem[k] = clamp((S.chem[k] || 0) + n, -8, 20); }
function updateChem(sids, iw){
  const out = [], my = me();
  for (let i = 0; i < sids.length; i++) for (let j = i + 1; j < sids.length; j++){
    const a = sids[i], b = sids[j], before = chemLv(a, b);
    addChem(a, b, iw ? 2 : 1);
    const after = chemLv(a, b), x = findSt(my, a), y = findSt(my, b);
    if (after !== before && x && y){
      const msg = before === 0 ? `${x.name}과(와) ${y.name}이(가) 함께 뛰며 앙금을 풀었습니다.` : `${x.name}과(와) ${y.name}의 사이가 '${CHEM_LV[after].n}'이(가) 됐습니다.`;
      out.push(msg);
      if (after === CHEM_LV.length - 1){ const m = unlockAch('bestFriends'); if (m) out.push(m); }
    }
  }
  return out;
}
function pruneChem(){
  const ids = new Set(me().students.map(s => s.id));
  Object.keys(S.chem || {}).forEach(k => { const [a, b] = k.split('|'); if (!ids.has(a) || !ids.has(b)) delete S.chem[k]; });
}
function chemChip(lv){ return `<span class="chem ${lv.cls}">${lv.n}</span>`; }
// 학생 한 명의 눈에 띄는 관계 (보통은 생략)
function chemListHtml(st){
  const rel = me().students.filter(o => o.id !== st.id).map(o => ({o, lv:chemOf(st.id, o.id)})).filter(x => x.lv.v !== 0).sort((a, b) => b.lv.v - a.lv.v);
  return rel.length ? rel.map(x => `${esc(x.o.name)} ${chemChip(x.lv)}`).join(', ') : '<span class="muted">특별한 관계 없음</span>';
}
// 출전 학생끼리의 케미 요약
function chemTeamHtml(sids){
  if (sids.length < 2) return '';
  const st = id => D && D.stById[id] ? D.stById[id] : findSt(me(), id);
  const parts = [];
  for (let i = 0; i < sids.length; i++) for (let j = i + 1; j < sids.length; j++){
    const lv = chemOf(sids[i], sids[j]); if (lv.v === 0) continue;
    parts.push(`${esc(st(sids[i]).name)}·${esc(st(sids[j]).name)} ${chemChip(lv)}`);
  }
  if (!parts.length) return '<div class="muted chem-line">케미 효과 없음</div>';
  const tot = sids.reduce((s, id) => s + chemBonus(id, sids), 0) / sids.length;
  return `<div class="chem-line">케미 ${parts.join(', ')} <span class="${tot >= 0 ? 'good' : 'bad'}">평균 능력치 ${tot >= 0 ? '+' : '−'}${Math.abs(R(tot*1000)/10)}%</span></div>`;
}
