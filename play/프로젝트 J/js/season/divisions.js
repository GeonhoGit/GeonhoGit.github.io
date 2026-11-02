// 1부·2부 승강제
"use strict";

/* =========================================================
   1부·2부 승강제
   ========================================================= */
const OTHER_SCHOOLS = [
  {name:'왕립 마법원', elem:'fire', lvl:52}, {name:'은빛 탑 학원', elem:'water', lvl:51}, {name:'천공 아카데미', elem:'wind', lvl:50},
  {name:'심연 마법원', elem:'earth', lvl:53}, {name:'황혼 학당', elem:null, lvl:49}, {name:'서리꽃 학원', elem:'water', lvl:50},
];
const DIV1_BONUS = .05;
const divMult = () => S.div === 1 ? 1.5 : 1;
const divName = d => (d || S.div) === 1 ? '1부 리그' : '2부 리그';
const seasonPrize = rank => R([500, 320, 220, 150, 100, 80][rank-1] * divMult());
function genOtherDiv(s, extra){
  return {div:1, table:null, schools:OTHER_SCHOOLS.map((a, i) => {
    const sc = {id:100 + i, name:a.name, elem:a.elem, player:false, students:[], coach:null, lvl:a.lvl + extra};
    [1,1,2,3,4].forEach(y => sc.students.push(genStudent(y, a.elem, sc.lvl)));
    return sc;
  })};
}
const top3Of = sc => { const t = [...sc.students].sort((a, b) => ovr(b) - ovr(a)).slice(0, 3); return t.reduce((s, x) => s + ovr(x), 0) / Math.max(1, t.length); };
// 다른 리그 한 시즌 진행 (간이 계산)
function seasonOther(){
  const O = S.other; if (!O) return [];
  O.schools.forEach(sc => sc.students.forEach(st => { for (let i = 0; i < 7; i++) growStudent(st, pick(['atk','def','int']), diff().grow * aiGrowRamp() * aiCatchUp(sc)); }));
  const ranked = O.schools.map(sc => ({sc, s:top3Of(sc) + (sc.coach ? 2 : 0) + rnd(-5, 5)})).sort((a, b) => b.s - a.s).map(x => x.sc);
  O.table = ranked.map((sc, i) => ({name:sc.name, rank:i + 1, ovr:R(top3Of(sc)), elem:sc.elem}));
  return ranked;
}
function aiGraduate(sc){
  sc.students = sc.students.filter(s => s.year < 4);
  sc.students.forEach(s => s.year++);
  sc.lvl += 1;
  while (sc.students.length < 5) sc.students.push(genStudent(1, sc.elem, aiFreshLv(sc) + ri(-2, 3)));
}
// 2부 우승 학교는 1부로, 1부 최하위는 2부로
function divisionSwap(myTable, otherRanked){
  const O = S.other; if (!O || !otherRanked.length) return null;
  const myDiv = S.div;
  const fromMine = myDiv === 2 ? myTable[0] : myTable[myTable.length - 1];
  const fromOther = myDiv === 2 ? otherRanked[otherRanked.length - 1] : otherRanked[0];
  const up = myDiv === 2 ? fromMine : fromOther, down = myDiv === 2 ? fromOther : fromMine;
  let move = null;
  if (fromMine.player){
    const oldAi = S.schools.filter(s => !s.player);
    S.schools = [fromMine, ...O.schools.filter(s => s !== fromOther)];
    O.schools = [...oldAi, fromOther];
    S.div = O.div; O.div = myDiv;
    move = S.div === 1 ? 'up' : 'down';
  } else {
    S.schools = [...S.schools.filter(s => s !== fromMine), fromOther];
    O.schools = [...O.schools.filter(s => s !== fromOther), fromMine];
  }
  S.schools.forEach((s, i) => s.id = i);
  O.schools.forEach((s, i) => s.id = 100 + i);
  addNews(`${up.name}이(가) 1부 리그로 승격하고, ${down.name}이(가) 2부 리그로 강등됐습니다.`);
  if (move === 'up'){ unlockAch('promoted'); addNews(`${me().name}이(가) 1부 리그로 승격했습니다! 상대가 강해지는 대신 상금과 명성이 1.5배입니다.`); }
  if (move === 'down') addNews(`${me().name}이(가) 2부 리그로 강등됐습니다. 2부에서 우승하면 다시 올라갑니다.`);
  return {move, up:up.name, down:down.name};
}
function divNoteHtml(rank){
  if (S.div === 2 && rank === 1) return '<p class="good" style="margin-top:.6rem">2부 리그 우승! 다음 시즌 1부 리그로 승격합니다.</p>';
  if (S.div === 1 && rank === 6) return '<p class="bad" style="margin-top:.6rem">1부 최하위라 다음 시즌 2부 리그로 강등됩니다.</p>';
  return `<p class="muted" style="margin-top:.6rem;font-size:.9rem">${S.div === 2 ? '2부 리그 우승팀만 1부로 승격합니다.' : '1부 리그에 잔류합니다.'}</p>`;
}
function lastMoveHtml(){
  const m = S.lastMove; if (!m) return '';
  if (m.move === 'up') return '<p class="good" style="font-size:1.05rem">1부 리그로 승격했습니다! 상금과 명성이 1.5배가 되고, 상대가 훨씬 강해집니다.</p>';
  if (m.move === 'down') return '<p class="bad" style="font-size:1.05rem">2부 리그로 강등됐습니다. 2부에서 우승하면 다시 올라갑니다.</p>';
  return `<p class="muted" style="font-size:.9rem">승강: ${esc(m.up)} 1부 승격, ${esc(m.down)} 2부 강등.</p>`;
}
function otherDivHtml(){
  const O = S.other; if (!O) return '';
  const rows = O.table ? O.table.map(r => `<tr><td class="num">${r.rank}</td><td>${esc(r.name)} ${r.elem ? elChip(r.elem) : ''}</td><td class="num r">${r.ovr}</td></tr>`).join('')
    : O.schools.map(sc => `<tr><td class="num">-</td><td>${esc(sc.name)} ${sc.elem ? elChip(sc.elem) : ''}</td><td class="num r">${R(top3Of(sc))}</td></tr>`).join('');
  return `<section class="panel" style="margin-top:1.2rem;max-width:560px"><h3>${divName(O.div)} ${O.table ? '지난 시즌 순위' : '학교'}</h3>
    <table><thead><tr><th>순위</th><th>학교</th><th class="r">주전 평균</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="muted" style="font-size:.86rem;margin-top:.6rem">시즌이 끝나면 2부 우승 학교가 1부로 승격하고, 1부 최하위 학교가 2부로 강등됩니다. 1부는 상대가 강한 대신 시즌 상금과 명성이 1.5배입니다.</p></section>`;
}
