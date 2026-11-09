// ===== 기본 상수와 건물 정의 =====
const TILE = 32;
const MAP_W = 80;
const MAP_H = 80;

const TERRAIN = { GRASS: 0, WATER: 1, SAND: 2 };

// 구역(주거/상업/공업) 단계별 수용량
const ZONE_CAP = {
  res: [0, 8, 30, 90],   // 인구
  com: [0, 5, 15, 40],   // 일자리
  ind: [0, 8, 22, 50],   // 일자리
};

// 주민·실제 근로자 1명당 월 과세 기준. 초반 기반시설 비용과 공업의 오염 부담을 반영한다.
const TAX_BASE = { res: 6, com: 10, ind: 12 };

// 실제 사용량에 비례하는 월 운영비 (도시가 커질수록 함께 늘어나는 지출)
// fuel: 화력 발전 전력 1당, water: 물 사용 1당, waste: 처리한 쓰레기 1당, services: 서비스를 받는 주민 1명당
// 작은 마을이 막히지 않도록 인구 startPop명까지는 없고, fullPop명에서 전액이 되도록 단계적으로 늘린다.
const OPERATING_COSTS = {
  startPop: 300, fullPop: 1500,
  fuel: 0.20,
  water: 0.10,
  waste: { landfill: 0.10, incinerator: 0.15, recycling: 0.05 },
  services: { police: 0.05, fire: 0.05, school: 0.08, hospital: 0.09, stadium: 0.03 },
};

// 건물/도구 정의
// size: 차지하는 칸 수, upkeep: 월 유지비, unlock: 필요 인구
const DEFS = {
  levee: { name: '제방', icon: '🧱', cost: 80, upkeep: 0.5, size: 1, cat: 'infra', drag: 'line', unlock: 0, needWater: true, noUpgrade: true, desc: '물과 맞닿은 땅에 짓습니다. 물 반대편 뒤 2칸을 홍수로부터 보호합니다. 전기·수도를 전달하지 않습니다.' },
  landfill: { name: '매립지', icon: '🗑️', cost: 1500, upkeep: 30, size: 3, cat: 'waste', unlock: 0, wasteCapacity: 60000, pollution: 10, pollutionRadius: 4, noUpgrade: true, desc: '같은 도로망의 쓰레기를 총 60,000까지 보관합니다. 70%·90%에서 미리 알리며, 주변 4칸에 오염과 땅값 하락이 생깁니다.' },
  incinerator: { name: '소각장', icon: '🔥', cost: 6000, upkeep: 90, size: 2, cat: 'waste', unlock: 1500, wasteProcess: 1500, powerUse: 20, pollution: 40, pollutionRadius: 6, noUpgrade: true, desc: '전력 20을 사용해 같은 도로망의 쓰레기를 월 1,500 처리합니다. 남는 능력으로 밀린 쓰레기도 치우며 주변 6칸을 오염시킵니다.' },
  recycling: { name: '재활용센터', icon: '♻️', cost: 4000, upkeep: 50, size: 2, cat: 'waste', unlock: 2500, wasteProcess: 700, noUpgrade: true, desc: '같은 도로망의 쓰레기를 월 700 처리합니다. 운영하는 센터마다 도시 발생량을 15% 줄이며 최대 30%까지 적용됩니다.' },
  busstop: { name: '버스 정류장', icon: '🚏', cost: 300, upkeep: 12, size: 1, cat: 'transit', unlock: 800, radius: 8, needRoad: true, powerUse: 0, desc: '도로 바로 옆에 짓습니다. 집과 직장 모두 정류장 범위에 있으면 출근자의 25%가 버스를 탑니다.' },
  subway: { name: '지하철역', icon: '🚇', cost: 2500, upkeep: 60, size: 2, cat: 'transit', unlock: 3000, radius: 10, powerUse: 15, desc: '도로와 전력이 필요하고 운영 중인 역이 2개 이상 있어야 합니다. 집과 직장이 서로 다른 역 범위에 있으면 출근자의 50%가 이용합니다.' },
  avenue:   { name: '큰길(4차로)', icon: '🛣️', cost: 30, upkeep: 0.8, size: 1, drag: 'line', cat: 'infra', unlock: 500, desc: '4차선 도로입니다. 월 통행량 750명을 수용합니다. 기존 도로 확장은 ₩20, 물 위 큰 다리는 ₩120입니다.' },
  road:     { name: '도로',        icon: '🛣️', cost: 10,   upkeep: 0.3, size: 1, drag: 'line', cat: 'infra',  desc: '건물은 도로와 이어져야 성장합니다. 전기·수도도 도로를 따라 흐릅니다.' },
  res:      { name: '주거 구역',   icon: '🏠', cost: 20,   upkeep: 0,   size: 1, drag: 'rect', cat: 'zone', zone: true, color: '#4cc85a', desc: '시민이 사는 곳. 일자리가 많을수록 수요가 늘어납니다.' },
  com:      { name: '상업 구역',   icon: '🏪', cost: 25,   upkeep: 0,   size: 1, drag: 'rect', cat: 'zone', zone: true, color: '#3d8fe6', desc: '상점과 사무실. 인구가 많을수록 수요가 늘어납니다.' },
  ind:      { name: '공업 구역',   icon: '🏭', cost: 25,   upkeep: 0,   size: 1, drag: 'rect', cat: 'zone', zone: true, color: '#e6b229', desc: '공장. 일자리를 만들지만 오염이 발생합니다.' },
  power:    { name: '화력 발전소', icon: '⚡', cost: 3000, upkeep: 60,  size: 2, cat: 'util', powerCap: 900, pollution: 70, desc: '전력 900 공급. 주변이 오염됩니다.' },
  solar:    { name: '태양광 발전소', icon: '🔆', cost: 6000, upkeep: 45, size: 2, cat: 'util', powerCap: 600, unlock: 600, desc: '전력 600 공급. 오염이 없습니다.' },
  watertower:{ name: '급수탑',     icon: '🚰', cost: 1200, upkeep: 25,  size: 1, cat: 'util', waterCap: 500, desc: '물 500 공급. 도로로 연결된 건물에 공급됩니다.' },
  pump:     { name: '양수장',      icon: '💧', cost: 2500, upkeep: 40,  size: 1, cat: 'util', waterCap: 1600, needWater: true, desc: '물 1600 공급. 강·호수 바로 옆에만 지을 수 있습니다.' },
  park:     { name: '공원',        icon: '🌳', cost: 150,  upkeep: 3,   size: 1, cat: 'service', radius: 4,  desc: '주변 땅값과 행복도를 올리고 오염을 줄입니다.' },
  police:   { name: '경찰서',      icon: '🚓', cost: 700,  upkeep: 40,  size: 1, cat: 'service', radius: 12, desc: '범위 안의 범죄를 줄입니다.' },
  fire:     { name: '소방서',      icon: '🚒', cost: 700,  upkeep: 40,  size: 1, cat: 'service', radius: 12, desc: '범위 안의 화재를 예방하고 빠르게 진압합니다.' },
  school:   { name: '학교',        icon: '🏫', cost: 1500, upkeep: 60,  size: 2, cat: 'service', radius: 14, unlock: 150, desc: '교육으로 땅값을 올리고 고밀도 개발을 돕습니다.' },
  hospital: { name: '병원',        icon: '🏥', cost: 2500, upkeep: 90,  size: 2, cat: 'service', radius: 16, unlock: 400, desc: '건강을 지켜 행복도를 올립니다.' },
  stadium:  { name: '경기장',      icon: '🏟️', cost: 9000, upkeep: 150, size: 3, cat: 'service', radius: 26, unlock: 2500, desc: '넓은 범위의 행복도와 땅값을 크게 올립니다.' },
  bulldoze: { name: '철거',        icon: '🚜', cost: 5, treeCost: 3, upkeep: 0, size: 1, drag: 'rect', cat: 'tool', desc: '건물·도로는 ₩5, 나무는 칸당 ₩3에 철거합니다.' },
  inspect:  { name: '살펴보기',    icon: '🔍', cost: 0,    upkeep: 0,   size: 1, cat: 'tool', desc: '칸을 클릭해 정보를 봅니다.' },
};

const TOOL_ORDER = [
  ['도구',   ['inspect', 'bulldoze']],
  ['기반',   ['road', 'res', 'com', 'ind', 'levee']],
  ['교통',   ['avenue', 'busstop', 'subway']],
  ['전기·수도', ['power', 'solar', 'watertower', 'pump']],
  ['환경',   ['landfill', 'incinerator', 'recycling']],
  ['공공',   ['park', 'police', 'fire', 'school', 'hospital', 'stadium']],
];

const SERVICE_KEYS = ['park', 'police', 'fire', 'school', 'hospital', 'stadium'];

const OVERLAYS = [
  ['none', '없음'], ['power', '전력'], ['water', '수도'], ['land', '땅값'],
  ['traffic', '교통'],
  ['transit', '대중교통'],
  ['garbage', '쓰레기'],
  ['pollution', '오염'], ['crime', '범죄'], ['police', '치안'], ['fire', '소방'],
  ['school', '교육'], ['hospital', '의료'],
];

const DIFFICULTY = {
  // upkeep: 유지비·운영비·행정비 배율, reward: 성장 단계·시민 의뢰 보상 배율
  easy:   { name: '쉬움',   money: 50000, upkeep: 0.85, reward: 1.25 },
  normal: { name: '보통',   money: 25000, upkeep: 1,    reward: 1 },
  hard:   { name: '어려움', money: 10000, upkeep: 1.25, reward: 0.5 },
};

const MILESTONES = [
  { pop: 100,   title: '마을',     reward: 2000 },
  { pop: 500,   title: '소도시',   reward: 5000 },
  { pop: 1500,  title: '도시',     reward: 10000 },
  { pop: 4000,  title: '대도시',   reward: 20000 },
  { pop: 10000, title: '메트로폴리스', reward: 50000 },
  { pop: 25000, title: '메가시티', reward: 100000 },
];
