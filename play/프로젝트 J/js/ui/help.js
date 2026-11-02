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
// 도움말: 분류별 주제, 주제마다 한 줄 요약 + 짧은 항목
const HELP_STEPS = [
  '본관에서 이번 주 사건이 있으면 먼저 고릅니다.',
  '훈련 탭에서 학생마다 훈련을 고르고 <b>선택 완료</b>를 누릅니다.',
  '본관의 <b>경기 준비</b>를 눌러 마법을 금지하고 고릅니다. 고를 때 맡을 학생도 정합니다.',
  '대항전을 지켜보며 필요하면 작전을 지시합니다. 결과를 보고 다음 주로 넘어갑니다.',
];
const HELP_CATS = [
  {id:'flow', n:'기본 흐름', seal:'季', items:[
    {t:'시즌 흐름', sum:'정규 리그 5주, 중간의 마법사 컵, 마지막 결승으로 한 시즌이 끝납니다.', pts:[
      '매주 한 경기씩, 같은 리그의 모든 학교와 한 번씩 맞붙습니다.',
      '3주차가 끝나면 리그 상위 세 학교와 <b>마법사 컵</b>(단판 토너먼트)을 치릅니다.',
      '정규 리그 상위 2팀이 <b>3판 2선승제 결승</b>으로 우승을 가립니다.',
      '시즌이 끝나면 4학년이 졸업하고, 신입생 모집과 이적 시장을 거쳐 다음 시즌이 시작됩니다.']},
    {t:'난이도', sum:'상대 학교가 얼마나 강하고 빨리 크는지가 달라집니다.', pts:[
      '<b>쉬움</b>: 상대가 약하고 시작 골드가 많습니다.',
      '<b>어려움</b>: 상대가 강하고 빨리 크며, 우승하면 견제가 심해집니다.',
      '시즌 사이 모집 화면에서 언제든 바꿀 수 있습니다.']},
  ]},
  {id:'match', n:'경기', seal:'戰', items:[
    {t:'밴픽과 출전', sum:'마법을 금지하고 고르면서, 그 마법을 맡을 학생도 함께 정합니다.', pts:[
      '서로 하나씩 금지한 뒤 번갈아 고르고, 고른 셋이 그대로 출전합니다.',
      '학생 원소와 마법 원소가 같으면 강해지고, <b>주력 마법</b>이면 더 강해집니다.',
      '<b>코치 조언</b>이 금지하거나 고를 마법과 그 이유를 알려 줍니다.',
      '밴픽이 끝나면 학생의 자리(위·중앙·아래)를 바꿀 수 있습니다.']},
    {t:'원소와 조합', sum:'상성이 유리하면 피해가 125%, 불리하면 85%입니다.', pts:[
      '불 → 바람 → 땅 → 물 → 불 순서로 이깁니다.',
      '시즌 2부터 서로에게 강한 <b>빛</b>과 <b>어둠</b>이 추가됩니다.',
      '같은 원소 둘 이상, 또는 세 원소가 모두 다르면 <b>조합 효과</b>가 켜집니다.',
      '시즌 4부터 새 마법 4종이 더 등장합니다.']},
    {t:'전투와 작전', sum:'60초 동안 자동으로 싸우고, 처치가 많은 쪽이 이깁니다.', pts:[
      '경기마다 <b>작전</b>을 두 번 지시할 수 있습니다(집중 공격, 수호 진형, 재정비, 주문 폭발).',
      '<b>자동 작전</b>을 켜 두면 알아서 지시합니다.',
      '배속(0.5~8배)과 일시정지, 결과까지 건너뛰기를 쓸 수 있습니다.',
      '60초에 동점이면 연장전, 연장전도 동점이면 총 피해량으로 가립니다.']},
    {t:'주문 사거리', sum:'마법마다 주문이 닿는 거리가 따로 있습니다.', pts:[
      '<b>공격 사거리</b>는 기본 공격, <b>주문 사거리</b>는 주문이 닿는 거리입니다.',
      '대상이 주문 사거리 밖에 있으면 주문을 아껴 둡니다. 치유 주문도 사거리 안의 아군만 돌봅니다.',
      '자기 주변형 주문은 시전자 둘레의 적에게만 닿습니다.',
      '밴픽 화면과 마법 도감에서 숫자와 막대로 볼 수 있고, 전투 중 주문을 쓰면 사거리가 점선 원으로 잠깐 보입니다.']},
    {t:'전장 지형', sum:'경기마다 전장이 바뀌고, 지형마다 효과가 다릅니다.', pts:[
      '밴픽 화면 맨 위에 이번 전장과 작은 지도가 나옵니다. 전장을 보고 마법을 고르세요.',
      '<b>용암</b>은 체력을 깎고(쓰러뜨리지는 않음), <b>치유의 샘</b>은 회복, <b>마력진</b>은 주문을 더 자주 쓰게 하고, <b>바람길</b>은 빨라지게 합니다.',
      '<b>돌기둥</b>은 지나갈 수 없어 돌아가야 합니다. 주문과 공격은 막지 않습니다.',
      '모든 전장은 좌우 대칭이라 어느 진영에도 유리하지 않습니다. 전장 목록은 마법 도감에 있습니다.']},
  ]},
  {id:'student', n:'학생', seal:'生', items:[
    {t:'훈련과 컨디션', sum:'고른 훈련은 다음 경기가 끝난 뒤 진행됩니다.', pts:[
      '공격·수비·판단 중 하나를 키우거나, <b>휴식</b>으로 컨디션을 크게 회복합니다.',
      '이번 주에 고르지 않은 학생은 지난 계획대로 훈련합니다.',
      '출전하거나 훈련하면 컨디션이 떨어지고, 낮을수록 경기에서 약해집니다.',
      '저학년과 잠재력(★)이 높은 학생이 빨리 자랍니다.']},
    {t:'능력치와 각성', sum:'능력치는 최대 150이고, 100을 넘으면 각성합니다.', pts:[
      '100을 넘으면 성장이 느려지고, 125를 넘으면 더 느려집니다.',
      '공격 100은 <b>파괴자</b>, 수비 100은 <b>철벽</b>, 판단 100은 <b>대마법사</b>로 각성합니다.',
      '125를 넘으면 각성 효과가 한 단계 강해집니다. 자세한 효과는 마법 도감에 있습니다.']},
    {t:'사기', sum:'출전하면 오르고, 벤치에 있으면 떨어집니다.', pts:[
      '실력 좋은 학생일수록 벤치에서 사기가 빨리 떨어집니다.',
      '사기가 바닥이면 <b>이적 요청</b> 사건이 생깁니다.',
      '사기는 경기 능력치에 조금 반영됩니다.']},
    {t:'케미', sum:'함께 출전할수록 두 학생의 사이가 좋아져 능력치가 오릅니다.', pts:[
      '호흡 → 단짝 → 환상의 짝 순으로 좋아집니다.',
      '<b>앙숙</b>은 능력치가 떨어지지만 같이 뛰다 보면 풀립니다.',
      '학생 탭과 밴픽 화면에서 확인할 수 있습니다.']},
    {t:'이적 시장과 계약', sum:'시즌 사이에 다른 학교 학생을 데려오거나 우리 학생을 보냅니다.', pts:[
      '모집 화면의 <b>이적 시장</b> 탭에서 이적료를 내고 데려옵니다.',
      '전학생은 1시즌 계약이고, 경기마다 수당을 받습니다.',
      '재계약하지 않으면 시즌이 시작될 때 원래 학교로 돌아갑니다.',
      '우리 학생을 보내면 이적료를 받지만, 그 학생은 상대 학교에서 뜁니다.']},
  ]},
  {id:'school', n:'학교 운영', seal:'設', items:[
    {t:'시설과 투자', sum:'골드로 시설을 올리면 학생이 더 빨리 크고 회복합니다.', pts:[
      '<b>훈련장</b>: 공격·수비 성장, <b>도서관</b>: 판단 성장과 숙련도.',
      '<b>기숙사</b>: 회복, <b>스카우트 사무소</b>: 신입생 수와 수준.',
      '시설을 다 올린 뒤에는 전지훈련, 졸업생 코치, 장학금에 골드를 씁니다.']},
    {t:'마법 도구', sum:'학생 한 명에게 도구 하나를 맡겨 능력치를 올립니다.', pts:[
      '시설 탭 아래 <b>상점</b>에서 사고, 학생 탭에서 장착합니다.',
      '진열은 매주 바뀌고, 마법사 컵 우승이나 사건으로도 얻습니다.',
      '팔면 산 값의 절반을 돌려받습니다.']},
  ]},
  {id:'league', n:'리그와 목표', seal:'譽', items:[
    {t:'승격과 강등', sum:'2부 우승팀은 1부로 올라가고, 1부 최하위는 2부로 내려갑니다.', pts:[
      '새 게임은 <b>2부 리그</b>에서 시작합니다.',
      '1부는 상대가 훨씬 강한 대신 시즌 상금과 명성이 <b>1.5배</b>입니다.',
      '리그 순위 탭에서 다른 리그의 순위도 볼 수 있습니다.']},
    {t:'이사회 목표', sum:'시즌마다 핵심 목표 하나와 보조 목표 둘이 주어집니다.', pts:[
      '달성하면 골드와 명성을 받습니다.',
      '<b>핵심 목표</b>를 놓치면 명성이 깎입니다.',
      '본관에서 진행 상황을 확인할 수 있습니다.']},
    {t:'반격과 견제', sum:'한쪽이 너무 오래 이기거나 지지 않도록 균형을 잡아 줍니다.', pts:[
      '두 번 이상 연달아 지면 <b>반격의 의지</b>로 우리 능력치가 오릅니다.',
      '네 번 이상 연달아 이기면 <b>연승 견제</b>로 상대가 강해집니다.',
      '최근 3시즌에 여러 번 우승하면 상대 학교들이 집중 분석합니다.',
      '하위권으로 시즌을 마치면 재건 지원금과 더 좋은 신입생 후보를 받습니다.']},
  ]},
  {id:'save', n:'저장', seal:'藏', items:[
    {t:'저장과 백업', sum:'진행 상황은 이 브라우저에 자동 저장됩니다.', pts:[
      '<b>저장 관리</b> 탭에서 저장 코드나 파일로 백업할 수 있습니다.',
      '다른 기기나 브라우저에서 그 코드나 파일로 불러옵니다.',
      '브라우저 기록을 지우면 저장도 지워지니, 가끔 백업해 두세요.']},
  ]},
];
const helpText = html => html.replace(/<[^>]+>/g, '');
function viewHelp(){
  const total = HELP_CATS.reduce((n, c) => n + c.items.length, 0);
  return `<div class="help-head">
      <div><h2 style="margin:0">도움말</h2><p class="muted">주제 ${total}개를 분류별로 모았습니다. 찾는 말을 입력하면 해당 주제만 남습니다.</p></div>
      <button class="btn ghost small" data-a="tipsReset">처음 보는 기능 안내 다시 켜기</button>
    </div>
    <label class="help-search"><span class="sr">도움말 검색</span><input id="helpSearch" type="search" placeholder="예: 사기, 승격, 각성" autocomplete="off"></label>
    <div class="help-toc" role="group" aria-label="분류로 이동">${HELP_CATS.map(c => `<button data-a="helpJump" data-v="${c.id}"><span class="seal" aria-hidden="true">${c.seal}</span>${c.n}</button>`).join('')}</div>
    <section class="panel help-steps"><h3>매주 할 일</h3><ol>${HELP_STEPS.map(x => `<li>${x}</li>`).join('')}</ol></section>
    ${HELP_CATS.map(c => `<section class="help-cat" id="help-${c.id}">
      <h3 class="help-cat-h"><span class="seal" aria-hidden="true">${c.seal}</span>${c.n}</h3>
      <div class="help-items">${c.items.map(it => `<article class="help-item" data-text="${esc((it.t + ' ' + it.sum + ' ' + it.pts.join(' ')).replace(/<[^>]+>/g, ''))}">
        <h4>${it.t}</h4><p class="help-sum">${it.sum}</p><ul>${it.pts.map(x => `<li>${x}</li>`).join('')}</ul>
      </article>`).join('')}</div>
    </section>`).join('')}
    <p class="help-empty muted" hidden>찾는 내용이 없습니다. 다른 말로 찾아보세요.</p>`;
}
// 검색: 다시 그리지 않고 보이기만 바꿔서 입력 칸의 포커스를 유지
function filterHelp(q){
  const words = q.trim().split(/\s+/).filter(Boolean);
  let shown = 0;
  document.querySelectorAll('.help-cat').forEach(cat => {
    let n = 0;
    cat.querySelectorAll('.help-item').forEach(it => { const ok = words.every(w => it.dataset.text.includes(w)); it.hidden = !ok; if (ok) n++; });
    cat.hidden = !n; shown += n;
  });
  const steps = document.querySelector('.help-steps'); if (steps) steps.hidden = words.length > 0;
  const empty = document.querySelector('.help-empty'); if (empty) empty.hidden = shown > 0;
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'helpSearch') filterHelp(e.target.value); });
