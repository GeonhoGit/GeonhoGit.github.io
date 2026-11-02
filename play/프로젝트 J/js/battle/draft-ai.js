// 밴픽 점수, 원소 조합, 상대 AI, 난이도 보정
"use strict";

/* =========================================================
   드래프트 계산, 시너지, AI
   ========================================================= */
function champPower(id){ const p = patchOf(id); return 50 * Math.sqrt(p.hp * p.atk) / Math.sqrt(p.cd); }
// 이 학생이 이 마법을 맡았을 때 예상 전투력 (100 근처)
function fitScore(st, id){
  const c = CH[id];
  let m = condMult(st.cond);
  if (st.elem === c.e) m *= hasT(st, 'prodigy') ? 1.2 : 1.10;
  if (st.fav.includes(id)) m *= 1.08;
  m *= mastMult(st, id);
  return 100 * m * ((0.6 + st.atk/100*0.8) + (0.6 + st.def/100*0.8) + (0.85 + st.int/100*0.3)) / 3;
}
function tagsFor(st, id){ const t = []; if (st.elem === CH[id].e) t.push('원소 일치'); if (st.fav.includes(id)) t.push('주력'); const l = st.mastery ? mastLv(st, id) : 0; if (l) t.push('숙련 Lv' + l); return t; }
function available(){
  const used = new Set([...D.bans[0], ...D.bans[1], ...D.picks[0].map(p => p.champ), ...D.picks[1].map(p => p.champ)]);
  return CHK.filter(k => !used.has(k));
}
function freeStudents(team){
  const used = new Set(D.picks[team].map(p => p.sid));
  return D.roster[team].filter(id => !used.has(id)).map(id => D.stById[id]);
}
const teamEls = team => D.picks[team].map(p => CH[p.champ].e);
// team 입장에서 이 마법이 얼마나 좋은 선택인지
function draftScore(team, id){
  const c = CH[id], free = freeStudents(team), roles = D.picks[team].map(p => CH[p.champ].role), myEls = teamEls(team);
  let s = champPower(id) + (free.length ? Math.max(...free.map(st => fitScore(st, id))) * .3 : 0);
  teamEls(1-team).forEach(e => { if (EL[c.e].beats === e) s += 6; if (EL[e].beats === c.e) s -= 6; });
  if (myEls.includes(c.e)) s += 5;
  if (c.role === '수호' && !roles.includes('수호')) s += 8;
  if (c.role === '치유' && !roles.includes('치유') && roles.length >= 1) s += 7;
  if (roles.includes(c.role)) s -= 7;
  return s;
}
function aiChoose(team, kind){
  let best = null, bs = -1e9;
  for (const id of available()){
    const s = (kind === 'ban' ? draftScore(1-team, id) : draftScore(team, id)) + rnd(0, 9);
    if (s > bs){ bs = s; best = id; }
  }
  return best;
}
function aiAssign(team, champ){
  return freeStudents(team).sort((a,b) => fitScore(b, champ) - fitScore(a, champ))[0].id;
}
function recommended(){
  return available().map(id => [id, draftScore(0, id)]).sort((a,b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
}

// 원소 시너지
const SYN = {
  fire:{n:'불의 기세', d:n => `공격력 +${n >= 3 ? 12 : 6}%`},
  water:{n:'물의 순환', d:n => `매초 체력 ${n >= 3 ? 1.6 : 0.8}% 회복`},
  wind:{n:'바람의 발걸음', d:n => `이동과 공격 속도 +${n >= 3 ? 22 : 11}%`},
  earth:{n:'대지의 갑옷', d:n => `방어 +${n >= 3 ? 60 : 30}%`},
  light:{n:'빛의 가호', d:n => `시작과 부활 때 최대 체력 ${n >= 3 ? 36 : 25}% 보호막`},
  dark:{n:'어둠의 갈증', d:n => `준 피해의 ${n >= 3 ? 22 : 14}% 흡혈`},
};
function countEls(els){ const c = {}; els.forEach(e => c[e] = (c[e] || 0) + 1); return c; }
function synergies(els){
  const cnt = countEls(els), out = [];
  ELK.forEach(e => { if ((cnt[e] || 0) >= 2) out.push({e, name:SYN[e].n, desc:SYN[e].d(cnt[e])}); });
  if (els.length === 3 && new Set(els).size === 3) out.push({e:null, name:'삼원 조화', desc:'주문 재사용 시간 −12%'});
  return out;
}
function synHtml(els, right){
  const s = synergies(els);
  return `<div class="syns" style="${right ? 'text-align:right' : ''}">${s.length ? s.map(x => `<div>${x.e ? elChip(x.e) : '<span class="el" style="color:var(--brass)">조화</span>'} ${x.name} <span class="muted">${x.desc}</span></div>`).join('') : '<div class="muted">조합 효과 없음</div>'}</div>`;
}
function applySyn(u, els){
  const c = countEls(els), f = c.fire || 0, wa = c.water || 0, wi = c.wind || 0, ea = c.earth || 0;
  if (f >= 2) u.atk *= f >= 3 ? 1.12 : 1.06;
  if (wa >= 2) u.regen = wa >= 3 ? .016 : .008;
  if (wi >= 2){ const k = wi >= 3 ? 1.22 : 1.11; u.spd *= k; u.acd /= k; }
  if (ea >= 2) u.def *= ea >= 3 ? 1.6 : 1.3;
  if (els.length === 3 && new Set(els).size === 3) u.scd *= .88;
  const li = c.light || 0, da = c.dark || 0;
  if (li >= 2){ u.spawnShield = li >= 3 ? .36 : .25; u.shield = u.maxHp*u.spawnShield; u.shT = 8; }
  if (da >= 2) u.lifesteal = da >= 3 ? .22 : .14;
}
