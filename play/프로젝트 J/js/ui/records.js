// 기록실
"use strict";

/* =========================================================
   기록실
   ========================================================= */
function recordStats(res, iw){
  const T = S.stats = S.stats || {g:0, w:0, k:0, d:0, picks:{}, pickW:{}, streak:0, best:0};
  T.g++; if (iw) T.w++; T.k += res.score[0]; T.d += res.score[1];
  (res.units || []).forEach(x => { if (!x.champ) return; T.picks[x.champ] = (T.picks[x.champ] || 0) + 1; if (iw) T.pickW[x.champ] = (T.pickW[x.champ] || 0) + 1; });
  T.streak = iw ? T.streak + 1 : 0; T.best = Math.max(T.best, T.streak);
  S.lossStreak = iw ? 0 : (S.lossStreak || 0) + 1;
  const G = gsOf(); G.kills += res.score[0]; G.streak = iw ? G.streak + 1 : 0; G.best = Math.max(G.best, G.streak);
  res.starters.forEach(id => { const st = findSt(me(), id); if (st && st.year === 1) G.youth[id] = (G.youth[id] || 0) + 1; });
}
function viewRecords(){
  const T = S.stats || {g:0, w:0, k:0, d:0, picks:{}, pickW:{}, best:0}, hist = S.history || [];
  const t1 = hist.filter(h => h.rank === 1 && h.div === 1).length, t2 = hist.filter(h => h.rank === 1 && h.div !== 1).length;
  const ups = hist.filter(h => h.move === 'up').length;
  const card = (v, l) => `<div class="stat-card"><b class="num">${v}</b><span class="muted">${l}</span></div>`;
  const picks = Object.keys(T.picks).filter(id => CH[id]).sort((a, b) => T.picks[b] - T.picks[a]).slice(0, 10);
  const maxP = picks.length ? T.picks[picks[0]] : 1;
  const medal = r => r === 1 ? '<span class="medal g">1</span>' : r === 2 ? '<span class="medal s">2</span>' : r === 3 ? '<span class="medal b">3</span>' : `<span class="num">${r}</span>`;
  const cupT = p => p == null ? '<span class="muted">-</span>' : p === 1 ? '<span class="good">우승</span>' : p === 2 ? '준우승' : '4강';
  const studs = [...me().students].sort((a, b) => ((b.rec || {}).g || 0) - ((a.rec || {}).g || 0));
  return `<div class="spread" style="margin-bottom:1rem"><div><h2 style="margin:0">기록실</h2><p class="muted">우리 학교의 통산 기록과 시즌별 성적입니다.</p></div></div>
    <div class="stat-cards">${card(T.g, '통산 경기')}${card(T.g ? R(T.w / T.g * 100) + '%' : '-', `승률 (${T.w}승)`)}${card(T.k, '통산 처치')}${card(T.best, '최다 연승')}${card(t1, '1부 우승')}${card(t2, '2부 우승')}${card(S.cupWins || 0, '컵 우승')}${card(ups, '승격')}${card(`${Object.keys(S.ach || {}).length}/${ACHS.length}`, '업적')}</div>
    <div class="grid2" style="margin-top:1.2rem">
      <section class="panel"><h3>시즌별 성적</h3>
        ${hist.length ? `<div style="overflow-x:auto"><table class="hist-t"><thead><tr><th>시즌</th><th>리그</th><th class="r">순위</th><th>우승 학교</th><th>컵</th><th class="r">목표</th><th>승강</th></tr></thead><tbody>
          ${hist.map(h => `<tr class="${h.rank === 1 ? 'me' : ''}"><td class="num">${h.season}</td><td>${h.div ? h.div + '부' : '-'}</td><td class="r">${medal(h.rank)}</td><td>${esc(h.champ)}</td><td>${cupT(h.cup)}</td><td class="num r">${h.goals != null ? h.goals + '/3' : '-'}</td><td>${h.move === 'up' ? '<span class="good">▲ 승격</span>' : h.move === 'down' ? '<span class="bad">▼ 강등</span>' : ''}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">아직 끝난 시즌이 없습니다.</p>'}
      </section>
      <section class="panel"><h3>많이 쓴 마법 <span class="muted" style="font-size:.82rem">횟수 · 승률</span></h3>
        ${picks.length ? picks.map(id => { const n = T.picks[id], w = T.pickW[id] || 0; return `<div class="pick-row"><span style="color:${EL[CH[id].e].c}">${CH[id].n}</span><div class="bar mid"><i style="width:${n / maxP * 100}%"></i></div><span class="num">${n}회</span><span class="num muted" title="이 마법을 쓴 경기 승률">${R(w / n * 100)}%</span></div>`; }).join('') : '<p class="muted">경기를 치르면 기록됩니다.</p>'}
      </section>
    </div>
    <section class="panel" style="margin-top:1.2rem"><h3>재학생 통산 기록</h3>
      <div style="overflow-x:auto"><table><thead><tr><th>학생</th><th class="r">학년</th><th class="r">종합</th><th class="r">출전</th><th class="r">승리</th><th class="r">처치</th><th class="r">죽음</th><th class="r">MVP</th></tr></thead><tbody>
        ${studs.map(st => { const r = st.rec || {g:0, w:0, k:0, d:0, mvp:0}; return `<tr><td>${esc(st.name)} ${elChip(st.elem)}</td><td class="num r">${st.year}</td><td class="num r">${R(ovr(st))}</td><td class="num r">${r.g}</td><td class="num r">${r.w}</td><td class="num r">${r.k}</td><td class="num r">${r.d}</td><td class="num r">${r.mvp}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="muted" style="font-size:.85rem;margin-top:.5rem">졸업생 기록은 명예의 전당에 있습니다.</p>
    </section>`;
}
