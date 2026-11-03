// 처음 보는 기능 안내와 도움말
"use strict";

/* =========================================================
   새 시스템 안내 (처음 등장할 때 한 번)
   ========================================================= */
const TIPS = [
  {k:'goals', t:'이사회 목표', d:'시즌마다 이사회가 목표 세 개를 줍니다. 핵심 목표는 보상이 크지만 못 이루면 명성이 깎입니다. 본관에서 진행 상황을 볼 수 있습니다.', when:() => V.view === 'hub' && !!S.goals},
  {k:'chem', t:'학생 케미', d:'함께 출전할수록 두 학생의 호흡이 좋아져 능력치가 오릅니다. 앙숙 사이는 능력치가 떨어지지만 같이 뛰다 보면 풀립니다. 학생 탭과 밴픽 화면에서 확인하세요.', when:() => !!(S.stats && S.stats.g >= 1) && ['hub','students'].includes(V.view)},
  {k:'morale', t:'학생 사기', d:'벤치에만 있는 학생은 사기가 떨어지고, 주전급 실력일수록 더 빨리 떨어집니다. 사기가 바닥이면 이적을 요청하니 가끔 출전시켜 주세요. 사기는 경기 능력치에도 조금 반영됩니다.', when:() => me().students.some(st => moraleOf(st) < 55) && ['hub','students','train'].includes(V.view)},
  {k:'gear', t:'마법 도구', d:'시설 탭 아래 상점에서 도구를 사서 학생 탭에서 한 명에게 하나씩 장착합니다. 진열은 매주 바뀌고, 마법사 컵 우승이나 사건으로도 얻습니다.', when:() => V.view === 'facility' || ((S.items || []).length > 0 && V.view === 'students')},
  {k:'cup', t:'마법사 컵', d:'3주차가 끝나면 리그 상위 세 학교와 단판 토너먼트를 치릅니다. 우승하면 상금과 희귀 도구를 받습니다. 리그 순위에는 영향이 없지만, 경기마다 훈련과 피로는 똑같이 쌓입니다.', when:() => S.phase === 'cup' && V.view === 'hub'},
  {k:'awaken', t:'각성', d:'능력치가 100을 넘으면 각성해 특별한 힘이 생기고, 125를 넘으면 더 강해집니다. 공격·수비·판단마다 효과가 다르고, 마법 도감에서 자세히 볼 수 있습니다.', when:() => me().students.some(st => Math.max(st.atk, st.def, st.int) >= 88) && ['hub','students','train'].includes(V.view)},
  {k:'flow', t:'반격과 견제', d:'두 번 이상 연달아 지면 학생들이 이를 악물어 능력치가 오르고, 네 번 이상 연달아 이기면 상대가 철저히 대비해 강해집니다. 본관 상대 정보 아래에 표시됩니다.', when:() => V.view === 'hub' && (comebackBonus() > 0 || streakPressure() > 0)},
  {k:'division', t:'승격과 강등', d:'2부 리그에서 우승하면 1부로 승격하고, 1부 최하위는 2부로 강등됩니다. 1부는 상대가 강한 대신 상금과 명성이 1.5배입니다.', when:() => (S.phase === 'season_end' && V.view === 'hub') || V.view === 'league'},
  {k:'market', t:'이적 시장', d:'시즌 사이에는 다른 학교 학생을 이적료를 내고 데려올 수 있습니다. 전학생은 1시즌 계약이고 경기마다 수당을 받습니다. 우리 학생을 다른 학교로 보내 이적료를 받을 수도 있습니다.', when:() => V.view === 'recruit'},
  {k:'terrain', t:'전장 지형', d:'경기마다 전장이 바뀝니다. 밴픽 화면 위쪽 지도에서 용암·샘·바람길·돌기둥 위치를 보고 마법을 골라 보세요. 마법마다 주문 사거리도 다르니 함께 확인하세요. 자세한 효과는 마법 도감에 있습니다.', when:() => V.view === 'hub' || V.view === 'codex'},
  {k:'backup', t:'저장 백업', d:'진행 상황은 이 브라우저에만 저장됩니다. 가끔 저장 관리 탭에서 저장 코드를 만들어 보관해 두세요.', when:() => S.season >= 2 && V.view === 'hub'},
];
function tipHtml(){
  if (!S || ['start','battle','draft'].includes(V.view) || tutorialStep()) return '';
  S.tips = S.tips || {};
  if (S.tips._off) return '';
  const tip = TIPS.find(x => !S.tips[x.k] && x.when());
  if (!tip) return '';
  return `<section class="panel tip" aria-label="안내">
    <div class="spread"><h3 style="margin:0">처음 보는 기능 · ${tip.t}</h3>
      <div class="row"><button class="btn small" data-a="tipOk" data-v="${tip.k}">알겠어요</button><button class="btn ghost small" data-a="tipsOff">안내 끄기</button></div></div>
    <p class="muted" style="margin-top:.45rem">${tip.d}</p>
    <button class="linkish" data-a="go" data-v="help">도움말에서 모두 보기</button>
  </section>`;
}

/* =========================================================
   도움말
   ========================================================= */
// 도움말: 분류를 탭으로 나누고, 주제는 제목과 한 줄 요약만 보이다가 누르면 펼쳐집니다.
const HELP_STEPS = [
  ['사건', '본관에 사건이 있으면 먼저 고릅니다.'],
  ['훈련', '훈련 탭에서 고르고 <b>선택 완료</b>.'],
  ['밴픽', '<b>경기 준비</b>로 마법과 학생을 고릅니다.'],
  ['경기', '지켜보며 작전을 쓰고 결과를 확인합니다.'],
];
const HELP_CATS = [
  {id:'flow', n:'기본 흐름', seal:'季', items:[
    {t:'시즌 흐름', sum:'리그 5주 → 컵 → 결승으로 한 시즌이 끝납니다.', pts:[
      '매주 한 경기, 리그의 모든 학교와 한 번씩 만납니다.',
      '3주차 뒤 상위 세 학교와 <b>마법사 컵</b>(단판 토너먼트).',
      '리그 상위 2팀이 <b>3판 2선승 결승</b>을 치릅니다.',
      '시즌이 끝나면 4학년 졸업 → 신입생·이적 시장.']},
    {t:'난이도', sum:'상대가 얼마나 강하고 빨리 크는지가 달라집니다.', pts:[
      '<b>쉬움</b>: 상대가 약하고 시작 골드가 많습니다.',
      '<b>어려움</b>: 상대가 강하고, 우승할수록 견제가 심합니다.',
      '시즌 사이 모집 화면에서 바꿀 수 있습니다.']},
    {t:'저장과 백업', sum:'이 브라우저에 자동 저장됩니다.', pts:[
      '<b>저장 관리</b>에서 코드나 파일로 백업합니다.',
      '브라우저 기록을 지우면 저장도 사라지니 가끔 백업하세요.']},
  ]},
  {id:'match', n:'경기', seal:'戰', items:[
    {t:'밴픽과 출전', sum:'마법을 고를 때 맡을 학생도 함께 정합니다.', pts:[
      '하나씩 금지한 뒤 번갈아 고르고, 고른 셋이 출전합니다.',
      '학생 원소 = 마법 원소면 강해지고, <b>주력 마법</b>이면 더 강합니다.',
      '<b>코치 조언</b>이 추천 마법과 이유를 알려 줍니다.',
      '밴픽 뒤 위·중앙·아래 자리를 바꿀 수 있습니다.']},
    {t:'원소 상성과 조합', sum:'유리하면 피해 125%, 불리하면 85%.', pts:[
      '불 → 바람 → 땅 → 물 → 불 순서로 이깁니다.',
      '시즌 2부터 서로 강한 <b>빛·어둠</b>, 시즌 4부터 새 마법 4종.',
      '같은 원소 둘 이상, 또는 세 원소가 다 다르면 <b>조합 효과</b>.']},
    {t:'전투와 작전', sum:'60초 자동 전투, 처치가 많은 쪽이 이깁니다.', pts:[
      '경기마다 <b>작전</b> 두 번(집중 공격·수호 진형·재정비·주문 폭발).',
      '<b>자동 작전</b>을 켜면 알아서 지시합니다.',
      '배속(0.5~8배), 일시정지, 건너뛰기를 쓸 수 있습니다.',
      '동점이면 연장전, 그래도 같으면 총 피해량으로 가립니다.']},
    {t:'주문 사거리', sum:'마법마다 주문이 닿는 거리가 다릅니다.', pts:[
      '대상이 사거리 밖이면 주문을 아껴 둡니다. 치유도 마찬가지.',
      '밴픽·마법 도감에 숫자와 막대로 나옵니다.',
      '전투에서 주문을 쓰면 사거리가 점선 원으로 보입니다.']},
    {t:'전장 지형', sum:'경기마다 전장이 바뀌고, 좌우는 항상 대칭입니다.', pts:[
      '<b>용암</b> 체력 감소 · <b>샘</b> 회복 · <b>마력진</b> 주문 자주 · <b>바람길</b> 빨라짐.',
      '<b>돌기둥</b>은 돌아가야 하지만 주문과 공격은 통과합니다.',
      '밴픽 화면 맨 위 지도를 보고 마법을 고르세요.']},
  ]},
  {id:'strategy', n:'전략과 준비', seal:'策', items:[
    {t:'팀 전술', sum:'압박·아군 보호·거리 유지가 목표와 움직임을 바꿉니다.', pts:[
      '<b>압박</b>: 적 후열과 치유 담당을 먼저 노립니다.',
      '<b>아군 보호</b>: 파고든 적을 전열이 끊고, 곁의 후열은 피해 −10%.',
      '<b>거리 유지</b>: 원거리 학생이 공격 사이에 물러납니다.',
      '경기 중 작전과 도발이 전술보다 우선합니다.']},
    {t:'출전 조합 저장', sum:'완성한 밴픽을 세 칸에 저장해 두고 다시 씁니다.', pts:[
      '밴픽이 끝나면 학생·마법·배치·전술을 저장합니다.',
      '불러오면 내 차례마다 다음 선택을 제안합니다.',
      '금지되거나 뺏긴 마법, 졸업한 학생은 직접 바꿔야 합니다.']},
    {t:'연습 경기', sum:'같은 상대·전장에서 전술과 배치를 비교합니다.', pts:[
      '조합을 저장한 뒤 메뉴의 <b>연습 경기</b>로 갑니다.',
      '골드·성장·피로·기록에는 영향이 없습니다.',
      '최근 6번의 점수와 피해를 나란히 비교합니다.']},
    {t:'결승 시리즈 대응', sum:'2차전부터 상대가 지난 경기를 보고 대응합니다.', pts:[
      '본관·밴픽의 결승 분석에서 상대의 다음 금지와 전술을 확인하세요.',
      '능력치 보너스는 없고, 밴픽과 전술만 바뀝니다.']},
    {t:'결정적 장면', sum:'첫 처치·역전·연속 처치·위기 회복을 모아 보여 줍니다.', pts:[
      '경기 뒤 결과 화면에서 최대 세 장면을 봅니다.',
      '체력 15% 이하에서 8초 안에 35%로 살아나면 위기 회복.']},
  ]},
  {id:'student', n:'학생', seal:'生', items:[
    {t:'훈련과 컨디션', sum:'고른 훈련은 다음 경기가 끝난 뒤 진행됩니다.', pts:[
      '공격·수비·판단 중 하나를 키우거나 <b>휴식</b>으로 회복합니다.',
      '고르지 않은 학생은 지난 계획대로 훈련합니다.',
      '컨디션이 낮을수록 경기에서 약해집니다.',
      '저학년, 잠재력(★)이 높을수록 빨리 큽니다.']},
    {t:'능력치와 각성', sum:'최대 150, 100을 넘으면 각성합니다.', pts:[
      '공격 100 <b>파괴자</b> · 수비 100 <b>철벽</b> · 판단 100 <b>대마법사</b>.',
      '125를 넘으면 각성 효과가 한 단계 강해집니다.',
      '100을 넘으면 성장이 느려집니다.']},
    {t:'성장 전문화', sum:'숙련 Lv2가 되면 성장 방향 하나를 고릅니다.', pts:[
      '학생 화면에서 후보를 고르고 효과를 확인한 뒤 ‘이 전문화로 확정’을 누릅니다. 확정 전에는 취소·변경할 수 있고, 확정 후에는 고정됩니다.',
      '공격·방어·지원 계열마다 장점과 단점이 있습니다.']},
    {t:'사기', sum:'출전하면 오르고, 벤치에 있으면 떨어집니다.', pts:[
      '실력 좋은 학생일수록 벤치에서 빨리 떨어집니다.',
      '바닥나면 <b>이적 요청</b>이 옵니다.']},
    {t:'케미와 협동기', sum:'함께 뛸수록 사이가 좋아지고 능력치가 오릅니다.', pts:[
      '호흡 → 단짝 → 환상의 짝. <b>앙숙</b>은 같이 뛰면 풀립니다.',
      '호흡 15 이상인 한 쌍은 경기당 한 번 <b>협동기</b>를 씁니다.',
      '치유·수호가 있으면 보호막, 아니면 기절한 적에게 추가 공격.']},
    {t:'학생 이야기', sum:'본관에서 한 약속이 다음 경기 명단과 이어집니다.', pts:[
      '약속을 지키면 사기와 관계가 좋아지고, 어기면 나빠집니다.',
      '결과는 졸업식과 명예의 전당에 남습니다.']},
    {t:'이적 시장', sum:'시즌 사이에 다른 학교 학생을 데려오거나 보냅니다.', pts:[
      '모집 화면의 <b>이적 시장</b> 탭에서 이적료를 냅니다.',
      '전학생은 1시즌 계약이고 경기마다 수당을 받습니다.',
      '보낸 학생은 상대 학교에서 뜁니다.']},
  ]},
  {id:'school', n:'학교 운영', seal:'設', items:[
    {t:'시즌 운영 방침', sum:'첫 경기 전에 본관에서 하나를 고릅니다.', pts:[
      '<b>신입생 육성</b>: 1·2학년 성장 +20%, 3·4학년 −10%.',
      '<b>마법 연구</b>: 숙련도 +20%, 훈련 컨디션 소모 +2.',
      '<b>우승 집중</b>: 경기 후 컨디션 +3, 성장 −15%.']},
    {t:'시설과 투자', sum:'시설을 올리면 학생이 빨리 크고 회복합니다.', pts:[
      '<b>훈련장</b> 공격·수비 · <b>도서관</b> 판단·숙련 · <b>기숙사</b> 회복.',
      '<b>스카우트 사무소</b>: 신입생 수와 수준.',
      '다 올리면 전지훈련·코치·장학금에 골드를 씁니다.']},
    {t:'졸업생 멘토', sum:'졸업생 코치가 후계자 한 명에게 마법을 전수합니다.', pts:[
      '시설에서 코치를 고용하고 후계자를 지정합니다.',
      '후계자는 경기마다 숙련도 +6 (시즌 최대 60).']},
    {t:'마법 도구', sum:'학생 한 명에게 도구 하나를 장착합니다.', pts:[
      '시설 탭 <b>상점</b>에서 사고 학생 탭에서 장착합니다.',
      '팔면 절반 값을 돌려받습니다.',
      '컵 우승 시 도구 세 개 중 하나를 고릅니다.']},
  ]},
  {id:'league', n:'리그와 목표', seal:'譽', items:[
    {t:'승격과 강등', sum:'2부 우승 → 1부 승격, 1부 꼴찌 → 2부 강등.', pts:[
      '새 게임은 <b>2부</b>에서 시작합니다.',
      '1부는 상대가 강한 대신 상금·명성 <b>1.5배</b>.']},
    {t:'이사회 목표', sum:'시즌마다 핵심 목표 하나와 보조 목표 둘.', pts:[
      '달성하면 골드와 명성을 받습니다.',
      '<b>핵심 목표</b>를 놓치면 명성이 깎입니다.']},
    {t:'반격과 견제', sum:'한쪽이 너무 오래 이기거나 지지 않게 잡아 줍니다.', pts:[
      '2연패 이상: <b>반격의 의지</b>로 우리가 강해집니다.',
      '4연승 이상: <b>연승 견제</b>로 상대가 강해집니다.',
      '하위권으로 끝나면 지원금과 좋은 신입생 후보.']},
  ]},
];
const helpText = html => html.replace(/<[^>]+>/g, '');
const helpCat = () => HELP_CATS.some(c => c.id === V.helpCat) ? V.helpCat : HELP_CATS[0].id;
function viewHelp(){
  const cur = helpCat(), total = HELP_CATS.reduce((n, c) => n + c.items.length, 0);
  return `<div class="help-head">
      <div><h2 style="margin:0">도움말</h2><p class="muted">분류를 고르고 궁금한 주제를 누르면 자세히 펼쳐집니다.</p></div>
      <button class="btn ghost small" data-a="tipsReset">처음 보는 기능 안내 다시 켜기</button>
    </div>
    <label class="help-search"><span class="sr">도움말 검색</span><input id="helpSearch" type="search" value="${esc(V.helpQuery || '')}" placeholder="주제 ${total}개에서 찾기 (예: 사기, 승격, 각성)" autocomplete="off"></label>
    <div class="help-toc" role="tablist" aria-label="도움말 분류">${HELP_CATS.map(c => `<button role="tab" data-a="helpJump" data-v="${c.id}" aria-selected="${c.id === cur}"><span class="seal" aria-hidden="true">${c.seal}</span>${c.n}<span class="cnt">${c.items.length}</span></button>`).join('')}</div>
    ${HELP_CATS.map(c => `<section class="help-cat" id="help-${c.id}" ${c.id === cur ? '' : 'hidden'}>
      <h3 class="help-cat-h"><span class="seal" aria-hidden="true">${c.seal}</span>${c.n}</h3>
      ${c.id === 'flow' ? `<ol class="help-steps" aria-label="매주 할 일">${HELP_STEPS.map(([k, x], i) => `<li><span class="num">${i + 1}</span><b class="hs-k">${k}</b><span>${x}</span></li>`).join('')}</ol>` : ''}
      <div class="help-items">${c.items.map(it => `<details class="help-item" data-text="${esc(helpText(it.t + ' ' + it.sum + ' ' + it.pts.join(' ')))}">
        <summary><span class="hi-t">${it.t}</span><span class="hi-sum">${it.sum}</span></summary>
        <ul>${it.pts.map(x => `<li>${x}</li>`).join('')}</ul>
      </details>`).join('')}</div>
    </section>`).join('')}
    <p class="help-empty muted" hidden>찾는 내용이 없습니다. 다른 말로 찾아보세요.</p>`;
}
// 검색: 다시 그리지 않고 보이기만 바꿔서 입력 칸의 포커스를 유지.
// 찾는 말이 있으면 모든 분류에서 맞는 주제를 펼쳐 보여 주고, 지우면 고른 분류로 돌아갑니다.
function filterHelp(q){
  V.helpQuery = q;
  const words = q.trim().split(/\s+/).filter(Boolean), cur = helpCat();
  let shown = 0;
  document.querySelectorAll('.help-cat').forEach(cat => {
    let n = 0;
    cat.querySelectorAll('.help-item').forEach(it => {
      const ok = words.every(w => it.dataset.text.includes(w));
      it.hidden = !ok; if (ok) n++;
      it.open = words.length > 0 && ok;
    });
    cat.hidden = words.length ? !n : cat.id !== 'help-' + cur;
    if (!cat.hidden) shown += n;
  });
  document.querySelectorAll('.help-steps').forEach(el => el.hidden = words.length > 0);
  document.querySelectorAll('.help-toc button').forEach(b => b.classList.toggle('dim', words.length > 0));
  const empty = document.querySelector('.help-empty'); if (empty) empty.hidden = shown > 0;
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'helpSearch') filterHelp(e.target.value); });
