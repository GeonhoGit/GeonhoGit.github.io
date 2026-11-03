// 마법 도구와 상점
"use strict";

/* =========================================================
   마법 도구 (장비)
   ========================================================= */
const GEAR = {
  oak:{n:'참나무 지팡이', r:1, d:'공격력 +3%', cost:150, fx:{atk:.03}},
  cloak:{n:'가죽 망토', r:1, d:'최대 체력 +5%', cost:140, fx:{hp:.05}},
  hourglass:{n:'모래시계', r:1, d:'주문 재사용 시간 −5%', cost:160, fx:{cd:.05}},
  boots:{n:'질풍 장화', r:1, d:'이동·공격 속도 +4%', cost:160, fx:{spd:.04}},
  crystal:{n:'수정 지팡이', r:2, d:'공격력 +6%', cost:340, fx:{atk:.06}},
  scale:{n:'용비늘 망토', r:2, d:'최대 체력 +7%, 방어 +4%', cost:360, fx:{hp:.07, def:.04}},
  ring:{n:'집중의 반지', r:2, d:'주문 재사용 시간 −6%, 공격력 +3%', cost:370, fx:{cd:.06, atk:.03}},
  charm:{n:'생명의 부적', r:2, d:'매초 체력 0.6% 회복', cost:330, fx:{regen:.006}},
  fang:{n:'흡혈 송곳니', r:2, d:'준 피해의 9% 흡혈', cost:340, fx:{ls:.09}},
  feather:{n:'불사조 깃털', r:2, d:'부활 시간 −35%', cost:310, fx:{resp:.35}},
  aegis:{n:'위기의 수호석', r:2, d:'경기당 한 번, 살아 있는 동안 체력이 30% 이하가 되면 최대 체력 20% 보호막을 4초간 얻습니다.', cost:350, fx:{crisis:.2}},
  nova:{n:'새벽의 촉매', r:2, d:'첫 성공 주문의 직접 피해 +25%. 주문 재사용 시간 +15%.', cost:350, fx:{opening:true}},
  mercy:{n:'첫빛 성배', r:2, d:'첫 유효 치유량 +60%(흡혈 제외). 공격력 −8%.', cost:350, fx:{firstHeal:.6, atk:-.08}},
  gem:{n:'원소 보석', r:3, d:'원소가 같은 마법을 맡으면 능력치 +5%, 공격력 +3%', cost:600, fx:{elem:.05, atk:.03}},
  crown:{n:'대마법사의 관', r:3, d:'공격력 +5%, 최대 체력 +5%, 주문 재사용 −4%', cost:680, fx:{atk:.05, hp:.05, cd:.04}},
};
const GEARK = Object.keys(GEAR);
const RARN = ['', '일반', '희귀', '전설'];
const ITEM_MAX = 8;
const gearOf = st => st && st.gear && S && S.items ? S.items.find(it => it.id === st.gear) || null : null;
const gearFx = st => { const it = gearOf(st); return it && GEAR[it.k] ? GEAR[it.k].fx : null; };
const holderOf = it => me().students.find(st => st.gear === it.id) || null;
function gearChip(k){ const g = GEAR[k]; return `<span class="gear r${g.r}" title="${RARN[g.r]}: ${g.d}">${g.n}</span>`; }
function addItem(k){ S.items = S.items || []; if (S.items.length >= ITEM_MAX) return false; S.items.push({id:uid(), k}); if (S.items.length >= 5) unlockAch('armory'); return true; }
// 전투 유닛에 장비 효과 적용 (조합 효과 전에 곱하는 능력치)
function applyGear(u){
  const g = gearFx(u.st); if (!g) return;
  const el = g.elem && u.st.elem === u.c.e ? 1 + g.elem : 1;
  const hp = (1 + (g.hp || 0)) * el;
  u.maxHp *= hp; u.hp = u.maxHp;
  u.atk *= (1 + (g.atk || 0)) * el;
  u.def *= (1 + (g.def || 0)) * el;
  if (g.spd){ u.spd *= 1 + g.spd; u.acd /= 1 + g.spd; }
  if (g.cd) u.scd *= 1 - g.cd;
  if (g.resp) u.gearResp = g.resp;
  if (g.crisis) u.gearCrisisShield = g.crisis;
  if (g.opening){ u.gearOpening = true; u.scd *= 1.15; }
  if (g.firstHeal) u.gearFirstHealBonus = g.firstHeal;
}
// 조합 효과 뒤에 더하는 효과 (회복, 흡혈)
function applyGearAfter(u){
  const g = gearFx(u.st); if (!g) return;
  if (g.regen) u.regen = (u.regen || 0) + g.regen;
  if (g.ls) u.lifesteal = (u.lifesteal || 0) + g.ls;
}
function gearCrisis(battle, u){
  if (!u.gearCrisisShield || u.gearCrisisUsed || !u.alive || u.hp <= 0 || u.hp/u.maxHp > .3 || battle.over || battle.paused) return false;
  u.gearCrisisUsed = true;
  u.shield = Math.max(u.shield, u.maxHp*u.gearCrisisShield); u.shT = Math.max(u.shT, 4);
  fxTxt(battle, u.x, u.y-32, '수호석!', '#bfe3ff');
  return true;
}
function gearBeginSkill(u){ u.gearSpellBurst = !!u.gearOpening && !u.gearOpeningSpent; }
function gearEndSkill(u, casted){
  if (casted && u.gearOpening) u.gearOpeningSpent = true;
  u.gearSpellBurst = false;
}
const gearDamageMult = u => u.gearSpellBurst ? 1.25 : 1;
function gearHealingAmount(src, tgt, amount){
  if (!src.gearFirstHealBonus || src.gearFirstHealSpent || !tgt.alive || tgt.hp >= tgt.maxHp || !(amount > 0)) return amount;
  src.gearFirstHealSpent = true;
  return amount * (1 + src.gearFirstHealBonus);
}

// 수령하지 않은 컵 보상은 시즌이 바뀌어도 남고, 이미 받은 시즌은 다시 생성하지 않습니다.
function createCupReward(){
  S.cupRewards = Array.isArray(S.cupRewards) ? S.cupRewards : [];
  const existing = S.cupRewards.find(reward => reward.season === S.season);
  if (existing) return existing;
  const reward = {id:`cup-${S.season}`, season:S.season, offers:shuffle(GEARK.filter(k => GEAR[k].r === 2)).slice(0,3), claimed:false};
  S.cupRewards.push(reward);
  return reward;
}
const pendingCupRewards = () => (Array.isArray(S && S.cupRewards) ? S.cupRewards : []).filter(r => r && !r.claimed && Array.isArray(r.offers));
function offeredCupReward(value){
  if (typeof value !== 'string' || ['battle','draft','practice'].includes(V.view)) return null;
  const [id, key, extra] = value.split(':');
  const reward = pendingCupRewards().find(r => r.id === id);
  return !extra && reward && reward.offers.includes(key) && Object.hasOwn(GEAR,key) ? {reward,key} : null;
}
function claimCupReward(value){
  const selected = offeredCupReward(value);
  if (!selected || !addItem(selected.key)) return false;
  selected.reward.claimed = true; selected.reward.choice = selected.key;
  addNews(`시즌 ${selected.reward.season} 컵 보상으로 ${GEAR[selected.key].n}을(를) 받았습니다.`);
  return true;
}
function exchangeCupReward(value){
  const selected = offeredCupReward(value);
  if (!selected || (S.items || []).length < ITEM_MAX) return false;
  const gold = R(GEAR[selected.key].cost/2);
  S.gold += gold; selected.reward.claimed = true; selected.reward.choice = selected.key; selected.reward.exchanged = gold;
  addNews(`도구함이 가득 차 시즌 ${selected.reward.season} 컵 보상 ${GEAR[selected.key].n}을(를) ${gold}골드로 교환했습니다.`);
  return true;
}
function cupRewardHtml(){
  const rewards = pendingCupRewards(), reward = rewards[0];
  if (!reward) return '';
  const full = (S.items || []).length >= ITEM_MAX;
  return `<section class="panel" id="cup-reward" style="margin-bottom:1rem"><h3>시즌 ${reward.season} 컵 우승 보상 선택</h3>
    <p class="muted">세 도구 중 하나를 받습니다. 미수령 보상 ${rewards.length}개. 나중에 본관에서도 선택할 수 있습니다.</p>
    ${full ? '<p class="bad">도구함이 가득 찼습니다. 시설에서 도구를 팔고 받거나, 아래에서 선택한 도구를 반값 골드로 교환하세요.</p>' : ''}
    <div class="fac-grid">${reward.offers.filter(k => Object.hasOwn(GEAR,k)).map(k => `<div><h4>${GEAR[k].n}</h4><p style="font-size:.88rem">${GEAR[k].d}</p>
      <button class="btn small" data-a="claimCupReward" data-v="${reward.id}:${k}" ${full ? 'disabled' : ''}>이 도구 받기</button>
      ${full ? `<button class="btn ghost small" data-a="exchangeCupReward" data-v="${reward.id}:${k}">${R(GEAR[k].cost/2)}골드로 교환</button>` : ''}</div>`).join('')}</div></section>`;
}
function shopState(){
  const key = `${S.season}-${S.week}-${S.phase}-${S.cup && S.cup.season === S.season ? S.cup.round : ''}`;
  if (!S.shop || S.shop.key !== key){
    const pool = GEARK.flatMap(k => Array(GEAR[k].r === 1 ? 5 : GEAR[k].r === 2 ? 3 : (S.season >= 2 ? 1 : 0)).fill(k));
    const offers = [];
    while (offers.length < 4 && pool.length){ const k = pick(pool); if (!offers.includes(k)) offers.push(k); if (new Set(pool).size <= offers.length) break; }
    S.shop = {key, offers};
  }
  return S.shop;
}
function shopHtml(){
  const sh = shopState(), items = S.items || [];
  return `<h2 style="margin:1.6rem 0 .3rem">마법 도구 상점</h2>
    <p class="muted" style="margin-bottom:.8rem">학생 한 명에게 도구 하나를 맡길 수 있습니다. 진열은 매주 바뀌고, 학생 탭에서 장착합니다. 보유 ${items.length}/${ITEM_MAX}개.</p>
    <div class="fac-grid">${sh.offers.length ? sh.offers.map(k => { const g = GEAR[k]; return `<section class="panel fac">
      <div class="spread"><h3 style="margin:0">${g.n}</h3><span class="gear r${g.r}">${RARN[g.r]}</span></div>
      <p style="font-size:.92rem">${g.d}</p>
      <button class="btn small" data-a="buyGear" data-v="${k}" ${S.gold >= g.cost && items.length < ITEM_MAX ? '' : 'disabled'} style="margin-top:auto"><span class="coin"></span>${g.cost} 사기</button>
    </section>`; }).join('') : '<p class="muted">이번 주 진열이 모두 팔렸습니다.</p>'}</div>
    <h3 style="margin:1.2rem 0 .4rem">보유 도구</h3>
    ${items.length ? `<div class="gear-list">${items.map(it => { const g = GEAR[it.k], h = holderOf(it); return `<div class="gear-row">${gearChip(it.k)} <span class="muted" style="font-size:.88rem">${g.d}</span>
      <span class="gear-who">${h ? `${esc(h.name)} 사용 중` : '<span class="muted">보관 중</span>'}</span>
      <button class="btn ghost small" data-a="sellGear" data-v="${it.id}">팔기 <span class="coin"></span>${R(g.cost/2)}</button></div>`; }).join('')}</div>` : '<p class="muted">아직 도구가 없습니다.</p>'}`;
}
function gearSelectHtml(st){
  const items = S.items || [];
  if (!items.length) return `<div style="font-size:.85rem"><span class="muted">마법 도구</span> <span class="muted">없음 (시설 탭 상점)</span></div>`;
  const opts = items.filter(it => { const h = holderOf(it); return !h || h.id === st.id; });
  return `<label class="gear-sel" style="font-size:.85rem"><span class="muted">마법 도구</span>
    <select data-gear="${st.id}"><option value="">없음</option>${opts.map(it => `<option value="${it.id}" ${st.gear === it.id ? 'selected' : ''}>${GEAR[it.k].n}</option>`).join('')}</select></label>
    ${gearOf(st) ? `<div class="muted" style="font-size:.8rem;margin-top:-.2rem">${GEAR[gearOf(st).k].d}</div>` : ''}`;
}
