// 화면 틀, 렌더링, 첫 주 안내, 본관·훈련·학생·리그·도감 화면
"use strict";

/* =========================================================
   화면
   ========================================================= */
const root = document.getElementById('root');
const CREST = `<svg class="crest" viewBox="0 0 34 38" aria-hidden="true"><path d="M17 1 L32 6 V18 C32 28 25 34 17 37 C9 34 2 28 2 18 V6 Z" fill="#252c57" stroke="#dcb96e" stroke-width="1.5"/><path d="M17 9 l2.6 6.2 6.6.5-5 4.3 1.6 6.5L17 23l-5.8 3.5 1.6-6.5-5-4.3 6.6-.5z" fill="#dcb96e"/></svg>`;

// 메뉴 인장: 마법 표식(炎, 氷…)과 같은 한자 인장으로 통일
const NAV_SEAL = {hub:'館', train:'練', students:'生', facility:'設', league:'戰', hall:'譽', records:'錄', codex:'典', help:'助', backup:'藏'};
function shell(inner, nav = true){
  const tabs = [['hub','본관'],['train','훈련'],['students','학생'],['facility','시설'],['league','리그 순위'],['hall','명예의 전당'],['records','기록실'],['codex','마법 도감'],['help','도움말'],['backup','저장 관리']];
  return `
  <header class="topbar">
    <div class="plaque">${CREST}
      <div><div class="school-name">${esc(me().name)}</div>
        <div class="badges"><span class="badge trophy" title="우승 횟수">우승 ${S.trophies}회</span><span class="badge">${divName()}</span><span class="badge">난이도 ${diff().n}</span></div></div></div>
    <div class="meta hud">
      <span class="res season"><b>시즌 ${S.season}</b> ${S.phase === 'final' ? '결승' : S.phase === 'cup' ? '컵 대회' : S.phase === 'season_end' || S.phase === 'graduation' ? '결산' : Math.min(S.week+1, WEEKS) + '주차'}</span>
      <span class="res num" title="골드"><span class="coin"></span>${S.gold}</span>
      <span class="res num" title="명성"><span class="star" aria-hidden="true">★</span><span class="sr">명성</span>${S.fame}</span>
      <span class="snds"><button class="snd" data-a="music" aria-pressed="${musicOn()}" title="배경 음악 켜기/끄기">음악</button><button class="snd" data-a="sound" aria-pressed="${soundOn()}" title="효과음 켜기/끄기">효과음</button></span>
    </div>
  </header>
  <div class="layout ${nav ? '' : 'full'}">
    ${nav ? `<nav aria-label="메뉴">${tabs.map(([k,n]) => `<button data-a="go" data-v="${k}" aria-current="${V.view===k}"><span class="seal" aria-hidden="true">${NAV_SEAL[k]}</span><span class="lbl">${n}</span></button>`).join('')}
      <div style="flex:1"></div><button data-a="reset" class="hide-sm" style="font-size:.82rem">새 게임</button></nav>` : ''}
    <main>${inner}</main>
  </div>`;
}

const META = ['hub','train','students','facility','league','hall','records','codex','help','backup'];
// First-week guidance. Only new games opt in through S.tutorial.
function tutorialActive(){
  return !!(S && S.tutorial && !S.tutorial.dismissed && S.season === 1 && S.week === 0);
}
function markTutorial(key){
  if (!tutorialActive() || !['event','train','draft','tactic'].includes(key) || S.tutorial[key]) return;
  S.tutorial[key] = true;
  save();
}
function tutorialStep(){
  if (!tutorialActive()) return null;
  const t = S.tutorial;
  // Once a match has begun, never send the player back to training or the hub.
  if (V.view === 'battle') return t.tactic ? null : {id:'tactic', n:4, title:'작전을 한 번 써 보세요', text:B && B.autoTac && B.autoTac[0] ? '자동 작전이 켜져 있습니다. 직접 지휘하려면 자동 작전을 끄고 작전 하나를 골라 보세요. 자동 관전으로 진행해도 됩니다.' : '전투 아래의 작전 버튼으로 공격·수비·재정비를 지시할 수 있습니다. 경기당 두 번까지 사용하며, 사용하지 않고 관전해도 됩니다.'};
  if (V.view === 'draft') return t.draft
    ? {id:'tactic', n:4, title:'이제 대항전을 시작하세요', text:'배치를 확인한 뒤 대항전을 시작하세요. 경기 중 작전을 직접 지시하거나 자동 작전으로 관전할 수 있습니다.'}
    : {id:'draft', n:3, title:'마법과 학생을 함께 고르세요', text:'우리 차례에 마법을 금지하거나, 출전할 마법과 맡을 학생을 선택하세요. 코치 조언에서 추천 이유를 확인할 수 있습니다.'};
  if (!['hub','train','students','facility','league','hall','codex'].includes(V.view)) return null;
  if (S.event && !t.event) return {id:'event', n:1, title:'이번 주 사건을 처리하세요', text:'본관의 사건에서 두 선택지의 비용과 효과를 살펴본 뒤 하나를 고르세요. 사건을 처리하면 경기를 준비할 수 있습니다.'};
  if (!t.train) return {id:'train', n:2, title:'훈련 계획을 확정하세요', text:'학생별 훈련이나 휴식을 고르고, 훈련 화면 아래의 선택 완료를 누르세요. 확정한 훈련은 경기가 끝난 뒤 반영됩니다.'};
  if (!t.draft) return {id:'draft', n:3, title:'경기 준비를 눌러 밴픽을 시작하세요', text:'본관에서 상대 분석을 살펴본 뒤 경기 준비를 누르세요. 마법을 금지하고 학생 셋에게 마법을 맡기면 출전 명단이 정해집니다.'};
  return null;
}
function tutorialHtml(){
  const step = tutorialStep(); if (!step) return '';
  const meta = ['hub','train','students','facility','league','hall','codex'].includes(V.view);
  let action = '';
  if (meta && step.id === 'train' && V.view !== 'train') action = '<button class="btn small" data-a="go" data-v="train">훈련 정하기</button>';
  else if (meta && ['event','draft'].includes(step.id) && V.view !== 'hub') action = '<button class="btn small" data-a="go" data-v="hub">본관으로</button>';
  return `<section class="panel" style="margin-bottom:1rem;border-color:var(--brass)" aria-label="첫 주 안내"><div class="spread"><h3 style="margin:0">첫 주 안내 ${step.n}/4 · ${esc(step.title)}</h3><button class="btn ghost small" data-a="dismissTutorial">안내 닫기</button></div><p class="muted" style="margin-top:.5rem">${esc(step.text)}</p>${action ? `<div style="margin-top:.5rem">${action}</div>` : ''}</section>`;
}
function refreshTutorial(){
  const box = document.getElementById('tutorial');
  if (box) box.innerHTML = tutorialHtml();
}
function completeTacticLesson(battle, team){
  if (battle === B && team === 0 && V.view === 'battle' && !battle.headless && !battle.autoTac[0]) { markTutorial('tactic'); refreshTutorial(); }
}


function render(){
  if (B && V.view !== 'battle') stopLoop();
  if (S && S.phase === 'graduation' && META.includes(V.view)) V.view = 'recruit';
  const v = V.view;
  if (v === 'start') return root.innerHTML = viewStart();
  if (S.phase === 'season_end' && v === 'hub') return root.innerHTML = shell(viewSeasonEnd());
  const map = {hub:viewHub, train:viewTrain, students:viewStudents, facility:viewFacility, hall:viewHall, league:viewLeague, codex:viewCodex, records:viewRecords, backup:viewBackup, help:viewHelp, draft:viewDraft, battle:viewBattle, result:viewResult, graduation:viewGraduation, recruit:viewRecruit};
  const navOn = META.includes(v);
  root.innerHTML = shell(`<div id="tutorial">${tutorialHtml()}</div>${tipHtml()}` + map[v](), navOn);
  musicMode();
  if (navOn && narrow()){ const cur = document.querySelector('nav [aria-current="true"]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({block:'nearest', inline:'center'}); }
  if (v === 'battle') startLoop();
  if (v === 'draft') maybeAi();
}

const MAGIC_CIRCLE = `<svg viewBox="0 0 400 400"><g fill="none" stroke="currentColor">
  <circle cx="200" cy="200" r="196" stroke-width="1.5"/><circle cx="200" cy="200" r="182" stroke-width=".8" stroke-dasharray="2 6"/>
  <circle cx="200" cy="200" r="150" stroke-width="1.2"/><circle cx="200" cy="200" r="96" stroke-width=".8"/>
  <path d="M200 50 L330 275 L70 275 Z M200 350 L70 125 L330 125 Z" stroke-width="1"/>
  ${[...Array(24)].map((_, i) => { const a = i / 24 * Math.PI * 2, r1 = 150, r2 = i % 2 ? 160 : 170; return `<line x1="${200 + Math.cos(a)*r1}" y1="${200 + Math.sin(a)*r1}" x2="${200 + Math.cos(a)*r2}" y2="${200 + Math.sin(a)*r2}" stroke-width="1"/>`; }).join('')}
  ${['炎','風','地','水','光','闇'].map((g, i) => { const a = (i / 6 - .25) * Math.PI * 2; return `<circle cx="${200 + Math.cos(a)*166}" cy="${200 + Math.sin(a)*166}" r="13" stroke-width="1"/><text x="${200 + Math.cos(a)*166}" y="${200 + Math.sin(a)*166 + 5}" text-anchor="middle" font-size="15" fill="currentColor" stroke="none">${g}</text>`; }).join('')}
</g></svg>`;
function viewStart(){
  const has = !!loadSave();
  return `<div class="start"><div class="magic-circle" aria-hidden="true">${MAGIC_CIRCLE}</div><div class="start-card panel">
    ${CREST.replace('class="crest"','class="crest" style="width:56px;height:62px"')}
    <h1>마법학교 대항전</h1>
    <p class="lede">학생을 키우고, 마법을 금지하고 고르고, 3대3 대항전을 지켜보세요. 4학년은 졸업해서 떠나니 매년 새 얼굴을 찾아야 합니다.</p>
    <div class="field"><label for="sname">학교 이름</label><input id="sname" maxlength="14" value="은하수 마법학교"></div>
    <div class="field"><span>학교의 상징 원소</span>
      <div class="elpick" role="group">${ELK.map(k => `<button data-a="startElem" data-v="${k}" aria-pressed="${V.startElem===k}"><span class="el ${k}">${EL[k].n}</span></button>`).join('')}</div>
      <small class="muted">상징 원소를 가진 학생이 더 자주 입학합니다.</small></div>
    <div class="field"><span>난이도</span>${diffPicker(V.startDiff || 'normal', 'startDiff')}</div>
    <div class="row" style="margin-top:1.4rem">
      <button class="btn" data-a="newGame">새 학교 세우기</button>
      <button class="btn ghost" data-a="startImport">저장 불러오기</button>
      ${has ? `<button class="btn ghost" data-a="continue">이어하기</button>` : ''}
    </div>
  ${V.startImport ? `<div class="field" style="margin-top:1.2rem"><span>저장 불러오기</span>${importBoxHtml('importStart', '불러와서 시작')}</div>` : ''}
  </div></div>`;
}

function condBar(c){ return `<div class="bar ${c < 50 ? 'low' : c < 75 ? 'mid' : ''}" title="컨디션 ${R(c)}"><i style="width:${c}%"></i></div>`; }

const TRAIN = [['atk','공격'],['def','수비'],['int','판단'],['rest','휴식']];
const STATN = {atk:'공격', def:'수비', int:'판단'};
function growRange(st, focus){
  const yf = [1.3, 1.1, .9, .7][st.year-1] || .7, k = (.6 + st.pot*.2) * yf * traitGrow(st) * facGrowMult(focus || st.train) * overGrow(st[focus || st.train]);
  return [.4*k, 1.6*k];
}
function viewHub(){
  const my = me(), op = school(opponentId());
  const plan = {}; my.students.forEach(st => { const k = st.train || 'none'; plan[k] = (plan[k] || 0) + 1; });
  const tired = my.students.filter(st => st.cond < 60);
  return `<div class="grid2 hub-grid">
    <div class="stack">
      ${eventHtml()}
      <section class="panel">
        <div class="spread">
          <div>
            <p class="muted">${S.phase === 'final' ? `결승 ${S.final.games.length + 1}차전, 시리즈 ${S.final.wins[0]} 대 ${S.final.wins[opponentId()]}` : S.phase === 'cup' ? `마법사 컵 ${cupRoundName()} 상대` : `${S.week+1}주차 상대`}</p>
            <h2 style="margin:.1rem 0">${esc(op.name)}</h2>
            <p>${op.elem ? elChip(op.elem) : '<span class="muted">원소 혼합</span>'} <span class="num" style="margin-left:.5rem">${op.w}승 ${op.l}패</span>
            ${op.coach ? `<span class="muted" style="margin-left:.5rem">코치 ${esc(op.coach.name)} (우리 졸업생)</span>` : ''}${nextBuffHtml()}</p>
            ${flowHtml()}
            ${rivalryBonus() ? `<p class="bad" style="font-size:.88rem">견제: 최근 3시즌 동안 ${recentTitles()}번 우승한 우리를 상대 학교들이 집중 분석해 능력치 +${R(rivalryBonus()*100)}%로 나옵니다.</p>` : ''}
            ${coachActive() ? `<p class="good" style="font-size:.88rem">코치 ${esc(S.myCoach.name)}: 우리 능력치 +3%</p>` : ''}
          </div>
          ${S.event ? '<button class="btn" disabled>사건을 먼저 처리하세요</button>' : '<button class="btn" data-a="startDraft">경기 준비</button>'}
        </div>
      </section>
      ${S.phase === 'final' ? finalHtml() : ''}${S.phase === 'cup' ? cupHtml() : ''}
      ${goalsHtml()}
      <section class="panel">
        <div class="spread"><h3 style="margin:0">이번 주 훈련 계획 ${S.trainSet ? '<span class="good" style="font-size:.85rem">확정됨</span>' : '<span class="bad" style="font-size:.85rem">미확정</span>'}</h3><button class="btn ghost small" data-a="go" data-v="train">훈련 정하기</button></div>
        ${pendingTrain() ? `<p class="bad" style="font-size:.9rem;margin-top:.4rem">훈련 탭에서 바꾼 ${pendingTrain()}건을 아직 확정하지 않았습니다.</p>` : S.trainSet ? '' : '<p class="muted" style="font-size:.9rem;margin-top:.4rem">확정하지 않으면 지난 계획대로 훈련합니다.</p>'}
        <p style="margin-top:.5rem">${[...TRAIN.filter(([k]) => plan[k]).map(([k,n]) => `${n} ${plan[k]}명`), ...(plan.none ? [`<span class="bad">훈련 미정 ${plan.none}명</span>`] : [])].join(', ')}</p>
        ${tired.length ? `<p class="bad" style="font-size:.9rem">컨디션이 낮은 학생: ${tired.map(st => `${esc(st.name)} ${R(st.cond)}`).join(', ')}</p>` : '<p class="muted" style="font-size:.9rem">컨디션이 크게 떨어진 학생은 없습니다.</p>'}${moraleWarnHtml()}
      </section>
      <section class="panel">
        <div class="spread"><h3 style="margin:0">학생 ${my.students.length}명</h3><button class="btn ghost small" data-a="go" data-v="students">학생 보기</button></div>
        <div class="mini-roster">${[...my.students].sort((a,b) => ovr(b) - ovr(a)).map(st => `<div><span>${esc(st.name)}</span> ${elChip(st.elem)} <span class="ovr num" style="font-size:1.05rem">${R(ovr(st))}</span>${condBar(st.cond)}</div>`).join('')}</div>
      </section>
    </div>
    <div class="stack">
      <section class="panel"><h3 style="margin:0">상대 분석: ${esc(op.name)}</h3>${intelHtml(op.id)}</section>
      <section class="panel">
        <div class="spread"><h3 style="margin:0">시설</h3><button class="btn ghost small" data-a="go" data-v="facility">시설 보기</button></div>
        <div class="fac-mini">${Object.keys(FAC).map(k => `<span>${FAC[k].n} <span class="pips">${'●'.repeat(facLevel(k))}${'○'.repeat(FAC_MAX-facLevel(k))}</span></span>`).join('')}</div>
      </section>
      <section class="panel">
        <h3>이번 시즌 패치</h3>
        ${S.patchNotes.length ? `<ul class="patch">${S.patchNotes.map(p => `<li class="${p.buff?'good':'bad'}">${p.buff?'▲':'▼'} ${p.text}</li>`).join('')}</ul>` : '<p class="muted">개막 시즌이라 아직 패치가 없습니다. 다음 시즌부터 매번 밸런스가 바뀝니다.</p>'}
      </section>
      <section class="panel">
        <h3>소식</h3>
        <ul class="news">${S.news.slice(0,8).map(n => `<li><span class="muted num">${n.s}-${n.w}</span> ${esc(n.msg)}</li>`).join('')}</ul>
      </section>
    </div>
  </div>`;
}

const trainPicked = st => (V.trainDraft && V.trainDraft[st.id]) || (S.trainSet ? st.train : null);
const planOf = st => (V.trainDraft && V.trainDraft[st.id]) || st.train;
const pendingTrain = () => me().students.filter(st => V.trainDraft && V.trainDraft[st.id] && V.trainDraft[st.id] !== st.train).length;
function viewTrain(){
  const my = me(), pending = pendingTrain();
  const status = S.trainSet
    ? '<p class="good" style="font-size:.92rem">이번 주 훈련 계획을 확정했습니다. 다음 경기가 끝나면 이 계획대로 훈련합니다.</p>'
    : '<p class="bad" style="font-size:.92rem">아직 확정하지 않았습니다. 확정하지 않으면 지난 계획대로 훈련합니다.</p>';
  return `<div class="spread" style="margin-bottom:1rem">
      <div><h2 style="margin:0">훈련</h2><p class="muted">훈련을 고르고 "선택 완료"를 누르면 확정됩니다. 확정한 훈련은 다음 경기가 끝난 뒤 진행됩니다.</p>${status}</div>
      <div class="row"><button class="btn ghost small" data-a="restTired">컨디션 60 미만은 휴식</button><button class="btn ghost small" data-a="trainWeak">모두 약점 훈련</button></div>
    </div>
    <div class="train-list">${my.students.map(st0 => {
      const st = {...st0, train: planOf(st0)}, changed = st.train !== st0.train;
      const [lo, hi] = growRange(st);
      const weak = ['atk','def','int'].sort((a,b) => st[a] - st[b])[0];
      const dl = facLv('dorm');
      const effect = !st.train ? '<span class="bad">아직 고르지 않음</span> (고르지 않으면 이번 주는 훈련하지 않습니다)' : st.train === 'rest' ? `컨디션 <span class="good">+${R(18 + dl*6)}</span>` : `${STATN[st.train]} <span class="good">+${lo.toFixed(1)}~${hi.toFixed(1)}</span>, 컨디션 −${hasT(st, 'diligent') ? 0 : R(Math.max(1, 4 - dl))}`;
      return `<section class="panel train-row ${changed ? 'changed' : ''}">
        <div class="tr-who">
          <div><span class="nm">${esc(st.name)}</span>${changed ? '<span class="chg">변경됨</span>' : ''} <span class="muted" style="font-size:.85rem">${st.year}학년</span> ${elChip(st.elem)}</div>
          <div style="margin:.2rem 0">${traitChips(st)}</div>
          <div class="row" style="gap:.5rem;font-size:.82rem"><span class="muted">컨디션 <span class="num">${R(st.cond)}</span></span>${condBar(st.cond)}<span class="stars" title="잠재력 ${st.pot}">${stars(st.pot)}</span></div>
        </div>
        <div class="tr-stats">${['atk','def','int'].map(k => `<div class="${k === weak ? 'weak' : ''}"><span class="muted">${STATN[k]}</span><b class="num">${R(st[k])}${st.last && st.last.k === k ? `<span class="delta">+${st.last.g.toFixed(1)}</span>` : ''}</b></div>`).join('')}</div>
        <div class="tr-pick">
          <div class="seg" role="group" aria-label="${esc(st.name)} 훈련">${TRAIN.map(([k,n]) => { const on = trainPicked(st0) === k, prev = !on && !trainPicked(st0) && st0.train === k; return `<button data-a="setTrain" data-v="${st.id}:${k}" aria-pressed="${on}" ${prev ? 'class="prev" title="지난주 계획. 이번 주에 고르지 않으면 이대로 훈련합니다."' : ''}>${n}</button>`; }).join('')}</div>
          <div class="muted" style="font-size:.82rem;margin-top:.3rem">예상 효과: ${effect}<br>경기 후 컨디션: 출전하면 ${R(nextCondition(st, true))}, 쉬면 ${R(nextCondition(st, false))}</div>
        </div>
      </section>`; }).join('')}</div>
    <div class="confirm-bar">
      <span class="${pending ? '' : 'muted'}">${pending ? `바뀐 훈련 ${pending}건, 아직 확정 전` : S.trainSet ? '확정한 계획 그대로입니다' : '훈련을 고른 뒤 확정하세요'}</span>
      <button class="btn ghost" data-a="trainReset" ${pending ? '' : 'disabled'}>되돌리기</button>
      <button class="btn" data-a="trainConfirm">선택 완료</button>
    </div>
    <p class="muted" style="font-size:.86rem;margin-top:.8rem">저학년과 잠재력 높은 학생이 빨리 자랍니다. 공격은 피해량, 수비는 체력과 방어, 판단은 주문 재사용 시간과 표적 선택에 영향을 줍니다.</p>`;
}

function statBar(label, v){
  const over = v > 100 ? `<i class="ov" style="width:${clamp((v-100)/(STAT_MAX-100)*100,0,100)}%"></i>` : '';
  return `<div class="sbar"><span class="muted">${label}</span><div class="bar mid ${v > 100 ? 'over' : ''}" title="${v > 100 ? `100 초과, 최대 ${STAT_MAX}` : ''}"><i style="width:${clamp(v,0,100)}%"></i>${over}</div><b class="num ${v > 100 ? 'over-n' : ''}">${R(v)}</b></div>`;
}
// Insert these functions before viewStudents(). No new dependencies or persistent state.
function rosterOutlook(sc, afterGraduation = false){
  const graduates = afterGraduation ? [] : sc.students.filter(st => st.year >= 4);
  const students = afterGraduation ? [...sc.students] : sc.students.filter(st => st.year < 4);
  const elements = {}, magic = {};
  students.forEach(st => {
    elements[st.elem] = (elements[st.elem] || 0) + 1;
    (st.fav || []).forEach(id => { if (CH[id]) magic[id] = (magic[id] || 0) + 1; });
  });
  return {students, graduates, elements, magic, missingElements:ELK.filter(e => !elements[e])};
}
function rosterOutlookHtml(afterGraduation = false){
  const o = rosterOutlook(me(), afterGraduation);
  const lostMagic = [...new Set(o.graduates.flatMap(st => st.fav || []))].filter(id => CH[id] && !o.magic[id]);
  const elemText = ELK.filter(e => o.elements[e]).map(e => `${elChip(e)} ${o.elements[e]}명`).join(', ') || '남는 학생이 없습니다.';
  const magicText = Object.keys(o.magic).map(id => `${CH[id].n} ${o.magic[id]}명`).join(', ') || '없음';
  return `<section class="panel" style="margin-bottom:1rem">
    <h3>다음 시즌 선수 구성</h3>
    <p>${afterGraduation ? '졸업 처리 후 현재' : '졸업 후 남는'} 학생 <b class="num">${o.students.length}/${ROSTER_MAX}명</b>${o.students.length < 3 ? ` <span class="bad">(출전 최소 인원까지 ${3-o.students.length}명 필요)</span>` : ''}</p>
    ${!afterGraduation ? `<p class="muted" style="font-size:.88rem">졸업 예정: ${o.graduates.length ? o.graduates.map(st => esc(st.name)).join(', ') : '없음'}</p>` : ''}
    <p style="font-size:.88rem;margin-top:.45rem">학생 원소: ${elemText}</p>
    <p class="muted" style="font-size:.85rem">남은 학생에게 없는 원소: ${o.missingElements.length ? o.missingElements.map(elChip).join(' ') : '없음'}</p>
    <p style="font-size:.88rem;margin-top:.45rem">남는 주력 마법: ${magicText}</p>
    ${!afterGraduation ? `<p class="${lostMagic.length ? 'bad' : 'muted'}" style="font-size:.85rem">졸업 후 주력 담당이 없어지는 마법: ${lostMagic.length ? lostMagic.map(id => CH[id].n).join(', ') : '없음'}</p>` : ''}
    <p class="muted" style="font-size:.8rem;margin-top:.45rem">원소와 주력 마법의 빈자리를 영입에 참고하세요. 주력이 아닌 마법도 맡길 수 있습니다.</p>
  </section>`;
}
function renderRecruitComparison(){
  render();
  const panel = document.getElementById('recruit-compare');
  const fold = panel?.closest('details');
  if (fold) fold.open = true;
  panel?.scrollIntoView({block:'nearest'});
}
function recruitCompareHtml(){
  const prospects = S.prospects || [], students = me().students;
  const p = prospects.find(st => st.id === V.compareRecruit) || prospects[0];
  if (!p) return '<section id="recruit-compare" class="panel" style="margin-bottom:1rem"><h3>영입 후보 비교</h3><p class="muted">비교할 지원자가 없습니다.</p></section>';
  const st = students.find(s => s.id === V.compareStudent) || students[0];
  const favs = s => (s.fav || []).filter(id => CH[id]).map(id => CH[id].n).join(', ') || '없음';
  const cell = s => s == null ? '<span class="muted">없음</span>' : s;
  const row = (label, a, b) => `<tr><th scope="row">${label}</th><td>${cell(a)}</td><td>${cell(b)}</td></tr>`;
  const knownMagic = new Set(students.flatMap(s => s.fav || []));
  const extraMagic = (p.fav || []).filter(id => CH[id] && !knownMagic.has(id));
  const newElement = !students.some(s => s.elem === p.elem);
  return `<section id="recruit-compare" class="panel" style="margin-bottom:1rem">
    <h3>영입 후보 비교</h3>
    <p class="muted" style="font-size:.85rem">아래 후보의 비교 버튼으로 지원자를 바꿀 수 있습니다.</p>
    ${students.length ? `<div class="row" style="margin:.6rem 0" role="group" aria-label="비교할 보유 학생">${students.map(s => `<button class="btn ghost small" data-a="compareStudent" data-v="${s.id}" aria-pressed="${s === st}">${esc(s.name)}</button>`).join('')}</div>` : '<p class="muted" style="margin:.6rem 0">현재 보유 학생이 없어 지원자 정보만 표시합니다.</p>'}
    <div style="overflow-x:auto"><table>
      <thead><tr><th>항목</th><th scope="col">지원자 ${esc(p.name)}</th><th scope="col">${st ? `보유 학생 ${esc(st.name)}` : '보유 학생 없음'}</th></tr></thead>
      <tbody>${row('학년', `${p.year}학년`, st ? `${st.year}학년` : null)}
        ${row('원소', elChip(p.elem), st ? elChip(st.elem) : null)}
        ${['atk','def','int'].map(k => row(STATN[k], `<span class="num">${R(p[k])}</span>`, st ? `<span class="num">${R(st[k])}</span>` : null)).join('')}
        ${row('잠재력', potHtml(p), st ? `<span class="stars">${stars(st.pot)}</span>` : null)}
        ${narrow() ? row('특성', traitChips(p) || '없음', st ? (traitChips(st) || '없음') : null) : row('특성', traitList(p) || '없음', st ? (traitList(st) || '없음') : null)}
        ${row('주력 마법', favs(p), st ? favs(st) : null)}
        ${row('영입 비용', `<span class="coin"></span><span class="num">${p.cost || 0}</span>골드`, st ? '이미 재학 중' : null)}
      </tbody></table></div>
    <p style="font-size:.85rem;margin-top:.6rem">${newElement ? `현재 명단에 없는 ${EL[p.elem].n} 원소 학생입니다.` : `현재 명단에도 ${EL[p.elem].n} 원소 학생이 있습니다.`} ${extraMagic.length ? `보유 학생에게 없는 주력 마법: ${extraMagic.map(id => CH[id].n).join(', ')}.` : '주력 마법은 보유 학생과 겹칩니다.'}</p>
    ${students.length >= ROSTER_MAX ? '<p class="bad" style="font-size:.85rem">학생 정원이 가득 차 지금은 영입할 수 없습니다.</p>' : S.gold < p.cost ? '<p class="bad" style="font-size:.85rem">영입 비용이 부족합니다.</p>' : ''}
  </section>`;
}


function viewStudents(){
  const my = me();
  const list = [...my.students].sort((a,b) => b.year - a.year || ovr(b) - ovr(a));
  return `<div class="spread" style="margin-bottom:1rem"><div><h2 style="margin:0">학생</h2><p class="muted">${my.students.length}/${ROSTER_MAX}명. 4학년은 이번 시즌이 끝나면 졸업합니다. 능력치는 100을 넘어 최대 ${STAT_MAX}까지 오르며, 100을 넘으면 성장이 느려집니다.</p></div></div>
    ${rosterOutlookHtml()}
    <div class="cards wide">${list.map(st => {
      const r = st.rec || {g:0, w:0, k:0, d:0, mvp:0};
      return `<article class="scard" style="--ec:${EL[st.elem].c}">
        <div class="top"><span class="nm">${esc(st.name)}</span><span class="ovr num">${R(ovr(st))}</span></div>
        <div class="row" style="gap:.45rem"><span class="muted" style="font-size:.85rem">${st.year}학년${st.year >= 4 ? ', 졸업 예정' : ''}</span>${elChip(st.elem)}<span class="stars" style="margin-left:auto" title="잠재력 ${st.pot}">${stars(st.pot)}</span></div>
        ${statBar('공격', st.atk)}${statBar('수비', st.def)}${statBar('판단', st.int)}
        <div class="sbar"><span class="muted">컨디션</span>${condBar(st.cond)}<b class="num">${R(st.cond)}</b></div>
        <div style="font-size:.85rem"><span class="muted">주력 마법</span> ${st.fav.map(f => `<span style="color:${EL[CH[f].e].c}">${CH[f].n}</span>`).join(', ')}</div>
        <div class="tr-block">${traitList(st)}</div>
        ${gearSelectHtml(st)}
        <div style="font-size:.85rem"><span class="muted">케미</span> ${chemListHtml(st)}</div>
        ${moraleLine(st)}${awakeLine(st)}
        ${contractLine(st)}
        <div class="mast-block"><div class="muted" style="font-size:.8rem">마법 숙련도</div>${mastRows(st)}</div>
        ${st.pot < 5 && st.year < 4 ? `<button class="btn ghost small" data-a="scholar" data-v="${st.id}" ${st.scholar === S.season || S.gold < scholarCost(st) || !canInvest() ? 'disabled' : ''}>${st.scholar === S.season ? '이번 시즌 장학금 지급함' : `장학금 <span class="coin"></span>${scholarCost(st)} (잠재력 +1)`}</button>` : ''}
        <div class="rec-grid"><span><b class="num">${r.g}</b>출전</span><span><b class="num">${r.w}</b>승리</span><span><b class="num">${r.k}</b>처치</span><span><b class="num">${r.d}</b>죽음</span><span><b class="num">${r.mvp}</b>MVP</span></div>
      </article>`; }).join('')}</div>`;
}

function viewLeague(){
  const st = standings();
  return `${S.final ? `<div style="margin-bottom:1.2rem;max-width:560px">${finalHtml()}</div>` : ''}${S.cup && S.cup.season === S.season ? `<div style="margin-bottom:1.2rem;max-width:560px">${cupHtml()}</div>` : ''}<div class="grid2">
    <section class="panel"><h2>시즌 ${S.season} ${divName()} 순위</h2>
      <table><thead><tr><th>순위</th><th>학교</th><th class="r">승</th><th class="r">패</th><th class="r">처치 득실</th></tr></thead>
      <tbody>${st.map((s,i) => `<tr class="${s.player?'me':''}"><td class="num">${i+1}</td><td>${esc(s.name)} ${s.elem?elChip(s.elem):''}${s.coach?` <span class="muted" style="font-size:.8rem">코치 ${esc(s.coach.name)}</span>`:''}</td><td class="num r">${s.w}</td><td class="num r">${s.l}</td><td class="num r">${s.kd>0?'+':''}${s.kd}</td></tr>`).join('')}</tbody></table>
      <p class="muted" style="font-size:.86rem;margin-top:.6rem">${WEEKS}주 동안 모든 학교와 한 번씩 맞붙고, 상위 2팀이 3판 2선승제 결승을 치릅니다. 결승 승자가 우승 트로피와 상금 ${seasonPrize(1)}골드를 받습니다. ${CUP_WEEK}주차가 끝나면 리그 상위 세 학교와 단판 토너먼트 마법사 컵을 치릅니다.</p>
    </section>
    <section class="panel"><h3>일정과 결과</h3>
      ${S.schedule.map((wk,i) => `<div style="margin:.5rem 0"><div class="muted" style="font-size:.85rem">${i+1}주차</div>
        ${(S.results[i].length ? S.results[i].map(r => `<div style="font-size:.9rem">${r.winA?'<b style="font-weight:400;color:var(--brass)">':''}${esc(school(r.a).name)}${r.winA?'</b>':''} <span class="num">${r.sa}:${r.sb}</span> ${esc(school(r.b).name)}</div>`) :
          wk.map(([a,b]) => `<div style="font-size:.9rem" class="${a===0||b===0?'':'muted'}">${esc(school(a).name)} 대 ${esc(school(b).name)}</div>`)).join('')}
      </div>`).join('')}
    </section>
  </div>${otherDivHtml()}`;
}

function viewCodex(){
  const roles = {'수호':'앞에서 버티는 역할','돌격':'적진에 파고드는 근접','사격':'뒤에서 꾸준히 피해','치유':'아군 회복','제어':'기절·빙결로 흐름 끊기'};
  return `<section class="panel" style="margin-bottom:1.2rem">
      <h2>원소 상성</h2>
      <div class="cycle">${['fire','wind','earth','water','fire'].map((e,i,a) => elChip(e) + (i<a.length-1?' <span class="muted">이긴다</span> ':'')).join('')}</div>
      ${S.expansion ? `<div class="cycle" style="margin-top:.4rem">${elChip('light')} <span class="muted">서로에게 강하다</span> ${elChip('dark')}</div>` : '<p class="muted" style="font-size:.85rem;margin-top:.4rem">시즌 2부터 빛과 어둠 원소가 등장합니다.</p>'}
      <p class="muted" style="font-size:.9rem;margin-top:.5rem">유리한 상대에게 피해 125%, 불리한 상대에게 85%. 학생 원소와 마법 원소가 같으면 능력치 10% 상승.</p>
      <h3 style="margin-top:1rem">원소 조합</h3>
      <div class="syns" style="font-size:.9rem">${ELK.map(e => `<div>${elChip(e)} 2개: ${SYN[e].n} <span class="muted">${SYN[e].d(2)}, 3개면 ${SYN[e].d(3)}</span></div>`).join('')}
      <div><span class="el" style="color:var(--brass)">조화</span> 세 원소가 모두 다름: 삼원 조화 <span class="muted">주문 재사용 시간 −12%</span></div></div>
    </section>
    <section class="panel" style="margin-bottom:1rem"><h2>전장 지형</h2>
      <p class="muted" style="font-size:.9rem">경기마다 전장이 바뀌고, 밴픽 화면 맨 위에 이번 전장이 나옵니다. 모든 전장은 좌우 대칭이라 어느 쪽에도 유리하지 않습니다.</p>
      <div class="syns" style="font-size:.9rem;margin:.5rem 0">${Object.keys(TER_INFO).map(k => `<div><span class="tchip" style="--tc:${TER_INFO[k].c}">${TER_INFO[k].n}</span> <span class="muted">${TER_INFO[k].d}</span></div>`).join('')}</div>
      <div class="mapgrid">${MAPK.map(id => mapCardHtml(id, true)).join('')}</div></section>
    ${awakeCodexHtml()}<div class="cards">${CHK.map(id => { const c = CH[id], p = patchOf(id); return `<div class="scard" style="border-left:4px solid ${EL[c.e].c}">
      <div class="top"><span class="nm">${c.n}</span>${elChip(c.e)}</div>
      <div class="muted" style="font-size:.85rem">${c.role}, ${roles[c.role]}</div>
      <div class="stats3"><span>체력<b class="num">${R(c.hp*p.hp)}</b></span><span>공격<b class="num">${R(c.atk*p.atk)}</b></span><span>사거리<b class="num">${c.range}</b></span></div>
      <div class="skill"><b>${c.sk}</b> <span class="muted num">${(c.cd*p.cd).toFixed(1)}초</span><br>${c.sd}<div class="reach">${skillReachHtml(id)}</div></div>
    </div>`; }).join('')}</div>`;
}

function studentCard(st, opts = {}){
  const tag = opts.button ? 'button' : 'div';
  return `<${tag} class="scard" style="--ec:${EL[st.elem].c}" ${opts.button ? `data-a="${opts.action}" data-v="${st.id}" aria-pressed="${!!opts.on}"` : ''} ${opts.disabled?'disabled':''}>
    <div class="top"><span class="nm">${esc(st.name)}</span><span class="ovr num">${R(ovr(st))}</span></div>
    <div class="row" style="gap:.4rem"><span class="muted" style="font-size:.85rem">${st.year}학년</span>${elChip(st.elem)}${opts.cost!=null?`<span style="margin-left:auto">${potHtml(st)}</span>`:''}</div>
    <div>${traitChips(st)}</div>
    <div class="stats3"><span>공격<b class="num">${R(st.atk)}</b></span><span>수비<b class="num">${R(st.def)}</b></span><span>판단<b class="num">${R(st.int)}</b></span></div>
    ${opts.cost==null ? `<div style="display:flex;align-items:center;gap:.5rem;font-size:.8rem" class="muted">컨디션 ${condBar(st.cond)}</div>` : ''}
    <div class="fav">주력: ${st.fav.map(f => CH[f].n).join(', ')}</div>
    ${opts.cost!=null ? `<div class="num" style="margin-top:.2rem"><span class="coin"></span>${opts.cost}</div>` : ''}
  </${tag}>`;
}
