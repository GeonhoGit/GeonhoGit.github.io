// 빛·어둠 확장(시즌 2)과 새 마법 확장(시즌 4)
"use strict";

/* =========================================================
   빛·어둠 원소 확장 (시즌 2부터)
   ========================================================= */
const BASE_ELK = ['fire','wind','earth','water'], ALL_ELK = [...BASE_ELK, 'light', 'dark'];
function applyExpansion(){
  ELK = S && S.expansion ? ALL_ELK : BASE_ELK;
  CHK = Object.keys(CH).filter(k => ELK.includes(CH[k].e) && (!CH[k].exp2 || (S && S.expansion2)));
}
function unlockExpansion(){
  if (S.expansion || S.season < 2) return;
  S.expansion = true; applyExpansion();
  addNews('확장: 빛과 어둠 원소가 등장했습니다. 새 마법 6종을 밴픽에서 쓸 수 있고, 새 신입생 중에 빛·어둠 원소 학생이 나옵니다.');
  // AI 학교에도 새 원소 신입생이 하나씩 들어옴
  S.schools.slice(1).forEach(sc => { if (sc.students.length < 6) sc.students.push(genStudent(1, pick(['light','dark']), sc.lvl - 4)); });
}
function matchupText(e){
  const strong = EL[e].beats, weak = beatenBy(e);
  if (strong === weak) return `<span class="good">${EL[strong].n}</span> 원소와는 서로에게 강합니다.`;
  return `<span class="good">${EL[strong].n}</span> 원소에 강하고 <span class="bad">${EL[weak].n}</span> 원소에 약합니다.`;
}
function segDist(p, a, b){
  const dx = b.x-a.x, dy = b.y-a.y, l2 = dx*dx + dy*dy || 1;
  let t = ((p.x-a.x)*dx + (p.y-a.y)*dy) / l2; t = clamp(t, 0, 1.6);
  return Math.hypot(p.x - (a.x + dx*t), p.y - (a.y + dy*t));
}

/* =========================================================
   2차 확장: 새 마법 4종 (시즌 4부터)
   ========================================================= */
function unlockExpansion2(){
  if (S.expansion2 || S.season < 4) return;
  S.expansion2 = true; applyExpansion();
  addNews('2차 확장: 새 마법 4종(화산술사, 돌풍술사, 바위돌진자, 안개술사)이 등장했습니다.');
}
