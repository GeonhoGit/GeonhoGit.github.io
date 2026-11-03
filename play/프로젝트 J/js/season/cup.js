// 마법사 컵
"use strict";

/* =========================================================
   마법사 컵 (시즌 중 단판 토너먼트)
   ========================================================= */
const CUP_WEEK = 3;  // 3주차 경기가 끝나면 열림
const CUP_PRIZE = [[220, 15], [100, 6], [40, 2]];
function startCup(){
  const ai = standings().filter(s => !s.player).slice(0, 3).map(s => s.id);
  const seeds = shuffle([0, ...ai]);
  S.cup = {season:S.season, semis:[[seeds[0], seeds[1]], [seeds[2], seeds[3]]], round:0, final:null, winner:null, place:null, log:[]};
  S.phase = 'cup';
  addNews(`마법사 컵 개막: 리그 상위 세 학교와 우리가 단판 토너먼트를 치릅니다. 우승 상금 ${CUP_PRIZE[0][0]}골드와 희귀 마법 도구 선택 보상이 걸려 있습니다.`);
}
function cupOpponent(){
  const C = S.cup;
  if (C.round === 0){ const p = C.semis.find(x => x.includes(0)); return p[0] === 0 ? p[1] : p[0]; }
  return C.final[0] === 0 ? C.final[1] : C.final[0];
}
const cupRoundName = () => S.cup && S.cup.round === 1 ? '결승' : '준결승';
function applyCup(res){
  const C = S.cup, iw = res.winner === 0, opp = school(res.opp), out = [];
  settleNextBuff(iw);
  addIntel(res.opp, D.picks[1].map(p => p.champ), D.bans[1]);
  aiFatigue(opp, D.picks[1].map(p => p.sid));
  S.gold += iw ? 60 : 30; S.fame += iw ? 5 : 2;
  out.push(...progressStudents(res, iw));
  C.log.push({r:cupRoundName(), a:0, b:opp.id, w:iw ? 0 : opp.id, sa:res.score[0], sb:res.score[1]});
  if (C.round === 0){
    const other = C.semis.find(p => !p.includes(0));
    const r = quickSim(school(other[0]), school(other[1]));
    C.log.push({r:'준결승', a:r.win.id, b:r.lose.id, w:r.win.id, sa:r.ks, sb:r.kl});
    if (iw){
      C.round = 1; C.final = [0, r.win.id];
      addNews(`마법사 컵 준결승에서 ${opp.name}을(를) 꺾었습니다. 결승 상대는 ${r.win.name}입니다.`);
      out.push(`마법사 컵 결승 진출! 상대는 ${r.win.name}입니다.`);
    } else {
      const f = quickSim(opp, r.win);
      C.log.push({r:'결승', a:f.win.id, b:f.lose.id, w:f.win.id, sa:f.ks, sb:f.kl});
      C.winner = f.win.id;
      out.push(...finishCup(3));
    }
  } else {
    C.winner = iw ? 0 : opp.id;
    out.push(...finishCup(iw ? 1 : 2));
  }
  payWages();
  save();
  return out;
}
function finishCup(place){
  const C = S.cup, [g, f] = CUP_PRIZE[place - 1], out = [];
  C.place = place; S.gold += g; S.fame += f;
  const champ = school(C.winner).name;
  if (place === 1){
    S.cupWins = (S.cupWins || 0) + 1;
    createCupReward();
    out.push(`마법사 컵 우승! 상금 ${g}골드, 명성 +${f}. 희귀 마법 도구 세 가지 중 하나를 선택할 수 있습니다. 보상은 받을 때까지 보관됩니다.`);
    addNews(`${me().name}이(가) 마법사 컵에서 우승했습니다.`);
    const m = unlockAch('cupWin'); if (m) out.push(m);
  } else {
    out.push(`마법사 컵 ${place === 2 ? '준우승' : '4강'}: 상금 ${g}골드, 명성 +${f}. 우승은 ${champ}.`);
    addNews(`마법사 컵 우승: ${champ}.`);
  }
  S.phase = 'hub';
  rollEvent();
  return out;
}
function cupHtml(){
  const C = S.cup; if (!C || C.season !== S.season) return '';
  const nm = id => `<span class="${id === 0 ? 'me' : ''}">${esc(school(id).name)}</span>`;
  const semis = C.semis.map(p => nm(p[0]) + ' 대 ' + nm(p[1])).join('<br>');
  const log = C.log.map(x => `<div style="font-size:.88rem">${x.r}: ${nm(x.w)} 승 <span class="num muted">${x.w === x.a ? x.sa : x.sb}:${x.w === x.a ? x.sb : x.sa}</span></div>`).join('');
  return `<section class="panel final-box cup-box">
    <h3 style="margin:0">마법사 컵 <span class="muted" style="font-size:.85rem">단판 토너먼트</span></h3>
    <p style="font-size:.9rem;margin:.4rem 0">${semis}</p>
    ${log}
    ${C.winner != null ? `<p class="${C.winner === 0 ? 'good' : ''}" style="margin-top:.4rem">우승: ${esc(school(C.winner).name)}</p>` : `<p class="muted" style="font-size:.85rem;margin-top:.4rem">다음 경기: ${cupRoundName()}. 우승 상금 ${CUP_PRIZE[0][0]}골드와 희귀 마법 도구 선택 보상.</p>`}
  </section>`;
}
