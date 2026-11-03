// 주간 진행, 성장, 시즌 종료, 결승전
"use strict";

/* =========================================================
   주간 진행
   ========================================================= */
// 리그 난이도 보정: AI 학교는 시즌마다 시설·숙련을 대신하는 보정을 받고, 연속 우승한 우리 학교는 견제를 받음
function aiSeasonBonus(){ return Math.min(.07, .014*(((S && S.season) || 1) - 1)); }
// AI 학교도 시즌이 갈수록 시설·코치가 좋아져 더 빨리 성장함
function aiGrowRamp(){ return Math.min(1.45, 1 + .09*(((S && S.season) || 1) - 1)); }
const recentTitles = () => ((S && S.history) || []).slice(-3).filter(h => h.rank === 1).length;
function rivalryBonus(){ return Math.min(.15, recentTitles() * .05) * diff().riv; }
function teamBonus(sc, vsPlayer){
  if (sc.player) return (S.nextBuff ? S.nextBuff.v : 0) + (coachActive() ? .03 : 0) + comebackBonus();
  return (sc.coach ? .04 : 0) + aiSeasonBonus() + (vsPlayer ? rivalryBonus() + streakPressure() : 0) + diff().ai + (S.div === 1 ? DIV1_BONUS : 0);
}
// AI 학생도 출전하면 지치고 쉬면 회복 (그래서 AI도 선수를 돌려 씀)
function aiFatigue(sc, playedIds){
  if (!sc || sc.player) return;
  sc.students.forEach(st => { st.cond = clamp(st.cond + (playedIds.includes(st.id) ? -10 : 12), 30, 100); });
}
function quickSim(a, b, isFinal = false){ // AI끼리 경기
  const savedDraft = D, teams = Math.random() < .5 ? [a,b] : [b,a];
  const stById = {};
  teams.forEach(sc => sc.students.forEach(st => stById[st.id] = st));
  D = {bans:[[],[]], picks:[[],[]], roster:teams.map(sc => sc.students.map(st => st.id)), stById, strategies:teams.map(schoolStrategy)};
  try {
    if (isFinal) prepareFinalDraft(D, teams.map(sc => sc.id));
    for (const [team, kind] of [[0,'ban'],[1,'ban'],[0,'pick'],[1,'pick'],[1,'pick'],[0,'pick'],[0,'pick'],[1,'pick']]){
      const champ = aiChoose(team, kind);
      if (kind === 'ban') D.bans[team].push(champ);
      else D.picks[team].push({champ, sid:aiAssign(team, champ)});
    }
    teams.forEach((sc, t) => addIntel(sc.id, D.picks[t].map(p => p.champ), D.bans[t]));
    const battle = newBattle(teams.map((sc, team) => D.picks[team].map(p => ({champ:p.champ, st:stById[p.sid], bonus:teamBonus(sc, false)}))), pickMap(), D.strategies);
    runHeadless(battle);
    if (isFinal) recordFinalScout(battle, teams.map(sc => sc.id));
    teams.forEach((sc, t) => aiFatigue(sc, D.picks[t].map(p => p.sid)));
    const winner = battle.winner, loser = 1 - winner;
    return {win:teams[winner], lose:teams[loser], ks:battle.score[winner], kl:battle.score[loser]};
  } finally { D = savedDraft; }
}
function nextCondition(st, played){ return policyCondition(st, played, condAfter(st, played)); }
function growStudent(st, focus, scale){
  const yf = [1.3, 1.1, .9, .7][st.year-1] || .7;
  const g = rnd(.4, 1.6) * (.6 + st.pot*.2) * yf * scale * traitGrow(st);
  const gg = g * overGrow(st[focus]);
  st[focus] = clamp(st[focus] + gg, 10, STAT_MAX);
  return gg;
}
function progressStudents(res, iw){
  const my = me(), ups = [];
  const snap = {}; my.students.forEach(st => snap[st.id] = {atk:st.atk, def:st.def, int:st.int, cond:st.cond, train:st.train});
  (res.units || []).forEach(x => {
    const st = findSt(my, x.sid); if (!st) return;
    const r = st.rec = st.rec || {g:0, w:0, k:0, d:0, mvp:0}; r.g++; if (iw) r.w++; r.k += x.k; r.d += x.d; if (res.mvp === x.sid) r.mvp++;
    if (!x.champ) return;
    st.mastery = st.mastery || {};
    const couldSpecialize = specializationReady(st);
    const before = mastLv(st, x.champ);
    st.mastery[x.champ] = (st.mastery[x.champ] || 0) + R((10 + x.k*2 + (iw ? 5 : 0)) * (1 + facLv('library')*.2) * policyMasteryMult());
    const after = mastLv(st, x.champ);
    if (!couldSpecialize && specializationReady(st)) ups.push(`${st.name}의 성장 방향을 선택할 수 있습니다. 학생 화면에서 전문화를 골라 주세요.`);
    if (after > before){
      ups.push(`${st.name}의 ${CH[x.champ].n} 숙련도가 Lv${after}이 됐습니다.`);
      if (after >= 3 && !st.fav.includes(x.champ) && st.fav.length < 4){
        st.fav.push(x.champ);
        const msg = `${st.name}이(가) ${CH[x.champ].n}을(를) 주력 마법으로 익혔습니다.`;
        ups.push(msg); addNews(msg);
      }
    }
  });
  ups.push(...progressMentorship(res));
  // 컨디션과 훈련
  my.students.forEach(st => {
    const played = res.starters.includes(st.id);
    st.cond = nextCondition(st, played);
    st.last = null;
    if (st.train && st.train !== 'rest'){ const g = growStudent(st, st.train, facGrowMult(st.train) * policyGrowthMult(st)); st.last = {k:st.train, g}; }
  });
  S.schools.slice(1).forEach(sc => sc.students.forEach(st => growStudent(st, pick(['atk','def','int']), diff().grow * aiGrowRamp() * aiCatchUp(sc))));
  V.growth = my.students.map(st => { const b = snap[st.id]; if (!b) return null;
    const d = ['atk','def','int'].map(k => [k, st[k] - b[k]]).filter(([, v]) => v > .05);
    return {name:st.name, train:b.train, d, c0:b.cond, c1:st.cond, played:res.starters.includes(st.id)}; }).filter(Boolean);
  ups.push(...updateChem(res.starters, iw));
  ups.push(...weeklyMorale(res, iw));
  recordStats(res, iw);
  ups.push(...awakeCheck(snap));
  ups.push(...updateStories(res, iw));
  S.schools.forEach(assignAISpecialization);
  S.trainSet = false; V.trainDraft = {};  // 이번 훈련 끝, 다음 주 계획은 다시 확정
  return ups;
}
function applyWeek(res){
  const my = me(), opp = school(res.opp);
  // 내 경기 기록
  const iw = res.winner === 0;
  (iw ? my : opp).w++; (iw ? opp : my).l++;
  my.kd += res.score[0] - res.score[1]; opp.kd += res.score[1] - res.score[0];
  S.results[S.week].push({a:0, b:res.opp, winA:iw, sa:res.score[0], sb:res.score[1]});
  S.gold += iw ? 120 : 50; S.fame += iw ? 10 : 3;
  settleNextBuff(iw);
  addIntel(res.opp, D.picks[1].map(p => p.champ), D.bans[1]);
  aiFatigue(school(res.opp), D.picks[1].map(p => p.sid));
  // 다른 경기
  S.schedule[S.week].filter(p => !p.includes(0)).forEach(([x,y]) => {
    const r = quickSim(school(x), school(y));
    r.win.w++; r.lose.l++; r.win.kd += r.ks - r.kl; r.lose.kd += r.kl - r.ks;
    S.results[S.week].push({a:r.win.id, b:r.lose.id, winA:true, sa:r.ks, sb:r.kl});
  });
  const ups = progressStudents(res, iw);
  addNews(iw ? `${opp.name}을(를) ${res.score[0]} 대 ${res.score[1]}로 꺾었습니다.` : `${opp.name}에게 ${res.score[0]} 대 ${res.score[1]}로 졌습니다.`);
  const upset = S.results[S.week].find(r => r.a !== 0 && r.b !== 0 && school(r.b).w > school(r.a).w + 1);
  if (upset) addNews(`이변: ${school(upset.a).name}이(가) ${school(upset.b).name}을(를) 잡았습니다.`);
  S.week++;
  if (S.week >= WEEKS) startFinal();
  else if (S.week === CUP_WEEK && !(S.cup && S.cup.season === S.season)) startCup();
  payWages();
  rollEvent();
  save();
  return ups;
}
function standings(){
  return [...S.schools].sort((a,b) => b.w - a.w || b.kd - a.kd);
}
function endSeason(){
  finishSeasonStories();
  const st = finalRanking(), rank = st.findIndex(s => s.player) + 1;
  settleGoals(rank);
  const prize = seasonPrize(rank);
  S.gold += prize; S.fame += R([40, 25, 15, 8, 5, 3][rank-1] * divMult());
  // 하위권 재건 지원: 지원금과 더 좋은 신입생 후보 (초반에 밀린 팀이 계속 밀리지 않게)
  if (rank >= 5){
    const prev = (S.history || []).slice(-1)[0], twice = !!(prev && prev.rank >= 5);
    S.gold += twice ? 300 : 150; if (twice) S.rebuildProspect = true;
    addNews(twice ? '두 시즌 연속 하위권이라 재건 지원금 300골드와 유망주 추천을 받았습니다.' : '하위권 재건 지원금 150골드를 받았습니다. 이번 신입생 후보가 더 좋습니다.');
  }
  if (rank === 1){ S.trophies++; unlockAch('firstTitle'); if (S.diff === 'hard') unlockAch('hardTitle'); if (S.div === 1) unlockAch('topTitle'); if (S.trophies >= 3) unlockAch('dynasty'); }
  if (me().w >= WEEKS && me().l === 0) unlockAch('unbeaten');
  S.streak = rank === 1 ? (S.streak || 0) + 1 : 0;
  S.history.push({season:S.season, rank, champ: st[0].name, div:S.div, cup:S.cup && S.cup.season === S.season ? S.cup.place : null, goals:S.lastGoals ? S.lastGoals.filter(g => g.done).length : null});
  addNews(`시즌 ${S.season} 종료: ${rank}위, 상금 ${prize}골드.`);
  S.lastSeason = {rank, prize, table: st.map(s => ({name:s.name, w:s.w, l:s.l, kd:s.kd, player:!!s.player}))};
  S.phase = 'graduation';
  // 졸업 처리
  S.schools.forEach(sc => sc.coach = null);
  S.lastGrads = [];
  S.schools.forEach(sc => {
    const grads = sc.students.filter(s => s.year >= 4);
    sc.students = sc.students.filter(s => s.year < 4);
    sc.students.forEach(s => s.year++);
    grads.forEach(g => {
      if (sc.player) {
        addHall(g);
        if (ovr(g) >= 70) unlockAch('legend');
        const rec = {name:g.name, elem:g.elem, ovr:R(ovr(g)), coachAt:null};
        if (ovr(g) >= 58){
          const rival = pick(S.schools.filter(x => !x.player && !x.coach));
          if (rival){ rival.coach = {name:g.name, from:sc.name}; rec.coachAt = rival.name; addNews(`졸업생 ${g.name}이(가) ${rival.name}의 코치로 부임했습니다. 다음 시즌 그 학교가 강해집니다.`); }
        }
        S.lastGrads.push(rec);
      }
    });
    if (!sc.player){
      sc.lvl += 1;
      // AI 신입생도 리그 수준을 따라옴 (우리 명성으로 오르는 신입생 수준보다 조금 낮게)
      const freshLv = Math.max(sc.lvl - 4, clamp(36 + S.fame/12, 36, 58) - 5);
      while (sc.students.length < 5) sc.students.push(genStudent(1, sc.elem, freshLv + ri(-2, 3)));
    }
  });
  { const oRank = seasonOther(); ((S.other && S.other.schools) || []).forEach(aiGraduate); S.lastMove = divisionSwap(st, oRank); if (S.lastMove && S.lastMove.move) S.history[S.history.length-1].move = S.lastMove.move; S.intel = S.intel || {}; }
  S.schools.forEach(sc => sc.students.forEach(s => s.cond = 100));
  markExpiring(); pruneChem(); rollMarket();
  // 신입생 후보
  const sl = facLv('scout'), lvl = clamp(36 + S.fame/12, 36, 58) + sl*2 + [0, 0, 1, 2, 4, 6][rank-1];
  S.prospects = [...Array(6 + Math.floor(sl))].map(() => {
    const p = genStudent(1, null, R(lvl + rnd(-4, 6)));
    p.potLo = clamp(p.pot - ri(0, 1), 1, 5); p.potHi = clamp(p.pot + ri(0, 1), 1, 5);
    if (p.potLo === p.potHi){ if (p.potHi < 5) p.potHi++; else p.potLo--; }
    p.cost = R(ovr(p)*2.6 + p.pot*35 + rnd(-15, 15));
    return p;
  });
  if (S.rebuildProspect){
    const p = genStudent(1, null, R(lvl + 2)); p.pot = Math.max(p.pot, 4); p.potLo = p.pot; p.potHi = p.pot;
    p.cost = R(ovr(p)*2.0 + p.pot*25); S.prospects.unshift(p); S.rebuildProspect = false;
    addNews(`재건 지원으로 유망주 ${p.name}을(를) 추천받았습니다.`);
  }
  if (S.promisedProdigy){
    const p = genStudent(1, null, R(lvl + 4)); p.pot = 5; p.potLo = 5; p.potHi = 5; p.prodigy = true;
    p.cost = R(ovr(p)*2.6 + 5*35); S.prospects.unshift(p); S.promisedProdigy = false;
    addNews(`약속한 신동 ${p.name}이(가) 입학 지원서를 냈습니다.`);
  }
  save();
}
function startNextSeason(){
  S.season++; S.week = 0; S.phase = 'hub'; S.final = null;
  resetSeasonPolicy();
  storiesOf();
  unlockExpansion();
  unlockExpansion2();
  rollPatch(); newSeasonTable();
  makeGoals(); seasonMoraleReset();
  addNews(`시즌 ${S.season} 패치: ${S.patchNotes.map(p => p.text).join(', ')}.`);
  save();
}

/* ---------- 시즌 결승전 ---------- */
function startFinal(){
  const [a, b] = standings();
  S.final = {a:a.id, b:b.id, wins:{[a.id]:0, [b.id]:0}, games:[], winner:null};
  addNews(`정규 리그 종료. 결승은 ${a.name} 대 ${b.name}, 3판 2선승제입니다.`);
  S.phase = 'final';
  if (!a.player && !b.player){ simFinal(); S.phase = 'season_end'; }
}
function simFinal(){
  const F = S.final;
  while (F.winner == null){
    const r = quickSim(school(F.a), school(F.b), true);
    F.wins[r.win.id]++; F.games.push({w:r.win.id, sw:r.ks, sl:r.kl});
    if (F.wins[r.win.id] >= 2) F.winner = r.win.id;
  }
  const w = school(F.winner), l = school(F.winner === F.a ? F.b : F.a);
  addNews(`결승: ${w.name}이(가) ${l.name}을(를) ${F.wins[w.id]} 대 ${F.wins[l.id]}로 꺾고 우승했습니다.`);
}
function applyFinal(res){
  const F = S.final, opp = school(res.opp), iw = res.winner === 0;
  recordFinalScout(B, [0,res.opp]);
  F.wins[iw ? 0 : opp.id]++;
  F.games.push({w: iw ? 0 : opp.id, sw:Math.max(...res.score), sl:Math.min(...res.score)});
  S.gold += iw ? 150 : 60; S.fame += iw ? 12 : 4;
  settleNextBuff(iw);
  addIntel(res.opp, D.picks[1].map(p => p.champ), D.bans[1]);
  aiFatigue(school(res.opp), D.picks[1].map(p => p.sid));
  const ups = progressStudents(res, iw);
  addNews(`결승 ${F.games.length}차전: ${opp.name}${iw ? `을(를) ${res.score[0]} 대 ${res.score[1]}로 이겼습니다` : `에게 ${res.score[0]} 대 ${res.score[1]}로 졌습니다`}. 시리즈 ${F.wins[0]} 대 ${F.wins[opp.id]}.`);
  if (F.wins[0] >= 2 || F.wins[opp.id] >= 2){
    F.winner = F.wins[0] >= 2 ? 0 : opp.id;
    addNews(F.winner === 0 ? `${me().name}이(가) 결승에서 우승했습니다!` : `${opp.name}이(가) 결승에서 우승했습니다.`);
    S.phase = 'season_end';
  }
  payWages();
  save();
  return ups;
}
function finalRanking(){
  const st = standings(), F = S.final;
  if (!F || F.winner == null) return st;
  const w = school(F.winner), l = school(F.winner === F.a ? F.b : F.a);
  return [w, l, ...st.filter(s => s !== w && s !== l)];
}
function finalHtml(){
  const F = S.final; if (!F) return '';
  const A = school(F.a), Bs = school(F.b);
  const games = F.games.map((g, i) => `<span class="${g.w === 0 ? 'good' : g.w === F.a || g.w === F.b ? '' : ''}">${i+1}차전 ${esc(school(g.w).name)} 승 <span class="num muted">${g.sw}:${g.sl}</span></span>`).join('<br>');
  return `<section class="panel final-box">
    <h3 style="margin:0">결승전 <span class="muted" style="font-size:.85rem">3판 2선승제</span></h3>
    <div class="final-score"><span class="${A.player ? 'me' : ''}">${esc(A.name)}</span><b class="num">${F.wins[F.a]} : ${F.wins[F.b]}</b><span class="${Bs.player ? 'me' : ''}">${esc(Bs.name)}</span></div>
    ${games ? `<p style="font-size:.88rem">${games}</p>` : ''}
    ${F.winner != null ? `<p class="${F.winner === 0 ? 'good' : ''}">우승: ${esc(school(F.winner).name)}</p>` : ''}
  </section>`;
}
