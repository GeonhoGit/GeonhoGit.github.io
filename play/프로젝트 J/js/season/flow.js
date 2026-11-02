// 흐름 완화: 반격, 연승 견제, 상대 따라잡기
"use strict";

/* =========================================================
   흐름 완화: 연패하면 반격, 길게 연승하면 견제
   ========================================================= */
// 우리 주전이 상대보다 많이 강해지면 상대 학교가 투자를 늘려 더 빨리 성장함
function aiCatchUp(sc){ const gap = top3Of(me()) - top3Of(sc); return 1 + clamp(gap / 30, 0, .6); }
const comebackBonus = () => { const n = (S && S.lossStreak) || 0; return n >= 3 ? .05 : n >= 2 ? .03 : 0; };
const streakPressure = () => { const n = (S && S.stats && S.stats.streak) || 0; return n >= 6 ? .04 : n >= 4 ? .02 : 0; };
function flowHtml(){
  const c = comebackBonus(), p = streakPressure();
  return (c ? `<p class="good" style="font-size:.88rem">반격의 의지: ${S.lossStreak}연패 중이라 학생들이 이를 악물었습니다. 다음 경기 능력치 +${R(c*100)}%.</p>` : '')
    + (p ? `<p class="bad" style="font-size:.88rem">연승 견제: ${S.stats.streak}연승 중이라 상대가 철저히 대비합니다. 상대 능력치 +${R(p*100)}%.</p>` : '');
}
