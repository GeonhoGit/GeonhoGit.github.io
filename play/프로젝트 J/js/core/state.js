// 게임 상태, 새 게임, 저장·불러오기, 일정, 시즌 패치
"use strict";

/* =========================================================
   상태
   ========================================================= */
const AI_SCHOOLS = [
  {name:'붉은탑 학원', elem:'fire', lvl:45},
  {name:'청람 아카데미', elem:'water', lvl:43},
  {name:'바람개비 학당', elem:'wind', lvl:41},
  {name:'흑요석 마법원', elem:'earth', lvl:44},
  {name:'별빛 학원', elem:null, lvl:39},
];
let S = null;          // 저장되는 게임 상태
let V = {view:'start', startElem:'water'}; // 화면 상태(저장 안 함)
let D = null;          // 드래프트 상태
let B = null;          // 전투 상태
const SAVE_KEY = 'magic-league-v1';

function newGame(name, elem, dif = 'normal'){
  S = null; applyExpansion();  // 새 게임은 기본 4원소로 시작
  const schools = [{id:0, name, elem, player:true, students:[], coach:null, lvl:44}];
  [1,2,2,3,4].forEach((y,i) => schools[0].students.push(genStudent(y, i < 2 ? elem : null, 42)));
  AI_SCHOOLS.forEach((a,i) => {
    const sc = {id:i+1, name:a.name, elem:a.elem, player:false, students:[], coach:null, lvl:a.lvl};
    [1,1,2,3,4].forEach(y => sc.students.push(genStudent(y, a.elem, a.lvl)));
    schools.push(sc);
  });
  S = { season:1, week:0, gold:300, fame:0, trophies:0, schools, patch:{}, patchNotes:[], news:[], results:[], phase:'hub', lastGrads:[], prospects:[], history:[], fac:{gym:0, library:0, dorm:0, scout:0} };
  S.tutorial = {event:false, train:false, draft:false, tactic:false, dismissed:false};
  S.diff = DIFF[dif] ? dif : 'normal'; S.gold = diff().gold; S.chem = {}; S.items = []; initChem(schools[0]);
  S.div = 2; S.other = genOtherDiv(S, 0); S.stats = null; schools[0].students.forEach(st => st.morale = 70); makeGoals();
  newSeasonTable();
  addNews(`${name}의 첫 시즌이 시작됐습니다. 학생 셋을 골라 대항전에 내보내세요.`);
  save();
}
function newSeasonTable(){
  S.schools.forEach(s => { s.w = 0; s.l = 0; s.kd = 0; });
  // 원형 리그 일정
  const n = S.schools.length, t = shuffle([...Array(n).keys()]), rounds = [];
  for (let r=0; r<n-1; r++){
    const pairs = [];
    for (let i=0;i<n/2;i++) pairs.push([t[i], t[n-1-i]]);
    rounds.push(pairs);
    t.splice(1, 0, t.pop());
  }
  S.schedule = rounds; S.results = rounds.map(() => []);
}
function addNews(msg){ S.news.unshift({s:S.season, w:S.week+1, msg}); S.news = S.news.slice(0, 30); }
let saveFailed = false;
function saveWarning(failed, message){
  saveFailed = failed;
  const warning = document.getElementById('save-warning');
  warning.hidden = !failed;
  warning.textContent = failed ? (message || '저장에 실패했습니다. 브라우저 저장 설정을 확인해 주세요. 이 페이지를 닫으면 저장되지 않은 진행 상황이 사라집니다.') : '';
}
function save(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); saveWarning(false); return true; } catch(e){ saveWarning(true); return false; } }
function loadSave(){ try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch(e){ saveWarning(true, '저장 데이터를 읽을 수 없습니다. 브라우저 저장 설정과 저장 데이터를 확인해 주세요.'); return null; } }
function clearSave(){ try { localStorage.removeItem(SAVE_KEY); saveWarning(false); return true; } catch(e){ saveWarning(true); return false; } }

const me = () => S.schools[0];
const school = id => S.schools[id];
function patchOf(id){ return S.patch[id] || {hp:1, atk:1, cd:1}; }
function opponentId(){
  if (S.phase === 'cup' && S.cup) return cupOpponent();
  if (S.phase === 'final' && S.final) return S.final.a === 0 ? S.final.b : S.final.a;
  const pair = S.schedule[S.week].find(p => p.includes(0));
  return pair[0] === 0 ? pair[1] : pair[0];
}
const findSt = (sc, id) => sc.students.find(s => s.id === id);

/* =========================================================
   패치
   ========================================================= */
function rollPatch(){
  S.patch = {}; S.patchNotes = [];
  const ids = shuffle([...CHK]).slice(0, 4);
  const statN = {hp:'체력', atk:'공격력', cd:'주문 재사용 시간'};
  ids.forEach((id, i) => {
    const buff = i % 2 === 0 ? Math.random() < .55 : Math.random() < .45;
    const stat = pick(['hp','atk','cd']);
    const amt = ri(10, 16) / 100;
    const p = {hp:1, atk:1, cd:1};
    if (stat === 'cd') p.cd = buff ? 1-amt : 1+amt; else p[stat] = buff ? 1+amt : 1-amt;
    S.patch[id] = p;
    const sign = stat === 'cd' ? (buff ? '−' : '+') : (buff ? '+' : '−');
    S.patchNotes.push({id, buff, text:`${CH[id].n} ${statN[stat]} ${sign}${R(amt*100)}%`});
  });
}
function patchTag(id){
  const n = S.patchNotes.find(p => p.id === id);
  if (!n) return '';
  return n.buff ? '<span class="tag good" title="이번 시즌 상향">▲</span>' : '<span class="tag bad" title="이번 시즌 하향">▼</span>';
}
