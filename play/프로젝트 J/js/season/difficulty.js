// 난이도
"use strict";

/* =========================================================
   난이도
   ========================================================= */
const DIFF = {
  easy:{n:'쉬움', d:'상대 학교가 약하고 느리게 크며, 시작 골드가 많습니다.', ai:-.025, grow:.92, gold:500, riv:.7},
  normal:{n:'보통', d:'기본 난이도입니다.', ai:.012, grow:1, gold:300, riv:1},
  hard:{n:'어려움', d:'상대 학교가 강하고 빨리 크며, 우승하면 견제가 더 심해집니다.', ai:.055, grow:1.15, gold:250, riv:1.5},
};
const DIFK = Object.keys(DIFF);
const diffKey = () => (S && DIFF[S.diff]) ? S.diff : 'normal';
const diff = () => DIFF[diffKey()];
function diffPicker(cur, action){
  return `<div class="elpick diffpick" role="group">${DIFK.map(k => `<button data-a="${action}" data-v="${k}" aria-pressed="${cur === k}" title="${DIFF[k].d}">${DIFF[k].n}</button>`).join('')}</div>
    <small class="muted">${DIFF[cur].d}</small>`;
}
