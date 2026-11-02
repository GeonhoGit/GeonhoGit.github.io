// 경기 결과, 이번 주 성장, 시즌 결산, 졸업, 모집
"use strict";

/* ---------- 이번 주 성장 ---------- */
function growthHtml(){
  const g = V.growth || []; if (!g.length) return '';
  return `<section class="panel" style="margin-bottom:1rem"><h3>이번 주 성장</h3><div style="overflow-x:auto"><table class="growth">
    <thead><tr><th>학생</th><th>이번 주</th><th>변화</th><th class="r">컨디션</th></tr></thead>
    <tbody>${g.map(x => `<tr><td style="white-space:nowrap">${esc(x.name)}${x.played ? ' <span class="muted" style="font-size:.8rem">출전</span>' : ''}</td>
      <td>${x.train === 'rest' ? '휴식' : x.train ? STATN[x.train] + ' 훈련' : '<span class="muted">훈련 없음</span>'}</td>
      <td>${x.d.length ? x.d.map(([k,v]) => `<span class="good">${STATN[k]} +${v.toFixed(1)}</span>`).join(' ') : '<span class="muted">-</span>'}</td>
      <td class="num r" style="white-space:nowrap">${R(x.c0)} → <span class="${x.c1 < x.c0 ? 'bad' : 'good'}">${R(x.c1)}</span></td></tr>`).join('')}</tbody></table></div></section>`;
}
function nextBuffHtml(){
  const nb = S.nextBuff; if (!nb || !nb.v) return '';
  return nb.v > 0 ? `<span class="good" style="margin-left:.5rem">투지 +${R(nb.v*100)}%</span>` : `<span class="bad" style="margin-left:.5rem">전술 노출 ${R(nb.v*100)}%</span>`;
}

/* ---------- 결과 ---------- */
function viewResult(){
  if (!B.applied){
    B.applied = true;
    B.mvp = [...B.units].sort((a,b) => (b.k*300 + b.dmg + b.heal) - (a.k*300 + a.dmg + a.heal))[0];
    const res = {opp:D.opp, winner:B.winner, score:[...B.score], starters:D.picks[0].map(p => p.sid),
      units:B.units.filter(u => u.team === 0).map(u => ({sid:u.st.id, champ:u.champ, k:u.k, d:u.d})), mvp: B.mvp.team === 0 ? B.mvp.st.id : null};
    const goldBefore = S.gold, fameBefore = S.fame;
    B.isFinal = S.phase === 'final'; B.isCup = S.phase === 'cup'; B.cupLabel = B.isCup ? `마법사 컵 ${cupRoundName()}` : '';
    S.lastWage = 0;
    B.ups = (B.isCup ? applyCup(res) : B.isFinal ? applyFinal(res) : applyWeek(res)) || [];
    B.wage = S.lastWage || 0;
    const matchAchievements = checkMatchAch(B, res);
    B.ups.push(...matchAchievements);
    if (matchAchievements.length) save();
    sfx(B.winner === 0 ? 'win' : 'lose');
    B.gold = S.gold - goldBefore; B.fame = S.fame - fameBefore;
  }
  const win = B.winner === 0, op = school(D.opp);
  const mvp = B.mvp;
  const rows = t => B.units.filter(u => u.team === t).map(u => `<tr class="${u===mvp?'me':''}"><td>${esc(u.st.name)}${u===mvp?' <span class="mvp">MVP</span>':''}</td><td><span class="rg" style="background:${EL[u.c.e].c};color:${EL[u.c.e].fg || '#fff'}" title="${EL[u.c.e].n}">${u.c.g}</span> ${u.c.n}</td><td class="num r">${u.k}</td><td class="num r">${u.d}</td><td class="num r">${R(u.dmg)}</td><td class="num r">${R(u.heal)}</td></tr>`).join('');
  const head = `<thead><tr><th>학생</th><th>마법</th><th class="r">처치</th><th class="r">죽음</th><th class="r">피해</th><th class="r">회복</th></tr></thead>`;
  return `<div class="spread" style="margin-bottom:1rem">
      <div><div class="verdict ${win?'win':'lose'}">${win ? '승리' : '패배'}</div>
      <p class="num" style="font-size:1.2rem">${B.score[0]} 대 ${B.score[1]}, 상대 ${esc(op.name)}${B.tiebreak ? ' <span class="muted" style="font-size:.9rem">(연장까지 동점이라 총 피해량으로 판정)</span>' : B.overtime ? ' <span class="muted" style="font-size:.9rem">(연장전 결승 처치)</span>' : ''}</p>
      <p class="muted">${B.isCup ? `${B.cupLabel}. ` : ''}${B.isFinal ? `결승 ${S.final.games.length}차전, 시리즈 ${S.final.wins[0]} 대 ${S.final.wins[D.opp]}. ` : ''}보상 <span class="coin"></span>${B.gold}골드${B.wage ? ` (전학생 수당 ${B.wage}골드를 뺀 값)` : ''}, 명성 +${B.fame}. 이번 주 훈련 결과는 아래에 있습니다.</p>
      ${B.ups && B.ups.length ? `<div class="ups">${B.ups.map(u => `<div>${esc(u)}</div>`).join('')}</div>` : ''}</div>
      <button class="btn" data-a="afterResult">${S.phase === 'season_end' ? '시즌 결산 보기' : '본관으로'}</button>
    </div>
    ${growthHtml()}
    <section class="panel" style="margin-bottom:1rem"><h3>${esc(me().name)}</h3><div style="overflow-x:auto"><table class="res-t">${head}<tbody>${rows(0)}</tbody></table></div></section>
    <section class="panel"><h3>${esc(op.name)}</h3><div style="overflow-x:auto"><table class="res-t">${head}<tbody>${rows(1)}</tbody></table></div></section>
    <details class="analysis"><summary>경기 기록 분석 보기 <span class="muted">시간대별 점수, 사망 시점, 작전 이후 기록</span></summary>${battleAnalysisHtml(B)}</details>`;
}

/* ---------- 시즌 종료, 졸업, 모집 ---------- */
function viewSeasonEnd(){
  const st = finalRanking(), rank = st.findIndex(s => s.player) + 1;
  return `<section class="panel" style="max-width:720px">
    <p class="muted">시즌 ${S.season} 결산</p>
    <div class="verdict ${rank===1?'win':''}" style="margin:.2rem 0 .6rem">${rank===1 ? '우승' : rank + '위'}</div>
    ${S.final ? `<div style="margin-bottom:1rem">${finalHtml()}</div>` : ''}
    <p class="muted" style="font-size:.85rem">결승 승자가 1위, 패자가 2위이고 나머지는 정규 리그 성적순입니다.</p>
    ${divNoteHtml(rank)}
    <div style="margin:1rem 0">${goalsHtml(true)}</div>
    <table><thead><tr><th>순위</th><th>학교</th><th class="r">승</th><th class="r">패</th><th class="r">처치 득실</th></tr></thead>
    <tbody>${st.map((s,i) => `<tr class="${s.player?'me':''}"><td>${i+1}</td><td>${esc(s.name)}</td><td class="num r">${s.w}</td><td class="num r">${s.l}</td><td class="num r">${s.kd>0?'+':''}${s.kd}</td></tr>`).join('')}</tbody></table>
    <p style="margin-top:1rem">${divName()} 순위 상금 <span class="coin"></span>${seasonPrize(rank)}골드를 받습니다.${rank >= 5 ? ' 하위권 재건 지원금과 더 좋은 신입생 후보도 받습니다.' : ''} 이제 4학년이 졸업합니다.</p>
    <button class="btn" style="margin-top:.6rem" data-a="doGraduation">졸업식 진행</button>
  </section>`;
}
function viewGraduation(){
  const g = S.lastGrads;
  return `<section class="panel" style="max-width:720px">
    <h2>졸업식</h2>
    ${lastMoveHtml()}${lastGoalsHtml()}
    ${g.length ? `<p class="muted">이번에 떠나는 4학년입니다.</p>
      <table><thead><tr><th>이름</th><th>원소</th><th class="r">종합</th><th>진로</th></tr></thead><tbody>
      ${g.map(x => `<tr><td>${esc(x.name)}</td><td>${elChip(x.elem)}</td><td class="num r">${x.ovr}</td><td>${x.coachAt ? `<span class="bad">${esc(x.coachAt)} 코치로 부임</span>` : '<span class="muted">마법사 길드 입단</span>'}</td></tr>`).join('')}
      </tbody></table>
      ${g.some(x => x.coachAt) ? '<p style="margin-top:.6rem;font-size:.92rem">우리 졸업생이 코치로 간 학교는 다음 시즌 능력치가 4% 오릅니다.</p>' : ''}`
      : '<p class="muted">올해는 졸업생이 없습니다.</p>'}
    ${g.length ? '<p class="muted" style="margin-top:.6rem;font-size:.9rem">졸업생의 기록은 명예의 전당에 남습니다.</p>' : ''}
    <p style="margin-top:.8rem">남은 학생은 한 학년씩 올라갑니다. 학생은 지금 ${me().students.length}명입니다.</p>
    <button class="btn" style="margin-top:.6rem" data-a="go" data-v="recruit">신입생 모집</button>
  </section>`;
}
function viewRecruit(){
  const n = me().students.length, ex = expiring().length, ready = n - ex >= 3;
  if (!S.market) rollMarket();
  const tab = V.recruitTab || 'new';
  const head = `<div class="spread" style="margin-bottom:1rem">
      <div><h2 style="margin:0">${tab === 'market' ? '이적 시장' : '신입생 모집'}</h2><p class="muted">학생은 최대 ${ROSTER_MAX}명. 지금 ${n}명${ex ? ` (계약 만료 ${ex}명)` : ''}, 보유 골드 <span class="coin"></span>${S.gold}.${tab === 'market' ? '' : ' 명성이 높을수록 좋은 지원자가 옵니다.'}</p></div>
      <div class="row">
        ${n - ex < 3 && tab === 'new' ? `<button class="btn ghost" data-a="freeRecruit">무료 지원자 받기</button>` : ''}
        <button class="btn" data-a="nextSeason" ${ready ? '' : 'disabled'}>${ready ? `시즌 ${S.season+1} 시작` : '학생이 3명 이상 필요합니다'}</button>
      </div></div>
    ${recruitTabs()}`;
  const diffBox = `<section class="panel" style="margin-top:1.4rem"><h3>다음 시즌 난이도</h3>${diffPicker(diffKey(), 'setDiff')}</section>`;
  if (tab === 'market') return head + marketHtml() + diffBox;
  return `${head}
    ${foldOnMobile('다음 시즌 선수 구성 보기', rosterOutlookHtml(true))}${foldOnMobile('영입 후보 비교 보기', recruitCompareHtml())}
    <div class="cards prospects">${S.prospects.map(p => `<div>${studentCard(p, {cost:p.cost})}<div class="pc-actions"><button class="btn ghost small" data-a="compareRecruit" data-v="${p.id}" aria-pressed="${(S.prospects.find(candidate => candidate.id === V.compareRecruit) || S.prospects[0])?.id === p.id}">비교</button><button class="btn small" data-a="recruit" data-v="${p.id}" ${S.gold>=p.cost && n<ROSTER_MAX ? '' : 'disabled'}>영입하기</button></div></div>`).join('')}</div>
    ${S.prospects.length ? '' : '<p class="muted">남은 지원자가 없습니다.</p>'}
    ${foldOnMobile(`현재 학생 ${me().students.length}명 보기`, `<h3 style="margin-top:1.4rem">현재 학생</h3>
    <div class="cards">${me().students.map(st => studentCard(st)).join('')}</div>`)}${diffBox}`;
}
