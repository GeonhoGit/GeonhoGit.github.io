// 숙련도에 따라 학생이 한 번 선택하는 성장 전문화
"use strict";

const SPECIALIZATIONS = {
  finisher:{n:'마무리', group:'공격', d:'체력이 절반 이하인 적에게 피해 +18%. 자신의 최대 체력 −5%.'},
  tempo:{n:'속공', group:'공격', d:'기본 공격 주기 −12%. 주문 재사용 시간 +8%.'},
  bastion:{n:'철갑', group:'방어', d:'최대 체력 +12%. 이동 속도 −10%.'},
  guardian:{n:'동료 수호', group:'방어', d:'거리 90 안의 다른 아군이 받는 피해 −10%(중첩 없음). 자신이 주는 피해 −8%.'},
  focusHeal:{n:'집중 치유', group:'지원', d:'자신의 치유·지속 회복·재정비 회복량 +25%(흡혈 제외). 자신이 주는 피해 −12%.'},
  shareHeal:{n:'나눔 치유', group:'지원', d:'치유·지속 회복·재정비 회복량의 60%를 대상에게, 40%를 대상의 거리 140 안에 있는 다른 부상 아군에게 나눕니다(흡혈 제외). 다른 부상 아군이 없으면 전부 대상에게 적용합니다.'},
};
const specializationOf = st => st && Object.hasOwn(SPECIALIZATIONS, st.specialization) ? st.specialization : null;
function specializationXP(st){
  return Math.max(0, ...Object.entries((st && st.mastery) || {}).filter(([id]) => Object.hasOwn(CH, id)).map(([, xp]) => Number.isFinite(xp) ? xp : 0));
}
const specializationReady = st => !!st && !specializationOf(st) && specializationXP(st) >= MAST_XP[2];
function chooseSpecialization(sid, key){
  if (!S || V.view === 'draft' || V.view === 'battle' || !Object.hasOwn(SPECIALIZATIONS, key)) return false;
  const st = findSt(me(), sid);
  if (!specializationReady(st)) return false;
  st.specialization = key;
  addNews(`${st.name}이(가) '${SPECIALIZATIONS[key].n}' 전문화를 선택했습니다.`);
  return true;
}
function specializationSummary(st){
  const key = specializationOf(st);
  return key ? `<span class="trait" title="${SPECIALIZATIONS[key].d}">전문화 · ${SPECIALIZATIONS[key].n}</span>` : '';
}
function specializationHtml(st){
  const key = specializationOf(st);
  if (key) return `<div id="specialization-${st.id}" tabindex="-1" style="font-size:.85rem">${specializationSummary(st)}<p class="muted">${SPECIALIZATIONS[key].d}</p></div>`;
  const xp = Math.min(MAST_XP[2], specializationXP(st));
  if (!specializationReady(st)) return `<p class="muted" style="font-size:.85rem">성장 전문화: 마법 하나를 숙련 Lv2까지 익히면 선택할 수 있습니다. 최고 숙련 경험치 ${R(xp)}/${MAST_XP[2]}.</p>`;
  const choice = V.specializationChoice, pending = choice && choice.sid === st.id && Object.hasOwn(SPECIALIZATIONS,choice.key) ? choice.key : null;
  return `<details class="specialization" data-fold="specialization-${st.id}" style="margin:.6rem 0" ${pending ? 'open' : ''}><summary>성장 방향 선택 가능 · 전문화</summary>
    <p class="muted" style="font-size:.85rem;margin:.5rem 0">학생마다 하나만 선택하며, 한 번 정하면 바꿀 수 없습니다. 지원 계열은 치유·지속 회복·재정비에 적용됩니다.</p>
    ${['공격','방어','지원'].map(group => `<div style="margin:.6rem 0"><b>${group} 계열</b><div class="stack" style="gap:.4rem;margin-top:.3rem">${Object.entries(SPECIALIZATIONS).filter(([, spec]) => spec.group === group).map(([id, spec]) => `<button class="btn ghost small" style="white-space:normal;text-align:left" data-a="specialize" data-v="${st.id}:${id}" aria-pressed="${pending === id}"><b>${spec.n}</b> · ${spec.d}</button>`).join('')}</div></div>`).join('')}
    ${pending ? `<section class="notice" role="status"><h4>${esc(st.name)} · ${SPECIALIZATIONS[pending].n} 선택 예정</h4><p>${SPECIALIZATIONS[pending].d}</p><p>아직 저장되지 않았습니다. 확정하면 변경할 수 없습니다.</p><div class="row"><button class="btn" data-a="specializeConfirm" data-v="${st.id}:${pending}">이 전문화로 확정</button><button class="btn ghost" data-a="specializeCancel">선택 취소</button></div></section>` : ''}
  </details>`;
}
// 호출자는 저장하며, AI는 기존 숙련 조건을 만족하는 학생만 선택합니다.
function assignAISpecialization(sc){
  if (!sc || sc.player) return;
  sc.students.forEach(st => {
    if (!specializationReady(st)) return;
    const champ = Object.keys(st.mastery || {}).filter(id => Object.hasOwn(CH, id)).sort((a,b) => st.mastery[b] - st.mastery[a])[0];
    const role = CH[champ]?.role;
    st.specialization = role === '치유' ? 'focusHeal' : role === '수호' ? 'guardian' : role === '사격' ? 'tempo' : 'finisher';
  });
}
function applySpecialization(u){
  u.specialization = specializationOf(u.st);
  if (u.specialization === 'finisher'){ u.maxHp *= .95; u.hp = u.maxHp; }
  if (u.specialization === 'tempo'){ u.acd *= .88; u.scd *= 1.08; }
  if (u.specialization === 'bastion'){ u.maxHp *= 1.12; u.hp = u.maxHp; u.spd *= .9; }
}
function specializationDamage(battle, src, tgt){
  let mult = 1;
  if (src.specialization === 'finisher' && tgt.hp <= tgt.maxHp * .5) mult *= 1.18;
  if (src.specialization === 'guardian') mult *= .92;
  if (src.specialization === 'focusHeal') mult *= .88;
  if (battle.units.some(u => u !== tgt && u.alive && u.team === tgt.team && u.specialization === 'guardian' && dist(u, tgt) <= 90)) mult *= .9;
  return mult;
}
// 회복량만 분배합니다. 실제 HP/회복 기록 변경은 기존 heal()에서 한 번 처리합니다.
function specializationHealing(battle, src, tgt, amount){
  if (!tgt.alive || !Number.isFinite(amount) || amount <= 0) return [];
  if (src.specialization === 'focusHeal') return [{target:tgt, amount:amount * 1.25}];
  if (src.specialization === 'shareHeal'){
    const others = battle.units.filter(u => u !== tgt && u.alive && u.team === tgt.team && u.hp < u.maxHp && dist(u, tgt) <= 140);
    if (others.length) return [{target:tgt, amount:amount * .6}, ...others.map(target => ({target, amount:amount * .4 / others.length}))];
  }
  return [{target:tgt, amount}];
}
