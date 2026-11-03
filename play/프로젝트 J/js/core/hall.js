// 명예의 전당과 업적
"use strict";

/* =========================================================
   명예의 전당
   ========================================================= */
function hallScore(h){ return h.rec.k + h.rec.mvp*5 + h.rec.w*2 + h.ovr*.5; }
function addHall(g){
  S.hall = S.hall || [];
  const m = g.mastery || {}, best = Object.keys(m).sort((a,b) => m[b] - m[a])[0];
  S.hall.push({id:g.id, name:g.name, elem:g.elem, ovr:R(ovr(g)), season:S.season, specialization:g.specialization || null, traits:g.traits || [], rec:g.rec || {g:0, w:0, k:0, d:0, mvp:0},
    mentoredBy:Array.isArray(g.mentoredBy) ? g.mentoredBy.map(h => ({...h})) : [],
    best: best ? {id:best, lv:mastLv(g, best)} : null, titles:S.titlesThisRun || 0});
}
function viewHall(){
  const hall = [...(S.hall || [])].sort((a,b) => hallScore(b) - hallScore(a));
  const legends = hall.slice(0, 3);
  const hist = S.history || [];
  const rec = (k, label) => { const h = [...hall].sort((a,b) => b.rec[k] - a.rec[k])[0]; return h && h.rec[k] ? `<div><span class="muted">${label}</span> ${esc(h.name)} <span class="num">${h.rec[k]}</span></div>` : ''; };
  return `<div class="spread" style="margin-bottom:1rem"><div><h2 style="margin:0">명예의 전당</h2><p class="muted">졸업한 학생들의 기록과 학교의 우승 역사입니다.</p></div></div>
    <div class="grid2">
      <div class="stack">
        <section class="panel"><h3>전설의 졸업생</h3>
          ${legends.length ? `<div class="cards">${legends.map((h, i) => `<article class="scard legend">
            <div class="top"><span class="nm">${esc(h.name)}</span><span class="ovr num">${h.ovr}</span></div>
            <div class="row" style="gap:.4rem"><span class="muted" style="font-size:.85rem">시즌 ${h.season} 졸업</span>${elChip(h.elem)}</div>
            <div>${h.traits.map(k => TRAITS[k] ? `<span class="trait ${TRAITS[k].neg ? 'neg' : ''}">${TRAITS[k].n}</span>` : '').join(' ')}${specializationSummary(h)}</div>
            ${h.best ? `<div style="font-size:.85rem"><span class="muted">대표 마법</span> ${CH[h.best.id] ? CH[h.best.id].n : ''} Lv${h.best.lv}</div>` : ''}
            ${mentorshipLine(h)}
            <div class="rec-grid"><span><b class="num">${h.rec.g}</b>출전</span><span><b class="num">${h.rec.w}</b>승리</span><span><b class="num">${h.rec.k}</b>처치</span><span><b class="num">${h.rec.d}</b>죽음</span><span><b class="num">${h.rec.mvp}</b>MVP</span></div>
          </article>`).join('')}</div>` : '<p class="muted">아직 졸업생이 없습니다. 첫 시즌이 끝나면 4학년이 이곳에 기록됩니다.</p>'}
        </section>
        <section class="panel"><h3>모든 졸업생 <span class="muted" style="font-size:.85rem">${hall.length}명</span></h3>
          ${hall.length ? `<div style="overflow-x:auto"><table><thead><tr><th>이름</th><th>원소</th><th class="r">졸업</th><th class="r">종합</th><th class="r">출전</th><th class="r">승리</th><th class="r">처치</th><th class="r">MVP</th></tr></thead><tbody>
            ${hall.map(h => `<tr><td>${esc(h.name)}${mentorshipLine(h)}</td><td>${elChip(h.elem)}</td><td class="num r">S${h.season}</td><td class="num r">${h.ovr}</td><td class="num r">${h.rec.g}</td><td class="num r">${h.rec.w}</td><td class="num r">${h.rec.k}</td><td class="num r">${h.rec.mvp}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">기록이 없습니다.</p>'}
        </section>
      </div>
      <div class="stack">
        <section class="panel"><h3>시즌 기록</h3>
          ${hist.length ? `<table><thead><tr><th>시즌</th><th>우승</th><th class="r">우리 순위</th></tr></thead><tbody>
            ${hist.map(h => `<tr class="${h.rank === 1 ? 'me' : ''}"><td class="num">${h.season}</td><td>${esc(h.champ)}</td><td class="num r">${h.rank}위</td></tr>`).join('')}
          </tbody></table>` : '<p class="muted">아직 끝난 시즌이 없습니다.</p>'}
          <p style="margin-top:.6rem">우승 <b class="num" style="font-weight:400;color:var(--brass)">${S.trophies}</b>회</p>
        </section>
        ${achHtml()}${storyHistoryHtml()}
        <section class="panel"><h3>학교 기록</h3>
          <div class="records">${rec('k', '최다 처치')}${rec('mvp', '최다 MVP')}${rec('w', '최다 승리')}${rec('g', '최다 출전')}</div>
          ${hall.length ? '' : '<p class="muted">졸업생이 생기면 기록이 채워집니다.</p>'}
        </section>
      </div>
    </div>`;
}

/* ---------- 업적 ---------- */
const ACHS = [
  {id:'firstWin', n:'첫 승리', d:'대항전에서 처음 이겼습니다.'},
  {id:'otWin', n:'연장전의 승부사', d:'연장전에서 이겼습니다.'},
  {id:'tenKills', n:'압도', d:'한 경기에서 처치 10 이상을 기록했습니다.'},
  {id:'shutout', n:'완봉', d:'처치를 하나도 내주지 않고 이겼습니다.'},
  {id:'comeback', n:'대역전', d:'30초 시점에 3점 이상 뒤지다가 이겼습니다.'},
  {id:'lightdark', n:'빛과 어둠', d:'빛이나 어둠 조합 효과를 켜고 이겼습니다.'},
  {id:'commander', n:'지휘관', d:'작전 두 개를 직접 지시하고 이겼습니다.'},
  {id:'unbeaten', n:'무패 시즌', d:'정규 리그를 5전 전승으로 마쳤습니다.'},
  {id:'firstTitle', n:'첫 우승', d:'시즌 우승 트로피를 처음 들어 올렸습니다.'},
  {id:'sweep', n:'완벽한 결승', d:'결승을 2대 0으로 이겼습니다.'},
  {id:'dynasty', n:'왕조', d:'우승 3회를 달성했습니다.'},
  {id:'legend', n:'전설의 탄생', d:'종합 70 이상인 학생을 졸업시켰습니다.'},
  {id:'mastery5', n:'마법의 경지', d:'학생 한 명이 마법 숙련도 Lv5에 도달했습니다.'},
  {id:'facMax', n:'명문의 시설', d:'시설 하나를 5단계까지 올렸습니다.'},
  {id:'mentor', n:'돌아온 선배', d:'졸업생을 코치로 모셨습니다.'},
  {id:'patron', n:'후원자', d:'장학금을 세 번 지급했습니다.'},
  {id:'fame500', n:'대륙의 명문', d:'명성 500을 달성했습니다.'},
  {id:'awaken', n:'각성', d:'학생이 처음으로 각성했습니다.'},
  {id:'boardAll', n:'이사회의 신임', d:'한 시즌 이사회 목표를 모두 달성했습니다.'},
  {id:'promoted', n:'승격', d:'1부 리그로 승격했습니다.'},
  {id:'topTitle', n:'최고의 학교', d:'1부 리그에서 우승했습니다.'},
  {id:'cupWin', n:'컵의 주인', d:'마법사 컵에서 우승했습니다.'},
  {id:'bestFriends', n:'환상의 짝', d:'두 학생이 환상의 짝이 됐습니다.'},
  {id:'armory', n:'무기고', d:'마법 도구를 다섯 개 모았습니다.'},
  {id:'bigSigning', n:'대형 영입', d:'이적 시장에서 종합 65 이상 학생을 데려왔습니다.'},
  {id:'hardTitle', n:'역경의 왕관', d:'어려움 난이도에서 우승했습니다.'},
];
function unlockAch(id){
  S.ach = S.ach || {};
  if (S.ach[id]) return null;
  const a = ACHS.find(x => x.id === id); if (!a) return null;
  S.ach[id] = {s:S.season};
  addNews(`업적 달성: ${a.n}`); sfx('ach');
  return `업적 달성: ${a.n} (${a.d})`;
}
function checkMatchAch(bt, res){
  const out = [], win = res.winner === 0, add = id => { const m = unlockAch(id); if (m) out.push(m); };
  if (win) add('firstWin');
  if (win && bt.overtime) add('otWin');
  if (bt.score[0] >= 10) add('tenKills');
  if (win && bt.score[1] === 0) add('shutout');
  if (win && bt.timeline){ const p30 = bt.timeline.filter(p => p.t <= 30.01).pop(); if (p30 && p30.score[1] - p30.score[0] >= 3) add('comeback'); }
  if (win && synergies(bt.els[0]).some(x => x.e === 'light' || x.e === 'dark')) add('lightdark');
  if (win && bt.autoTac && !bt.autoTac[0] && bt.tac[0].used.length >= 2) add('commander');
  if (S.final && S.final.winner === 0 && S.final.games.length === 2) add('sweep');
  if (me().students.some(st => st.mastery && Object.keys(st.mastery).some(id => mastLv(st, id) >= 5))) add('mastery5');
  if (S.fame >= 500) add('fame500');
  return out;
}
function achHtml(){
  const got = S.ach || {}, n = ACHS.filter(a => got[a.id]).length;
  return `<section class="panel"><h3>업적 <span class="muted" style="font-size:.85rem">${n}/${ACHS.length}</span></h3>
    <ul class="achs">${ACHS.map(a => `<li class="${got[a.id] ? 'on' : ''}"><b>${a.n}</b>${got[a.id] ? ` <span class="muted num" style="font-size:.8rem">시즌 ${got[a.id].s}</span>` : ''}<br><span class="muted">${a.d}</span></li>`).join('')}</ul></section>`;
}
