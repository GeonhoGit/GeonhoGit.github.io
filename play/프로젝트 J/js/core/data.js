// 데이터 상수, 원소·마법 정의, 공용 유틸, 학생 생성
"use strict";

/* =========================================================
   데이터
   ========================================================= */
const W = 760, H = 400, MATCH_SEC = 60, WEEKS = 5, ROSTER_MAX = 6;
const STAT_MAX = 150;  // 능력치 상한 (100을 넘으면 성장이 느려짐)
const overGrow = v => v >= 125 ? .35 : v >= 100 ? .55 : 1;
const EL = {
  fire:{n:'불', c:'#e8603f', beats:'wind'},
  wind:{n:'바람', c:'#4fc79a', beats:'earth'},
  earth:{n:'땅', c:'#cf9f45', beats:'water'},
  water:{n:'물', c:'#4d93ea', beats:'fire'},
  light:{n:'빛', c:'#efe2a8', fg:'#3a3012', beats:'dark'},
  dark:{n:'어둠', c:'#8b5fc7', beats:'light'},
};
let ELK = ['fire','wind','earth','water'];  // 확장 전 기본 원소 (applyExpansion이 바꿈)
const beatenBy = e => Object.keys(EL).find(k => EL[k].beats === e);
function elemMult(a, b){ if (EL[a].beats === b) return 1.25; if (EL[b].beats === a) return 0.85; return 1; }

// 마법(챔피언) 12종
const CH = {
  ember:{n:'화염술사', e:'fire', role:'사격', g:'炎', hp:520, atk:48, def:8, range:170, spd:60, acd:1.1, sr:200, ar:70, cd:6, sk:'화염구', sd:'대상 주변의 적 모두에게 공격력 200% 피해.'},
  blaze:{n:'불꽃검무사', e:'fire', role:'돌격', g:'刃', hp:660, atk:38, def:13, range:42, spd:88, acd:.95, sr:330, cd:7, sk:'불꽃 도약', sd:'후열의 적에게 도약해 140% 피해를 주고 3초간 불태운다.', assassin:true},
  golem:{n:'용암골렘', e:'fire', role:'수호', g:'巨', hp:980, atk:27, def:22, range:42, spd:50, acd:1.3, self:true, ar:150, cd:9, sk:'용암 껍질', sd:'최대 체력 20% 보호막을 두르고, 주변 적이 2.5초간 자신만 공격하게 만든다.'},
  gale:{n:'질풍검사', e:'wind', role:'돌격', g:'疾', hp:620, atk:46, def:12, range:40, spd:95, acd:.9, sr:320, cd:7, sk:'질풍 베기', sd:'체력이 가장 낮은 적에게 순간 이동해 220% 피해.', assassin:true},
  storm:{n:'폭풍궁수', e:'wind', role:'사격', g:'弓', hp:480, atk:42, def:7, range:200, spd:65, acd:.8, sr:230, cd:5, sk:'바람 화살', sd:'가까운 적 3명에게 화살을 동시에 쏴 각각 100% 피해.'},
  bolt:{n:'번개술사', e:'wind', role:'제어', g:'雷', hp:500, atk:49, def:8, range:180, spd:60, acd:1.15, sr:200, ar:150, cd:6, sk:'연쇄 번개', sd:'180% 피해 후 주변 적에게 두 번 튄다(100%, 70%).'},
  warden:{n:'대지수호자', e:'earth', role:'수호', g:'盾', hp:1250, atk:31, def:25, range:42, spd:48, acd:1.4, self:true, ar:125, cd:9, sk:'지진', sd:'주변 적 모두를 1.4초 기절시키고 130% 피해.'},
  vine:{n:'덩굴사제', e:'earth', role:'치유', g:'蔓', hp:540, atk:26, def:10, range:160, spd:58, acd:1.2, sr:230, cd:6, sk:'재생의 덩굴', sd:'체력이 가장 낮은 아군을 크게 회복시키고 4초간 지속 회복.'},
  stone:{n:'암석투척사', e:'earth', role:'사격', g:'石', hp:620, atk:47, def:14, range:160, spd:55, acd:1.2, sr:180, cd:7, sk:'바위 던지기', sd:'대상에게 200% 피해를 주고 0.8초 기절.'},
  frost:{n:'빙결마녀', e:'water', role:'제어', g:'氷', hp:600, atk:46, def:9, range:175, spd:58, acd:1.2, sr:195, cd:8, sk:'빙결', sd:'공격력이 가장 높은 적을 1.8초 얼리고 170% 피해.'},
  tide:{n:'해일전사', e:'water', role:'돌격', g:'波', hp:900, atk:44, def:16, range:45, spd:70, acd:1.0, self:true, ar:90, cd:7, sk:'해일', sd:'주변 적에게 150% 피해, 밀쳐내고 피해의 40% 회복.'},
  spring:{n:'샘물치유사', e:'water', role:'치유', g:'泉', hp:560, atk:26, def:9, range:150, spd:58, acd:1.2, sr:300, cd:8, sk:'단비', sd:'주문 사거리 안의 아군을 공격력의 540%만큼 회복.'},
  sun:{n:'태양기사', e:'light', role:'수호', g:'陽', hp:1050, atk:29, def:21, range:42, spd:52, acd:1.3, sr:170, cd:9, sk:'성광의 방패', sd:'자신과 주변 아군에게 최대 체력 15% 보호막을 4초간 씌운다.'},
  prism:{n:'프리즘술사', e:'light', role:'사격', g:'光', hp:540, atk:48, def:8, range:190, spd:60, acd:1.1, sr:210, ar:40, cd:7, sk:'분광', sd:'대상 쪽으로 관통 광선을 쏴 줄 위의 적 모두에게 200% 피해.'},
  saint:{n:'성녀', e:'light', role:'치유', g:'聖', hp:560, atk:27, def:10, range:160, spd:58, acd:1.2, sr:260, cd:8, sk:'축복의 기도', sd:'주문 사거리 안의 아군을 공격력의 450%만큼 회복하고, 쓰러진 아군의 부활을 3초 앞당긴다.'},
  shade:{n:'그림자자객', e:'dark', role:'돌격', g:'影', hp:640, atk:50, def:11, range:40, spd:98, acd:.9, sr:340, cd:8, sk:'그림자 처형', sd:'체력이 가장 낮은 적에게 순간 이동해 150% 피해. 대상 체력이 40% 이하면 260%.', assassin:true},
  curse:{n:'저주술사', e:'dark', role:'제어', g:'呪', hp:540, atk:44, def:9, range:175, spd:58, acd:1.15, sr:195, ar:65, cd:7, sk:'쇠약의 저주', sd:'대상과 주변 적에게 160% 피해를 주고 4초간 공격력을 30% 낮춘다.'},
  volcano:{n:'화산술사', e:'fire', role:'제어', g:'山', hp:540, atk:47, def:9, range:170, spd:58, acd:1.2, sr:210, ar:85, cd:8, sk:'화산 폭발', sd:'적이 가장 많이 모인 곳에 넓은 폭발을 일으켜 270% 피해.', exp2:true},
  gust:{n:'돌풍술사', e:'wind', role:'제어', g:'颯', hp:560, atk:44, def:9, range:170, spd:62, acd:1.1, sr:170, cd:6, sk:'돌풍', sd:'가까운 적 두 명에게 190% 피해를 주고 밀쳐내 1.3초 기절시킨다.', exp2:true},
  rush:{n:'바위돌진자', e:'earth', role:'돌격', g:'突', hp:800, atk:37, def:15, range:42, spd:72, acd:1.05, sr:340, cd:8, sk:'바위 돌진', sd:'후열의 적에게 돌진해 지나간 길의 적 모두에게 145% 피해, 대상은 0.8초 기절.', exp2:true},
  mist:{n:'안개술사', e:'water', role:'치유', g:'霧', hp:580, atk:28, def:10, range:160, spd:58, acd:1.2, sr:300, cd:8, sk:'수호의 안개', sd:'주문 사거리 안의 아군이 3초간 받는 피해 −25%, 공격력의 285%만큼 회복.', exp2:true},
  wraith:{n:'망령기사', e:'dark', role:'돌격', g:'魂', hp:880, atk:42, def:15, range:45, spd:70, acd:1.0, self:true, ar:90, cd:7, sk:'영혼 흡수', sd:'주변 적에게 140% 피해를 주고 준 피해의 70%만큼 회복한다.'},
};
// 주문 사거리 표시: 대상까지 닿는 거리(sr)와 범위(ar), 자기 주변형(self)
const REACH_AREA = {ember:'폭발 반경', curse:'폭발 반경', volcano:'폭발 반경', bolt:'튕기는 거리', prism:'광선 폭'};
const REACH_ALLY = ['vine', 'spring', 'saint', 'mist', 'sun'], REACH_JUMP = ['blaze', 'gale', 'shade', 'rush'];
function skillReach(id){
  const c = CH[id];
  if (c.self) return {v:c.ar, txt:`자기 주변 ${c.ar}`};
  let txt = REACH_ALLY.includes(id) ? `아군 ${c.sr} 안` : REACH_JUMP.includes(id) ? `도약 ${c.sr}` : `${c.sr}`;
  if (c.ar && REACH_AREA[id]) txt += ` · ${REACH_AREA[id]} ${c.ar}`;
  return {v:c.sr, txt};
}
function skillReachHtml(id){
  const r = skillReach(id), pct = Math.round(Math.min(1, r.v/340)*100);
  return `<span class="reachv"><span class="rbar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="num">${r.txt}</span></span>`;
}
let CHK = Object.keys(CH).filter(k => ELK.includes(CH[k].e) && !CH[k].exp2);

const SURN = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','홍','문','배','백','남'];
const GIV = ['서','윤','하','지','민','도','현','우','은','준','수','아','린','결','솔','별','온','율','채','시','태','휘','담','건','유','나','혜','람','결','슬','빈','후','연','겸','이','로'];

/* =========================================================
   유틸
   ========================================================= */
const rnd = (a,b) => a + Math.random()*(b-a);
let fxSeed = Date.now() >>> 0;
const fxRnd = (a,b) => { fxSeed = (Math.imul(fxSeed, 1664525) + 1013904223) >>> 0; return a + fxSeed / 4294967296 * (b-a); };
const ri = (a,b) => Math.floor(rnd(a, b+1));
const pick = a => a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const shuffle = a => { for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
let UID = 1; const uid = () => 's' + (UID++) + '_' + Math.floor(Math.random()*1e5);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const R = v => Math.round(v);
const elChip = e => `<span class="el ${e}">${EL[e].n}</span>`;
const ovr = s => (s.atk + s.def + s.int) / 3;
const condMult = c => 0.9 + c/100*0.12;  // 컨디션 100이면 1.02, 60이면 0.97
const stars = n => '★'.repeat(n) + (n < 5 ? `<span class="star-off">${'★'.repeat(5-n)}</span>` : '');

function genName(){ return pick(SURN) + pick(GIV) + pick(GIV); }
function genStudent(year, elemBias, lvl){
  const elem = elemBias && Math.random() < .6 ? elemBias : pick(ELK);
  const base = lvl + (year-1)*5;
  const st = {
    id: uid(), name: genName(), year, elem,
    atk: clamp(ri(base-9, base+9), 18, 95),
    def: clamp(ri(base-9, base+9), 18, 95),
    int: clamp(ri(base-9, base+9), 18, 95),
    pot: ri(1,5), cond: 100, train: null, last: null,  // 훈련은 처음엔 아무것도 고르지 않은 상태
    traits: genTraits(), mastery: {},
  };
  const own = CHK.filter(k => CH[k].e === elem);
  const f1 = pick(own); let f2 = pick(CHK); while (f2 === f1) f2 = pick(CHK);
  st.fav = [f1, f2];
  return st;
}
