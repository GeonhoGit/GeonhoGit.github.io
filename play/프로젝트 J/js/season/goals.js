// 이사회 목표
"use strict";

/* =========================================================
   이사회 목표
   ========================================================= */
const GOALS = {
  promote:{t:() => '리그 우승으로 1부 승격', check:r => r === 1, prog:() => `지금 ${curRank()}위`},
  final:{t:() => '정규 리그 2위 이내로 결승 진출', check:() => !!(S.final && (S.final.a === 0 || S.final.b === 0)), prog:() => S.final ? (S.final.a === 0 || S.final.b === 0 ? '진출' : '탈락') : `지금 ${curRank()}위`},
  top3:{t:() => '최종 3위 이내', check:r => r <= 3, prog:() => `지금 ${curRank()}위`},
  survive:{t:() => '최하위를 피해 1부 잔류', check:r => r <= 5, prog:() => `지금 ${curRank()}위`},
  cup:{t:() => '마법사 컵 결승 진출', check:() => !!(S.cup && S.cup.season === S.season && S.cup.place && S.cup.place <= 2), prog:() => S.cup && S.cup.season === S.season ? (S.cup.place ? (S.cup.place <= 2 ? '진출' : '탈락') : S.cup.round === 1 ? '결승 대기' : '진행 중') : `${CUP_WEEK}주차 뒤 개막`},
  youth:{t:() => '1학년 학생 한 명을 2경기 이상 출전', check:() => Object.values(gsOf().youth).some(n => n >= 2), prog:() => `최다 ${Math.max(0, ...Object.values(gsOf().youth))}경기`, ok:() => me().students.some(st => st.year === 1)},
  kills:{t:() => '시즌 처치 합계 40 이상', check:() => gsOf().kills >= 40, prog:() => `${gsOf().kills}/40`},
  gold:{t:() => '시즌 동안 골드 300 이상 불리기', check:() => S.gold - gsOf().gold0 >= 300, prog:() => `${S.gold - gsOf().gold0 >= 0 ? '+' : ''}${S.gold - gsOf().gold0}/300`},
  fac:{t:() => '시설 한 단계 올리기', check:() => gsOf().fac >= 1, prog:() => gsOf().fac >= 1 ? '완료' : '아직', ok:() => Object.keys(FAC).some(k => facLevel(k) < FAC_MAX)},
  fame:{t:() => '시즌 동안 명성 45 이상 얻기', check:() => S.fame - gsOf().fame0 >= 45, prog:() => `+${S.fame - gsOf().fame0}/45`},
  win3:{t:() => '3연승 달성', check:() => gsOf().best >= 3, prog:() => `최다 ${gsOf().best}연승`},
};
const GOAL_MAIN = {reward:[250, 12], fail:12}, GOAL_SIDE = {reward:[120, 5]};
const curRank = () => standings().findIndex(s => s.player) + 1;
function gsOf(){
  if (!S.gs || S.gs.season !== S.season) S.gs = {season:S.season, kills:0, youth:{}, fac:0, gold0:S.gold, fame0:S.fame, streak:0, best:0};
  return S.gs;
}
function makeGoals(){
  const last = (S.history || []).slice(-1)[0], lr = last && last.div === S.div ? last.rank : null;
  let main;
  if (S.div === 1) main = lr && lr <= 2 ? 'final' : lr && lr <= 4 ? 'top3' : 'survive';
  else main = lr && lr <= 2 ? 'promote' : lr && lr <= 4 ? 'final' : 'top3';
  const side = shuffle(['cup', 'youth', 'kills', 'gold', 'fac', 'fame', 'win3'].filter(k => !GOALS[k].ok || GOALS[k].ok())).slice(0, 2);
  S.goals = {season:S.season, list:[{id:main, main:true}, ...side.map(id => ({id}))]};
  S.gs = null; gsOf();
}
function settleGoals(rank){
  if (!S.goals || S.goals.season !== S.season) return;
  const res = S.goals.list.map(g => {
    const done = !!GOALS[g.id].check(rank), P = g.main ? GOAL_MAIN : GOAL_SIDE;
    let gold = 0, fame = 0;
    if (done){ gold = P.reward[0]; fame = P.reward[1]; }
    else if (g.main){ fame = -GOAL_MAIN.fail; }
    S.gold += gold; S.fame = Math.max(0, S.fame + fame);
    return {id:g.id, main:!!g.main, text:GOALS[g.id].t(), done, gold, fame};
  });
  S.lastGoals = res;
  const n = res.filter(r => r.done).length;
  addNews(`이사회 평가: 목표 ${res.length}개 중 ${n}개 달성.`);
  if (n === res.length) unlockAch('boardAll');
}
function goalsHtml(endView){
  if (!S.goals || S.goals.season !== S.season) return '';
  gsOf();
  return `<section class="panel goals">
    <h3 style="margin:0 0 .4rem">이사회 목표 <span class="muted" style="font-size:.85rem">시즌 ${S.season}</span></h3>
    ${S.goals.list.map(g => { const G = GOALS[g.id], P = g.main ? GOAL_MAIN : GOAL_SIDE;
      const live = endView ? (G.check(finalRanking().findIndex(s => s.player) + 1) ? '<span class="good">달성</span>' : '<span class="bad">미달성</span>') : `<span class="muted">${G.prog()}</span>`;
      return `<div class="goal ${g.main ? 'main' : ''}"><div><b>${g.main ? '핵심 · ' : ''}${G.t()}</b><br><small class="muted">보상 ${P.reward[0]}골드, 명성 +${P.reward[1]}${g.main ? `, 실패하면 명성 −${GOAL_MAIN.fail}` : ''}</small></div><div class="goal-st">${live}</div></div>`; }).join('')}
  </section>`;
}
function lastGoalsHtml(){
  const g = S.lastGoals; if (!g) return '';
  return `<div style="margin:.6rem 0"><b>이사회 평가</b>${g.map(r => `<div style="font-size:.9rem"><span class="${r.done ? 'good' : 'bad'}">${r.done ? '달성' : '미달성'}</span> ${esc(r.text)}${r.gold ? ` <span class="muted">+${r.gold}골드</span>` : ''}${r.fame ? ` <span class="muted">명성 ${r.fame > 0 ? '+' : ''}${r.fame}</span>` : ''}</div>`).join('')}</div>`;
}
