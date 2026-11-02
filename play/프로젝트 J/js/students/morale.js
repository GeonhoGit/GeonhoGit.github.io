// 학생 사기와 이적 요청
"use strict";

/* =========================================================
   학생 사기
   ========================================================= */
const moraleMult = st => st && st.morale != null ? .95 + st.morale/100*.08 : 1;
const moraleOf = st => st.morale == null ? 70 : st.morale;
function weeklyMorale(res, iw){
  const my = me(), out = [];
  const top = [...my.students].sort((a, b) => ovr(b) - ovr(a)).slice(0, 3).map(s => s.id);
  my.students.forEach(st => {
    const m0 = moraleOf(st);
    let d;
    if (res.starters.includes(st.id)) d = 5 + (iw ? 4 : 0);
    else if (st.train === 'rest' && st.cond < 60) d = -1;
    else d = top.includes(st.id) ? -9 : -3;
    st.morale = clamp(m0 + d, 0, 100);
    if (m0 >= 30 && st.morale < 30) out.push(`${st.name}의 사기가 크게 떨어졌습니다. 출전 기회를 원합니다.`);
  });
  return out;
}
function seasonMoraleReset(){ me().students.forEach(st => st.morale = clamp(moraleOf(st) + 15, 40, 100)); }
function moraleLine(st){
  const m = moraleOf(st);
  return `<div class="sbar"><span class="muted">사기</span>${condBar(m)}<b class="num ${m < 30 ? 'bad' : ''}">${R(m)}</b></div>`;
}
function moraleWarnHtml(){
  const low = me().students.filter(st => moraleOf(st) < 35);
  return low.length ? `<p class="bad" style="font-size:.9rem">사기가 낮은 학생: ${low.map(st => `${esc(st.name)} ${R(moraleOf(st))}`).join(', ')} (출전시키면 회복합니다)</p>` : '';
}
// 이적 요청: 사기가 바닥인 학생이 있으면 사건으로 먼저 올림
function wantOutEvent(){
  const now = S.season * 10 + S.week;
  const st = me().students.filter(x => moraleOf(x) < 25 && (x.askAt == null || now - x.askAt >= 3)).sort((a, b) => moraleOf(a) - moraleOf(b))[0];
  if (!st) return false;
  st.askAt = now;
  S.event = {id:'wantOut', data:st.id};
  return true;
}
function transferOut(st, mult){
  const my = me(); if (!findSt(my, st.id) || my.students.length <= 3) return 0;
  const buyers = S.schools.filter(sc => !sc.player && sc.students.length < 7);
  const buyer = [...buyers].sort((a, b) => a.students.length - b.students.length || Math.random() - .5)[0]; if (!buyer) return 0;
  const fee = R(saleFee(st) * mult);
  my.students = my.students.filter(x => x !== st);
  st.gear = null; delete st.contract; delete st.morale; st.train = null;
  buyer.students.push(st); S.gold += fee; pruneChem();
  addNews(`${st.name}이(가) ${buyer.name}(으)로 떠났습니다. 이적료 ${fee}골드를 받았습니다.`);
  return fee;
}
