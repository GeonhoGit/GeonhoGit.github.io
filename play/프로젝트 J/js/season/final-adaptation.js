// 결승의 공개된 직전 경기만 보고 다음 경기의 대응을 준비합니다.
"use strict";

const FINAL_COUNTER = {pressure:'protect', protect:'kite', kite:'pressure'};
function finalPairMatches(ids){
  const f = S && S.final;
  return !!(f && Array.isArray(ids) && ids.length === 2 && ids[0] !== ids[1] && ids.includes(f.a) && ids.includes(f.b));
}
function recordFinalScout(bt, schoolIds){
  if (!S || S.phase !== 'final' || !S.final || S.final.winner != null || !bt || !bt.over || !finalPairMatches(schoolIds)) return false;
  const teams = schoolIds.map((schoolId, team) => {
    const picks = bt.units.filter(u => u.team === team).map(u => ({sid:u.st.id, name:u.st.name, champ:u.champ, k:u.k, d:u.d, dmg:R(u.dmg), heal:R(u.heal)}));
    const ace = [...picks].sort((a,b) => (b.k*300+b.dmg+b.heal)-(a.k*300+a.dmg+a.heal))[0];
    return {schoolId, name:school(schoolId).name, score:bt.score[team], strategy:strategyKey(bt.strategies && bt.strategies[team]), picks,
      keyChamp:ace ? ace.champ : null, performer:ace ? ace.name : ''};
  });
  if (teams.some(t => !t.picks.length)) return false;
  // 호출 위치는 결승 games에 이번 결과를 넣기 전입니다.
  S.final.scout = {round:S.final.games.length+1, teams};
  return true;
}
function finalPlanFor(schoolId, opponentId){
  if (!S || S.phase !== 'final' || !S.final || S.final.winner != null || !finalPairMatches([schoolId, opponentId])) return null;
  const scout = S.final.scout;
  if (!scout || !Array.isArray(scout.teams)) return null;
  const other = scout.teams.find(t => t.schoolId === opponentId);
  if (!other) return null;
  return {schoolId, opponentId, round:scout.round, strategy:FINAL_COUNTER[strategyKey(other.strategy)], previousStrategy:strategyKey(other.strategy),
    champ:other.keyChamp && CHK.includes(other.keyChamp) ? other.keyChamp : null, performer:other.performer || ''};
}
function prepareFinalDraft(draft, schoolIds){
  if (!draft) return false;
  draft.finalPlans = [null,null];
  if (draft.practice || !finalPairMatches(schoolIds)) return false;
  draft.finalPlans = schoolIds.map((id,team) => finalPlanFor(id,schoolIds[1-team]));
  draft.finalPlans.forEach((plan,team) => {
    if (plan && !school(schoolIds[team]).player) draft.strategies[team] = plan.strategy;
  });
  return draft.finalPlans.some(Boolean);
}
function finalBanBonus(team, champ){
  if (!S || S.phase !== 'final' || !S.final || S.final.winner != null || !D || D.practice) return 0;
  const plan = D.finalPlans && D.finalPlans[team];
  return plan && plan.champ === champ ? 22 : 0;
}
function finalAdaptationHtml(opponentId){
  if (!S || S.phase !== 'final' || !S.final || !S.final.scout || !finalPairMatches([0,opponentId])) return '';
  const scout = S.final.scout, plan = finalPlanFor(opponentId,0);
  if (!plan) return '';
  const spell = id => CH[id] ? CH[id].n : '이전 마법';
  return `<section class="panel" style="margin-bottom:1rem"><h3>결승 ${scout.round}차전 분석 · 다음 경기 대응</h3>
    <div style="overflow-x:auto"><table><thead><tr><th>학교</th><th>직전 조합·전술</th><th>주요 활약</th></tr></thead><tbody>${scout.teams.map(t => `<tr><td>${esc(t.name)}<br><span class="num muted">${t.score}처치</span></td><td>${t.picks.map(p => spell(p.champ)).join(' · ')}<br><span class="muted">${STRATEGIES[strategyKey(t.strategy)].n}</span></td><td>${esc(t.performer)} · ${spell(t.keyChamp)}</td></tr>`).join('')}</tbody></table></div>
    <p style="margin-top:.6rem">${esc(school(opponentId).name)}은(는) 지난 경기의 <b>${STRATEGIES[plan.previousStrategy].n}</b>에 대응해 <b>${STRATEGIES[plan.strategy].n}</b> 전술을 준비합니다.${plan.champ ? ` ${spell(plan.champ)}을(를) 경계해 금지 우선순위도 높입니다.` : ''}</p>
    <p class="muted" style="font-size:.8rem">직전 경기의 공개 기록에 따른 대응입니다. 우리 팀의 새 선택을 미리 읽거나 상대 능력치를 올리지 않습니다.</p></section>`;
}
