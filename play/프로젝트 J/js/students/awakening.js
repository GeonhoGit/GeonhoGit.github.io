// 각성
"use strict";

/* =========================================================
   각성 (능력치 100·125 돌파)
   ========================================================= */
const AWK = {
  atk:{n:'파괴자', s:'공격', d:['공격력 +6%, 체력 절반 이하인 적에게 피해 +15%', '공격력 +10%, 체력 절반 이하인 적에게 피해 +25%']},
  def:{n:'철벽', s:'수비', d:['받는 피해 −8%, 경기마다 한 번 쓰러질 피해를 버팀', '받는 피해 −12%, 경기마다 한 번 버티며 체력 30%로 회복']},
  int:{n:'대마법사', s:'판단', d:['주문을 쓴 뒤 25% 확률로 재사용 대기 절반', '주문 재사용 −5%, 40% 확률로 재사용 대기 절반']},
};
const AWKK = ['atk', 'def', 'int'];
const awkLvOf = v => v >= 125 ? 2 : v >= 100 ? 1 : 0;
const awkLv = (st, k) => st ? awkLvOf(st[k] || 0) : 0;
function applyAwake(u){
  const a = {atk:awkLv(u.st, 'atk'), def:awkLv(u.st, 'def'), int:awkLv(u.st, 'int')};
  if (!a.atk && !a.def && !a.int) return;
  u.awk = a;
  if (a.atk) u.atk *= a.atk === 2 ? 1.10 : 1.06;
  if (a.int === 2) u.scd *= .95;
}
function awkDmg(src, tgt){
  let m = 1;
  if (src && src.awk && src.awk.atk && tgt.hp / tgt.maxHp <= .5) m *= src.awk.atk === 2 ? 1.25 : 1.15;
  if (tgt.awk && tgt.awk.def) m *= tgt.awk.def === 2 ? .88 : .92;
  return m;
}
function awkSave(B, tgt){
  if (tgt.hp > 0 || !tgt.awk || !tgt.awk.def || tgt.awkSaved) return false;
  tgt.awkSaved = true;
  tgt.hp = tgt.awk.def === 2 ? tgt.maxHp * .3 : 1;
  tgt.shield = Math.max(tgt.shield, tgt.maxHp * .12); tgt.shT = Math.max(tgt.shT, 1.5);
  if (!B.headless){ fxTxt(B, tgt.x, tgt.y - 36, '철벽!', '#ffd76a'); fxRing(B, tgt.x, tgt.y, 34, '#ffd76a', .5); }
  return true;
}
const awkCd = u => u.awk && u.awk.int && Math.random() < (u.awk.int === 2 ? .4 : .25) ? .5 : 1;
function awakeCheck(snap){
  const out = [];
  me().students.forEach(st => {
    const b = snap[st.id]; if (!b) return;
    AWKK.forEach(k => {
      const l0 = awkLvOf(b[k]), l1 = awkLv(st, k);
      if (l1 > l0){
        const msg = `${st.name}이(가) 각성했습니다: ${AWK[k].n} Lv${l1} (${AWK[k].d[l1-1]})`;
        out.push(msg); addNews(`${st.name}이(가) ${AWK[k].n} Lv${l1}로 각성했습니다.`);
        const m = unlockAch('awaken'); if (m) out.push(m);
      }
    });
  });
  return out;
}
function awakeLine(st){
  const got = AWKK.filter(k => awkLv(st, k));
  if (got.length) return `<div class="awk-line">${got.map(k => `<span class="awk" title="${AWK[k].d[awkLv(st, k)-1]}">각성 ${AWK[k].n} Lv${awkLv(st, k)}</span>`).join(' ')}</div>`;
  const best = AWKK.reduce((a, k) => st[k] > st[a] ? k : a, 'atk');
  return st[best] >= 85 ? `<div class="muted" style="font-size:.8rem">${AWK[best].s} ${R(st[best])}/100이면 '${AWK[best].n}' 각성</div>` : '';
}
function awakeCodexHtml(){
  return `<section class="panel" style="margin-bottom:1.2rem"><h2>각성</h2>
    <p class="muted" style="font-size:.9rem">학생의 능력치가 100을 넘으면 각성하고, 125를 넘으면 한 단계 더 강해집니다. 상대 학교 학생도 각성합니다.</p>
    <div class="syns" style="font-size:.9rem">${AWKK.map(k => `<div><span class="awk">${AWK[k].n}</span> <span class="muted">${AWK[k].s} 100:</span> ${AWK[k].d[0]} <span class="muted">· 125:</span> ${AWK[k].d[1]}</div>`).join('')}</div>
  </section>`;
}
