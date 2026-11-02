// 주간 랜덤 사건
"use strict";

/* =========================================================
   랜덤 이벤트
   ========================================================= */
const EVENTS = [
  {id:'injury', need:'student', title:'훈련 중 부상', text:s => `${s.name}이(가) 훈련 중에 발목을 다쳤습니다.`,
    a:{label:'치료사 부르기', hint:'골드 −90, 컨디션 회복', run:s => { S.gold -= 90; s.cond = clamp(s.cond + 25, 0, 100); return `${s.name}이(가) 치료를 받고 회복했습니다.`; }, cost:90},
    b:{label:'그냥 쉬게 하기', hint:'컨디션 −30', run:s => { s.cond = clamp(s.cond - 30, 20, 100); return `${s.name}의 컨디션이 크게 떨어졌습니다.`; }}},
  {id:'sponsor', title:'후원 제안', text:() => '마법 지팡이 상회가 광고 촬영을 조건으로 후원을 제안했습니다.',
    a:{label:'후원 받기', hint:'골드 +220, 모든 학생 컨디션 −10', run:() => { S.gold += 220; me().students.forEach(s => s.cond = clamp(s.cond - 10, 20, 100)); return '후원금을 받았지만 촬영으로 학생들이 지쳤습니다.'; }},
    b:{label:'정중히 거절', hint:'명성 +6', run:() => { S.fame += 6; return '학업에 집중하는 학교라는 평판을 얻었습니다.'; }}},
  {id:'taunt', need:'opp', title:'라이벌의 도발', text:o => `${o.name}이(가) 다음 경기 상대인 우리를 "쉬운 상대"라고 도발했습니다.`,
    a:{label:'맞받아치기', hint:'다음 경기 능력치 +6%, 지면 명성 −8', run:o => { S.nextBuff = {v:.06, onLose:-8}; return `학생들의 투지가 불타오릅니다. ${o.name}에게 지면 체면을 구깁니다.`; }},
    b:{label:'무시하기', hint:'효과 없음', run:() => '도발에 대응하지 않았습니다.'}},
  {id:'quarrel', need:'two', title:'학생 간 다툼', text:([x,y]) => `${x.name}과(와) ${y.name}이(가) 연습 방식을 두고 크게 다퉜습니다.`,
    a:{label:'둘을 불러 화해시키기', hint:'두 학생 컨디션 −12, 둘 사이 좋아짐', run:([x,y]) => { addChem(x.id, y.id, 2); [x,y].forEach(s => s.cond = clamp(s.cond - 12, 20, 100)); return '시간은 걸렸지만 둘이 화해했습니다.'; }},
    b:{label:'선배 편들기', hint:'선배 판단 +2, 후배 모든 능력치 −1.5, 둘 사이 나빠짐', run:([x,y]) => { addChem(x.id, y.id, -3); const [hi, lo] = x.year >= y.year ? [x,y] : [y,x]; hi.int = clamp(hi.int + 2, 10, STAT_MAX); ['atk','def','int'].forEach(k => lo[k] = clamp(lo[k] - 1.5, 10, STAT_MAX)); return `${hi.name}은(는) 자신감을 얻었고, ${lo.name}은(는) 의기소침해졌습니다.`; }}},
  {id:'master', title:'원로 마법사의 방문', text:() => '은퇴한 대마법사가 특별 수업을 해주겠다고 합니다.',
    a:{label:'수업료 내기', hint:'골드 −150, 모든 학생 능력치 하나씩 +1.5', run:() => { S.gold -= 150; me().students.forEach(s => { const k = pick(['atk','def','int']); s[k] = clamp(s[k] + 1.5, 10, STAT_MAX); }); return '특별 수업으로 학생들이 한 단계 성장했습니다.'; }, cost:150},
    b:{label:'사양하기', hint:'효과 없음', run:() => '이번에는 사양했습니다.'}},
  {id:'festival', title:'학교 축제', text:() => '학교 축제가 열립니다. 학생들이 들떠 있습니다.',
    a:{label:'축제 즐기기', hint:'골드 −50, 모든 학생 컨디션 +15', run:() => { S.gold -= 50; me().students.forEach(s => s.cond = clamp(s.cond + 15, 0, 100)); return '축제로 학생들이 기운을 되찾았습니다.'; }, cost:50},
    b:{label:'훈련에 집중', hint:'훈련 중인 능력치 +0.8, 컨디션 −5', run:() => { me().students.forEach(s => { if (s.train && s.train !== 'rest') s[s.train] = clamp(s[s.train] + .8, 10, STAT_MAX); s.cond = clamp(s.cond - 5, 20, 100); }); return '축제 대신 훈련에 매진했습니다.'; }}},
  {id:'tome', need:'student', title:'비밀 마법서 발견', text:s => `${s.name}이(가) 도서관 구석에서 오래된 마법서를 찾았습니다.`,
    a:{label:'연구하게 하기', hint:'주력 마법 숙련 경험치 +40', run:s => { const id = s.fav[0]; s.mastery = s.mastery || {}; s.mastery[id] = (s.mastery[id] || 0) + 40; return `${s.name}의 ${CH[id].n} 숙련도가 크게 올랐습니다.`; }},
    b:{label:'수집가에게 팔기', hint:'골드 +160', run:() => { S.gold += 160; return '마법서를 좋은 값에 팔았습니다.'; }}},
  {id:'transfer', need:'transfer', title:'전학 문의', text:t => `다른 학교의 ${t.name}(${t.year}학년, 종합 ${R(ovr(t))})이(가) 우리 학교로 전학 오고 싶어 합니다.`,
    a:{label:'받아들이기', hint:t => `골드 −${t.cost}, 학생 영입`, run:t => { S.gold -= t.cost; delete t.cost; joinTeam(t); return `${t.name}이(가) 전학 왔습니다.`; }, cost:t => t.cost, needRoom:true},
    b:{label:'거절하기', hint:'효과 없음', run:t => `${t.name}의 전학을 거절했습니다.`}},
  {id:'press', title:'마법 신문 인터뷰', text:() => '마법 신문이 이번 시즌 목표를 묻습니다.',
    a:{label:'우승하겠다', hint:'명성 +10, 다음 경기 지면 명성 −10', run:() => { S.fame += 10; S.nextBuff = {v:0, onLose:-10}; return '대담한 인터뷰가 화제가 됐습니다.'; }},
    b:{label:'한 경기씩 최선을', hint:'명성 +3', run:() => { S.fame += 3; return '무난한 인터뷰였습니다.'; }}},
  {id:'informant', title:'정보원의 제안', text:() => '수상한 정보원이 다음 상대의 전술을 팔겠다고 합니다.',
    a:{label:'정보 사기', hint:'골드 −80, 다음 경기 능력치 +4%', run:() => { S.gold -= 80; S.nextBuff = {v:.04, onLose:0}; return '상대의 습관을 미리 파악했습니다.'; }, cost:80},
    b:{label:'돌려보내기', hint:'효과 없음', run:() => '정보원을 돌려보냈습니다.'}},
  {id:'storm', title:'마력 폭풍', text:() => '마력 폭풍이 학교 결계를 흔들었습니다.',
    a:{label:'결계 수리', hint:'골드 −120', run:() => { S.gold -= 120; return '결계를 서둘러 고쳤습니다.'; }, cost:120},
    b:{label:'그대로 두기', hint:'모든 학생 컨디션 −15', run:() => { me().students.forEach(s => s.cond = clamp(s.cond - 15, 20, 100)); return '밤새 결계를 지키느라 학생들이 지쳤습니다.'; }}},
  {id:'alumni', need:'hall', title:'졸업생의 방문', text:n => `졸업생 ${n}이(가) 모교를 찾아왔습니다.`,
    a:{label:'특강 부탁하기', hint:'모든 학생 판단 +1', run:n => { me().students.forEach(s => s.int = clamp(s.int + 1, 10, STAT_MAX)); return `${n}의 특강으로 학생들의 판단력이 늘었습니다.`; }},
    b:{label:'후원 부탁하기', hint:'골드 +150', run:n => { S.gold += 150; return `${n}이(가) 후원금을 내고 갔습니다.`; }}},
  {id:'prodigy', title:'마을의 신동', text:() => '근처 마을에서 마력이 남다른 아이를 발견했습니다. 내년에 입학할 나이입니다.',
    a:{label:'장학 약속하기', hint:'골드 −100, 다음 신입생 모집에 잠재력 5 후보 추가', run:() => { S.gold -= 100; S.promisedProdigy = true; return '아이의 가족과 입학을 약속했습니다. 시즌이 끝나면 지원서가 옵니다.'; }, cost:100},
    b:{label:'지켜보기', hint:'효과 없음', run:() => '이번에는 지켜보기로 했습니다.'}},
  {id:'exam', title:'기말 시험 주간', text:() => '기말 시험이 다가옵니다. 학생들이 밤을 새우고 있습니다.',
    a:{label:'시험에 집중', hint:'모든 학생 판단 +1, 컨디션 −8', run:() => { me().students.forEach(s => { s.int = clamp(s.int + 1, 10, STAT_MAX); s.cond = clamp(s.cond - 8, 20, 100); }); return '시험 공부로 판단력이 늘었지만 다들 피곤합니다.'; }},
    b:{label:'훈련 우선', hint:'명성 −4', run:() => { S.fame = Math.max(0, S.fame - 4); return '성적이 떨어져 평판이 조금 깎였습니다.'; }}},
  {id:'donation', title:'동문 기부', text:() => '동문회가 학교에 기부금을 보내왔습니다.',
    a:{label:'운영비로 쓰기', hint:'골드 +200', run:() => { S.gold += 200; return '기부금을 운영비에 보탰습니다.'; }},
    b:{label:'학생 잔치 열기', hint:'골드 +60, 모든 학생 컨디션 +12', run:() => { S.gold += 60; me().students.forEach(s => s.cond = clamp(s.cond + 12, 0, 100)); return '잔치로 학생들이 기운을 냈습니다.'; }}},
  {id:'spy', need:'opp', title:'첩자 소동', text:o => `${o.name}의 첩자가 우리 훈련장을 엿보다 달아났습니다.`,
    a:{label:'보안 강화', hint:'골드 −100', run:() => { S.gold -= 100; return '훈련장 보안을 강화했습니다.'; }, cost:100},
    b:{label:'그냥 두기', hint:'다음 경기 능력치 −5%', run:o => { S.nextBuff = {v:-.05, onLose:0}; return `${o.name}이(가) 우리 전술을 알아챘을지도 모릅니다.`; }}},
  {id:'slump', need:'student', title:'슬럼프', text:s => `${s.name}이(가) 요즘 마법이 잘 안 된다며 풀이 죽어 있습니다.`,
    a:{label:'상담하기', hint:'골드 −60, 컨디션 +20', run:s => { S.gold -= 60; s.cond = clamp(s.cond + 20, 0, 100); return `${s.name}이(가) 기운을 되찾았습니다.`; }, cost:60},
    b:{label:'스스로 이겨내게 두기', hint:'반반 확률로 판단 +2 또는 공격 −1.5', run:s => { if (Math.random() < .5){ s.int = clamp(s.int + 2, 10, STAT_MAX); return `${s.name}이(가) 스스로 깨달음을 얻었습니다.`; } s.atk = clamp(s.atk - 1.5, 10, STAT_MAX); s.cond = clamp(s.cond - 10, 20, 100); return `${s.name}의 슬럼프가 길어졌습니다.`; }}},
  {id:'peddler', need:'item', title:'떠돌이 도구상', text:k => `떠돌이 도구상이 ${GEAR[k].n}(${GEAR[k].d})을(를) 싸게 넘기겠다고 합니다.`,
    a:{label:'사기', hint:k => `골드 −${R(GEAR[k].cost*.6)}, 마법 도구 획득`, run:k => { S.gold -= R(GEAR[k].cost*.6); addItem(k); return `${GEAR[k].n}을(를) 싸게 샀습니다.`; }, cost:k => R(GEAR[k].cost*.6)},
    b:{label:'지나치기', hint:'효과 없음', run:() => '도구상을 그냥 보냈습니다.'}},
  {id:'wantOut', special:true, need:'student', title:'이적 요청', text:s => `${s.name}이(가) 출전 기회가 없다며 다른 학교로 보내 달라고 합니다. (사기 ${R(moraleOf(s))})`,
    a:{label:'면담하고 출전 약속', hint:'골드 −60, 사기 +35', run:s => { S.gold -= 60; s.morale = clamp(moraleOf(s) + 35, 0, 100); return `${s.name}이(가) 마음을 다잡았습니다. 출전 기회를 주면 사기가 더 오릅니다.`; }, cost:60},
    b:{label:'이적 보내 주기', hint:s => `이적료 +${R(saleFee(s)*.8)}골드, 학생이 떠남`, run:s => { const fee = transferOut(s, .8); return fee ? `${s.name}을(를) 이적료 ${fee}골드에 보냈습니다.` : `${s.name}을(를) 받아 줄 학교가 없었습니다.`; }, needSpare:true}},
];
function rollEvent(){
  if (S.phase === 'hub' && !S.event && wantOutEvent()) return;
  if (S.phase !== 'hub' || Math.random() > .5) return;
  const my = me(), ev = pick(EVENTS.filter(e => !e.special));
  let data = null;
  if (ev.need === 'student') data = pick(my.students);
  if (ev.need === 'two'){ if (my.students.length < 2) return; const [x, y] = shuffle([...my.students]); data = [x, y]; }
  if (ev.need === 'opp') data = school(opponentId());
  if (ev.need === 'hall'){ if (!(S.hall || []).length) return; data = pick(S.hall).name; }
  if (ev.need === 'item'){ if ((S.items || []).length >= ITEM_MAX) return; data = pick(GEARK.filter(k => GEAR[k].r >= 2)); }
  if (ev.need === 'transfer'){
    if (my.students.length >= ROSTER_MAX) return;
    data = genStudent(ri(2, 3), null, R(clamp(40 + S.fame/14, 40, 58)));
    data.cost = R(ovr(data)*3.2 + data.pot*30);
  }
  S.event = {id:ev.id, data:ev.need === 'student' || ev.need === 'two' ? (Array.isArray(data) ? data.map(s => s.id) : data.id) : ev.need === 'opp' ? data.id : data};
}
function eventData(ev){
  const raw = S.event.data, my = me();
  if (!ev.need) return {};
  if (ev.need === 'student') return findSt(my, raw);
  if (ev.need === 'two') return raw.map(id => findSt(my, id));
  if (ev.need === 'opp') return school(raw);
  return raw;
}
function eventHtml(){
  if (!S.event) return '';
  const ev = EVENTS.find(e => e.id === S.event.id), d = eventData(ev);
  if (!ev || d == null || (Array.isArray(d) && d.some(x => !x))){ S.event = null; return ''; }  // 대상 학생이 사라진 경우
  const opt = (o, k) => {
    const cost = typeof o.cost === 'function' ? o.cost(d) : (o.cost || 0);
    const off = S.gold < cost || (o.needRoom && me().students.length >= ROSTER_MAX) || (o.needSpare && me().students.length <= 3);
    return `<button class="btn ${k === 'a' ? '' : 'ghost'} ev-btn" data-a="eventChoose" data-v="${k}" ${off ? 'disabled' : ''}><b>${o.label}</b><small>${typeof o.hint === 'function' ? o.hint(d) : o.hint}${off ? (o.needSpare && me().students.length <= 3 ? ' (학생이 3명뿐)' : ' (골드 부족)') : ''}</small></button>`;
  };
  return `<section class="panel event" aria-live="polite">
    <p class="muted" style="font-size:.85rem">이번 주 사건</p>
    <h3 style="margin:.1rem 0 .3rem">${ev.title}</h3>
    <p>${esc(ev.text(d))}</p>
    <div class="row" style="margin-top:.6rem">${opt(ev.a, 'a')}${opt(ev.b, 'b')}</div>
  </section>`;
}
function chooseEvent(k){
  if (!S.event) return;
  const ev = EVENTS.find(e => e.id === S.event.id), d = eventData(ev), o = ev[k];
  const cost = typeof o.cost === 'function' ? o.cost(d) : (o.cost || 0);
  if (S.gold < cost || (o.needRoom && me().students.length >= ROSTER_MAX) || (o.needSpare && me().students.length <= 3)) return;
  const msg = o.run(d);
  markTutorial('event');
  addNews(`${ev.title}: ${msg}`);
  S.event = null; save();
}
// 도발·인터뷰 후 다음 경기 결과 반영
function settleNextBuff(iw){
  const nb = S.nextBuff; if (!nb) return;
  if (!iw && nb.onLose){ S.fame = Math.max(0, S.fame + nb.onLose); addNews(`큰소리친 뒤 져서 명성이 ${-nb.onLose} 떨어졌습니다.`); }
  S.nextBuff = null;
}
