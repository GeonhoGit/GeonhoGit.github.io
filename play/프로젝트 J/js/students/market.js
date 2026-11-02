// 이적 시장, 계약, 수당
"use strict";

/* =========================================================
   이적 시장, 계약, 수당
   ========================================================= */
const transferFee = st => R(ovr(st)*3.8 + st.pot*25 - (st.year - 2)*45);
const wageOf = st => R(Math.max(8, ovr(st)*.45 - 4));
const saleFee = st => R(ovr(st)*3 + st.pot*22 + (4 - st.year)*25);
const renewCost = st => wageOf(st) * 4;
function aiFreshLv(sc){ return Math.max(sc.lvl - 4, clamp(36 + S.fame/12, 36, 58) - 5); }
function rollMarket(){
  S.market = [];
  S.schools.slice(1).forEach(sc => {
    const cands = [...sc.students].sort((a, b) => ovr(b) - ovr(a)).slice(0, 3);
    const st = cands.length ? pick(cands) : null;
    if (st) S.market.push({sid:st.id, from:sc.id});
  });
}
function marketList(){
  return (S.market || []).map(m => { const sc = school(m.from), st = sc && findSt(sc, m.sid); return st ? {st, sc} : null; }).filter(Boolean);
}
const expiring = () => me().students.filter(st => st.contract && st.contract.expiring);
// 매 경기 뒤 전학생 수당 지급
function payWages(){
  const list = me().students.filter(st => st.contract && st.contract.wage);
  let total = list.reduce((s, st) => s + st.contract.wage, 0), paid = Math.min(total, Math.max(0, S.gold));
  S.gold -= paid; S.lastWage = paid;
  if (paid < total){
    list.forEach(st => st.cond = clamp(st.cond - 10, 20, 100));
    addNews(`골드가 모자라 전학생 수당 ${total - paid}골드를 주지 못했습니다. 전학생들의 사기가 떨어졌습니다.`);
  }
  return paid;
}
function contractLine(st){
  const c = st.contract; if (!c) return '';
  return `<div style="font-size:.85rem"><span class="muted">계약</span> ${c.expiring ? '<span class="bad">계약 만료</span>' : `시즌 ${c.until}까지`}, 경기당 수당 <span class="coin"></span>${c.wage} <span class="muted">(${esc(c.fromName || (school(c.from) ? school(c.from).name : ''))} 출신)</span></div>`;
}
function marketHtml(){
  const my = me(), n = my.students.length, exp = expiring(), list = marketList();
  const expHtml = exp.length ? `<section class="panel" style="margin-bottom:1rem;border-color:var(--rose)"><h3>계약 만료</h3>
    <p class="muted" style="font-size:.88rem">재계약하지 않으면 시즌이 시작될 때 원래 학교로 돌아갑니다.</p>
    ${exp.map(st => `<div class="spread mk-row"><span>${esc(st.name)} <span class="muted">${st.year}학년</span> ${elChip(st.elem)} <span class="ovr num">${R(ovr(st))}</span></span>
      <span class="row"><button class="btn small" data-a="renew" data-v="${st.id}" ${S.gold >= renewCost(st) ? '' : 'disabled'}>재계약 <span class="coin"></span>${renewCost(st)} (수당 ${wageOf(st)})</button><button class="btn ghost small" data-a="release" data-v="${st.id}">돌려보내기</button></span></div>`).join('')}
  </section>` : '';
  return `${expHtml}
    <section class="panel" style="margin-bottom:1rem"><h3>이적 시장</h3>
    <p class="muted" style="font-size:.88rem">다른 학교 학생을 이적료를 내고 데려옵니다. 전학생은 1시즌 계약이고, 경기마다 수당을 받습니다. 학생을 빼앗긴 학교는 신입생으로 빈자리를 채웁니다.</p></section>
    <div class="cards prospects">${list.length ? list.map(({st, sc}) => { const fee = transferFee(st); return `<div>${studentCard(st, {cost:fee})}
      <div class="muted" style="font-size:.82rem;margin:.2rem 0">${esc(sc.name)} · 수당 <span class="coin"></span>${wageOf(st)}/경기</div>
      <div class="pc-actions"><button class="btn small" data-a="buyTransfer" data-v="${st.id}" ${S.gold >= fee && n < ROSTER_MAX ? '' : 'disabled'}>영입하기</button></div></div>`; }).join('') : '<p class="muted">이번 이적 시장에 남은 학생이 없습니다.</p>'}</div>
    <section class="panel" style="margin-top:1.2rem"><h3>우리 학생 내보내기</h3>
      <p class="muted" style="font-size:.88rem">다른 학교로 보내고 이적료를 받습니다. 보낸 학생은 상대 학교에서 뜁니다. 3명은 남아야 합니다.</p>
      ${my.students.map(st => `<div class="spread mk-row"><span>${esc(st.name)} <span class="muted">${st.year}학년</span> ${elChip(st.elem)} <span class="ovr num">${R(ovr(st))}</span>${st.contract ? ' <span class="muted" style="font-size:.8rem">전학생</span>' : ''}</span>
        <button class="btn ghost small" data-a="sellStudent" data-v="${st.id}" ${n > 3 ? '' : 'disabled'}>${V.confirmSell === st.id ? '한 번 더 누르면 보냅니다' : `내보내기 <span class="coin"></span>${saleFee(st)}`}</button></div>`).join('')}
    </section>`;
}
function buyTransfer(id){
  const m = (S.market || []).find(x => x.sid === id); if (!m) return;
  const sc = school(m.from), st = findSt(sc, id), my = me(); if (!st) return;
  const fee = transferFee(st);
  if (S.gold < fee || my.students.length >= ROSTER_MAX) return;
  S.gold -= fee;
  sc.students = sc.students.filter(x => x !== st);
  if (sc.students.length < 5) sc.students.push(genStudent(1, sc.elem, aiFreshLv(sc) + ri(-2, 3)));
  st.contract = {from:sc.id, fromName:sc.name, wage:wageOf(st), until:S.season + 1};
  st.train = null; st.last = null; st.cond = 100;
  joinTeam(st);
  S.market = S.market.filter(x => x !== m);
  addNews(`${sc.name}의 ${st.name}을(를) 이적료 ${fee}골드에 영입했습니다.`);
  if (ovr(st) >= 65) unlockAch('bigSigning');
  sfx('pick');
}
function sellStudent(id){
  const st = findSt(me(), id); if (st) transferOut(st, 1);  // 학생 사기 파일(morale.js)
}
function renewContract(id){
  const st = findSt(me(), id); if (!st || !st.contract || !st.contract.expiring) return;
  const c = renewCost(st); if (S.gold < c) return;
  S.gold -= c; st.contract = {from:st.contract.from, fromName:st.contract.fromName, wage:wageOf(st), until:S.season + 1};
  addNews(`${st.name}과(와) 1시즌 재계약했습니다.`);
}
function releaseStudent(st){
  const my = me(), c0 = st.contract, home = S.schools.find(x => x.name === c0.fromName && !x.player) || (S.other && S.other.schools.find(x => x.name === c0.fromName)) || (c0.fromName ? null : school(c0.from));
  my.students = my.students.filter(x => x !== st);
  st.gear = null; delete st.contract; delete st.morale;
  if (home && !home.player) home.students.push(st);
  addNews(`${st.name}이(가) 계약이 끝나 ${home ? home.name : '원래 학교'}(으)로 돌아갔습니다.`);
  pruneChem();
}
// 시즌 종료 때 계약 만료 표시
function markExpiring(){
  me().students.forEach(st => { if (st.contract && st.contract.until <= S.season) st.contract.expiring = true; });
}
function recruitTabs(){
  const t = V.recruitTab || 'new', ne = expiring().length;
  return `<div class="tabbar" role="tablist">
    <button role="tab" data-a="recruitTab" data-v="new" aria-selected="${t === 'new'}">신입생 모집</button>
    <button role="tab" data-a="recruitTab" data-v="market" aria-selected="${t === 'market'}">이적 시장${ne ? ` <span class="bad">(만료 ${ne})</span>` : ''}</button>
  </div>`;
}
