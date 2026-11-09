// ===== 시뮬레이션 =====
let S = null; // 현재 게임 상태

function notify(msg, kind, x, y) {
  if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, kind || 'info', x, y);
  if (typeof SOUND !== 'undefined' && String(msg).startsWith('🔥')) SOUND.play('fire');
}

function newGame(opts) {
  const seed = opts.seed || Math.floor(Math.random() * 1e9);
  S = {
    version: 1,
    name: opts.name || '새 도시',
    difficulty: opts.difficulty || 'normal',
    seed,
    tiles: generateMap(seed),
    money: DIFFICULTY[opts.difficulty || 'normal'].money,
    year: 2026, month: 1, day: 1,
    startedAt: 2026 * 12,
    taxes: { res: 9, com: 9, ind: 9 },
    history: [],
    budget: null,
    milestone: 0,
    unlockedSeen: {},
    negMonths: 0,
    loans: [],
    finance: typeof FINANCE !== 'undefined' ? FINANCE.normalize() : undefined,
    waste: typeof WASTE !== 'undefined' ? WASTE.normalize() : undefined,
    news: typeof NEWS !== 'undefined' ? NEWS.normalize() : undefined,
    achievements: typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.normalize() : undefined,
    disasterMode: ['off', 'rare', 'frequent'].includes(opts.disasterMode) ? opts.disasterMode : 'rare',
    disasters: typeof DISASTER !== 'undefined' ? DISASTER.normalize() : undefined,
    civic: typeof CIVIC !== 'undefined' ? CIVIC.normalize() : undefined,
    development: typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.normalize() : undefined,
    traffic: typeof TRAFFIC !== 'undefined' ? TRAFFIC.normalize() : undefined,
    transit: typeof TRANSIT !== 'undefined' ? TRANSIT.normalize() : undefined,
  };
  initDerived();
  if (typeof DEVELOPMENT !== 'undefined' && opts.scenario && opts.scenario !== 'free') {
    DEVELOPMENT.initScenario(opts.scenario);
    recomputeAll();
  }
}

// 확장 효과는 원본 정의를 변경하지 않고 계산마다 합산한다.
function simulationModifiers() {
  const result = { happiness: 0, pollution: 1, waterUse: 1, powerUse: 1, school: 1, fire: 1,
    income: 1, resDemand: 0, comDemand: 0, indDemand: 0 };
  const factors = new Set(['pollution', 'waterUse', 'powerUse', 'school', 'fire', 'income']);
  for (const source of [typeof CIVIC !== 'undefined' ? CIVIC.modifiers() : {},
    typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.modifiers() : {},
    typeof AMBIENCE !== 'undefined' ? AMBIENCE.modifiers() : {}]) {
    for (const key of Object.keys(result)) if (Number.isFinite(source[key])) {
      if (factors.has(key)) result[key] *= source[key]; else result[key] += source[key];
    }
  }
  return result;
}

function facilityDefinition(t, i) {
  return typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.definition(t, i) : DEFS[t.type];
}

function isFacilityOperating(t, i) {
  const d = DEFS[t.type];
  return !!d && t.root === i && t.fire === 0 && !t.disasterDisabled && !t.flooded && t.road
    && (!d.needRoad || DIR4.some(([dx, dy]) => inMap(i % MAP_W + dx, Math.floor(i / MAP_W) + dy)
      && S.tiles[idx(i % MAP_W + dx, Math.floor(i / MAP_W) + dy)].type === 'road'
      && !S.tiles[idx(i % MAP_W + dx, Math.floor(i / MAP_W) + dy)].flooded))
    && (!(d.powerUse > 0) || t.powered) && (!(d.waterUse > 0) || t.watered);
}

// 저장되지 않는 파생 데이터
function initDerived() {
  S.cov = {};
  for (const k of SERVICE_KEYS) S.cov[k] = new Float32Array(MAP_W * MAP_H);
  S.nearWater = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    let near = 0;
    for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy;
      if (inMap(nx, ny) && S.tiles[idx(nx, ny)].t === TERRAIN.WATER) { near = 1; break; }
    }
    S.nearWater[idx(x, y)] = near;
  }
  S.stats = {
    pop: 0, comJobs: 0, indJobs: 0, workers: 0, unemployment: 0,
    jobFillRate: 0, employedCom: 0, employedInd: 0,
    powerCap: 0, powerUse: 0, waterCap: 0, waterUse: 0,
    happiness: 60, demand: { res: 1, com: 0.3, ind: 0.5 },
    income: 0, expense: 0,
  };
  markLayoutDirty();
  recomputeAll();
}

function markLayoutDirty() {
  S.netDirty = true;
  S.layoutDirty = true;
  S.servicesDirty = true;
}

function markGrowthDirty() {
  S.netDirty = true;
  S.servicesDirty = true;
}

function recomputeAll() {
  recomputeNetworks();
  recomputeCoverage();
  if (typeof TRAFFIC !== 'undefined') TRAFFIC.recompute();
  if (typeof WASTE !== 'undefined') WASTE.refresh();
  computeStats(); // 환경 계산에 사용할 현재 인구를 먼저 집계
  recomputeMaps();
  computeStats();
  S.layoutDirty = false;
  S.servicesDirty = false;
}

// ---------- 배치 ----------
function rootOf(i) { const t = S.tiles[i]; return t.root >= 0 ? t.root : i; }

function treeRemovalCost() {
  const cost = DEFS.bulldoze.treeCost;
  // 이전 버전의 가격 데이터와 함께 열려도 기존 나무 정리 단가를 유지한다.
  return Number.isFinite(cost) && cost >= 0 ? cost : 3;
}

function isUnlocked(key) {
  if (typeof DEVELOPMENT !== 'undefined') return DEVELOPMENT.canUnlock(key);
  const d = DEFS[key];
  return !d.unlock || S.stats.pop >= d.unlock || S.unlockedSeen[key];
}

// 한 칸(또는 다칸 건물의 좌상단)에 배치 가능 여부와 비용
function checkPlace(key, x, y) {
  const d = DEFS[key];
  if (!isUnlocked(key)) return { ok: false, reason: typeof DEVELOPMENT !== 'undefined'
    ? DEVELOPMENT.lockReason(key) : `인구 ${d.unlock.toLocaleString()} 필요` };
  const sz = d.size;
  if (!inMap(x, y) || !inMap(x + sz - 1, y + sz - 1)) return { ok: false, reason: '맵 밖' };
  if (key === 'avenue' && S.tiles[idx(x, y)].type === 'road') {
    return S.tiles[idx(x, y)].lanes === 2
      ? { ok: false, reason: '이미 큰길', skip: true }
      : { ok: true, cost: 20, treeCount: 0, treeCost: 0 };
  }
  let cost = d.cost, treeCount = 0;
  let nearWater = false;
  for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
    const t = S.tiles[idx(x + dx, y + dy)];
    if (t.t === TERRAIN.WATER) {
      if ((key === 'road' || key === 'avenue') && !t.type) { cost = key === 'avenue' ? 120 : 60; continue; } // 다리
      return { ok: false, reason: '물 위에는 지을 수 없음' };
    }
    if (t.type) {
      if (d.zone && DEFS[t.type] && DEFS[t.type].zone && t.level === 0 && t.type !== key) continue; // 빈 구역 재지정
      if (key === 'road' && t.type === 'road') return { ok: false, reason: '이미 도로', skip: true };
      if (d.zone && t.type === key) return { ok: false, reason: '이미 지정됨', skip: true };
      return { ok: false, reason: '이미 사용 중' };
    }
    if (t.tree) { treeCount++; cost += treeRemovalCost(); }
    if (d.needWater) {
      for (const [ox, oy] of DIR4) {
        const nx = x + dx + ox, ny = y + dy + oy;
        if (inMap(nx, ny) && S.tiles[idx(nx, ny)].t === TERRAIN.WATER) nearWater = true;
      }
    }
  }
  if (d.needWater && !nearWater) return { ok: false, reason: '물가에만 지을 수 있음' };
  if (d.needRoad && !DIR4.some(([dx, dy]) => inMap(x + dx, y + dy) && S.tiles[idx(x + dx, y + dy)].type === 'road')) {
    return { ok: false, reason: '도로 바로 옆에 지으세요' };
  }
  return { ok: true, cost, treeCount, treeCost: treeCount * treeRemovalCost() };
}

function placeAt(key, x, y) {
  const d = DEFS[key];
  const r = checkPlace(key, x, y);
  if (!r.ok) return r;
  if (!Number.isFinite(S.money) || !Number.isFinite(r.cost) || r.cost < 0) return { ok: false, reason: '자금 또는 비용 정보가 올바르지 않습니다' };
  if (S.money < r.cost) return { ok: false, reason: '돈 부족' };
  S.money -= r.cost;
  const sz = d.size;
  const root = idx(x, y);
  for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
    const t = S.tiles[idx(x + dx, y + dy)];
    t.tree = false;
    t.type = key === 'avenue' ? 'road' : key;
    t.lanes = key === 'avenue' ? 2 : 1;
    t.level = 0;
    t.fire = 0;
    t.noPower = 0;
    t.upgrade = 0;
    t.garbage = 0;
    t.landfillStored = 0;
    t.root = (d.zone || key === 'road' || key === 'avenue') ? -1 : root;
  }
  markLayoutDirty();
  return r;
}

function bulldozeCost(x, y) {
  if (!inMap(x, y)) return null;
  const t = S.tiles[idx(x, y)];
  if (t.type) return DEFS.bulldoze.cost * (t.root >= 0 ? 1 : 1);
  if (t.tree) return treeRemovalCost();
  return null;
}

function bulldozeAt(x, y) {
  if (!inMap(x, y)) return { ok: false };
  const i = idx(x, y);
  const t = S.tiles[i];
  const c = bulldozeCost(x, y);
  if (c === null) return { ok: false, reason: '철거할 것이 없음' };
  if (!Number.isFinite(S.money) || !Number.isFinite(c) || c < 0) return { ok: false, reason: '자금 또는 비용 정보가 올바르지 않습니다' };
  if (S.money < c) return { ok: false, reason: '돈 부족' };
  S.money -= c;
  if (!t.type) { t.tree = false; return { ok: true, cost: c }; }
  if (t.root >= 0) {
    const ri = t.root, rx = ri % MAP_W, ry = (ri / MAP_W) | 0;
    const key = t.type;
    const sz = key === 'rubble' ? 1 : DEFS[key].size;
    for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
      const tt = S.tiles[idx(rx + dx, ry + dy)];
      if (tt.root === ri) clearTile(tt);
    }
  } else clearTile(t);
  markLayoutDirty();
  return { ok: true, cost: c };
}

function clearTile(t) {
  t.type = null; t.root = -1; t.level = 0; t.fire = 0;
  t.lanes = 1;
  t.upgrade = 0;
  t.garbage = 0;
  t.landfillStored = 0;
  t.powered = false; t.watered = false;
}

// ---------- 전력/수도 네트워크 ----------
function powerUseOf(t, i) {
  if (!t.type || t.type === 'road' || t.type === 'rubble') return 0;
  const L = t.level;
  if (t.type === 'res') return L === 0 ? 1 : 2 + L * 3;
  if (t.type === 'com') return L === 0 ? 1 : 3 + L * 4;
  if (t.type === 'ind') return L === 0 ? 1 : 4 + L * 6;
  if (t.root !== i) return 0; // 다칸 건물은 루트에서만 계산
  if (DEFS[t.type].powerUse !== undefined) return facilityDefinition(t, i).powerUse;
  return { park: 0, police: 10, fire: 10, school: 25, hospital: 35, stadium: 60, watertower: 12, pump: 18, power: 0, solar: 0 }[t.type] || 0;
}
function waterUseOf(t, i) {
  if (!t.type || t.type === 'road' || t.type === 'rubble') return 0;
  const L = t.level;
  if (t.type === 'res') return L === 0 ? 0 : 2 + L * 3;
  if (t.type === 'com') return L === 0 ? 0 : 2 + L * 2;
  if (t.type === 'ind') return L === 0 ? 0 : 3 + L * 4;
  if (t.root !== i) return 0;
  if (DEFS[t.type].waterUse !== undefined) return facilityDefinition(t, i).waterUse;
  return { park: 2, police: 5, fire: 8, school: 15, hospital: 25, stadium: 40 }[t.type] || 0;
}
function conducts(t) { return t.type && t.type !== 'rubble' && t.type !== 'levee' && !t.flooded && !t.disasterDisabled; }

function runNetwork(capKey, useFn, flag) {
  const tiles = S.tiles;
  const N = tiles.length;
  const seen = new Uint8Array(N);
  let totalCap = 0, totalUse = 0, idleCap = 0;
  let totalDemand = 0, shortfall = 0, cutDemand = 0;
  const shortRoots = [];              // 망에는 있지만 용량이 모자라 끊긴 건물
  const idleSources = [];             // 쓰는 곳이 하나도 없는(고립된) 공급 시설
  for (let i = 0; i < N; i++) tiles[i][flag] = false;
  for (let s = 0; s < N; s++) {
    const st = tiles[s];
    if (seen[s] || !conducts(st) || !DEFS[st.type] || !DEFS[st.type][capKey]) continue;
    // 연결된 구성요소 BFS
    const q = [s]; seen[s] = 1;
    let cap = 0, qh = 0;
    const roots = new Set();
    while (qh < q.length) {
      const i = q[qh++];
      const t = tiles[i];
      if (DEFS[t.type]?.[capKey]) {
        const root = rootOf(i);
        if (!roots.has(root)) { roots.add(root); cap += facilityDefinition(t, i)[capKey]; }
      }
      const x = i % MAP_W, y = (i / MAP_W) | 0;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (seen[ni] || !conducts(tiles[ni])) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    totalCap += cap;
    let remain = cap, consumers = 0, gridDemand = 0;
    // 루트 기준으로 다칸 건물 전체에 동일 상태 부여
    const rootState = new Map();
    for (const i of q) {
      const t = tiles[i];
      const r = rootOf(i);
      if (t.root >= 0 && r !== i) continue;
      const use = useFn(t, i);
      let ok = true;
      if (use > 0) {
        consumers++;
        gridDemand += use;
        if (remain >= use) { remain -= use; totalUse += use; } else { ok = false; shortRoots.push(i); }
      }
      t[flag] = ok;
      if (t.root >= 0) rootState.set(r, ok);
    }
    totalDemand += gridDemand;
    shortfall += Math.max(0, gridDemand - cap);
    if (consumers === 0) { idleCap += cap; for (const r of roots) idleSources.push(r); }
    for (const i of q) {
      const t = tiles[i];
      if (t.root >= 0 && t.root !== i) t[flag] = rootState.has(t.root) ? rootState.get(t.root) : true;
    }
  }
  // 공급망에 아예 닿지 않아 끊긴 건물(도로 접근은 있는 칸만 센다)
  const cutRoots = [];
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (seen[i] || !t.type || !t.road || (t.root >= 0 && t.root !== i)) continue;
    if (DEFS[t.type] && DEFS[t.type][capKey]) continue;
    const use = useFn(t, i);
    if (use > 0) { cutRoots.push(i); cutDemand += use; }
  }
  return { cap: totalCap, use: totalUse, demand: totalDemand + cutDemand, shortfall, cutDemand,
    linkedCap: totalCap - idleCap, idleCap, idleSources, shortRoots, cutRoots };
}

// 상단 바·알림용 공급 상태 요약
function supplyReport(n) {
  const developed = i => { const t = S.tiles[i]; return !(DEFS[t.type] && DEFS[t.type].zone) || t.level > 0; };
  return {
    demand: n.demand, shortfall: n.shortfall, cutDemand: n.cutDemand,
    linkedCap: n.linkedCap, idleCap: n.idleCap, idleSources: n.idleSources,
    short: n.shortRoots.length, cut: n.cutRoots.length,
    cutDeveloped: n.cutRoots.filter(developed).length, firstCut: n.cutRoots.find(developed),
    out: n.shortRoots.length + n.cutRoots.length,
    targets: [...n.shortRoots, ...n.cutRoots].slice(0, 200),
  };
}

function recomputeNetworks() {
  if (typeof DISASTER !== 'undefined') DISASTER.applyState();
  // 도로 접근성(도로에서 맨해튼 거리 2 이내)
  const tiles = S.tiles;
  const dist = new Uint8Array(MAP_W * MAP_H).fill(255);
  const q = [];
  for (let i = 0; i < tiles.length; i++) if (tiles[i].type === 'road' && !tiles[i].flooded) { dist[i] = 0; q.push(i); }
  let h = 0;
  while (h < q.length) {
    const i = q[h++];
    if (dist[i] >= 2) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (!tiles[ni].flooded && dist[ni] > dist[i] + 1) { dist[ni] = dist[i] + 1; q.push(ni); }
    }
  }
  for (let i = 0; i < tiles.length; i++) tiles[i].road = !tiles[i].flooded && dist[i] <= 2;
  // 다칸 건물은 한 칸이라도 접근 가능하면 OK
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t.root >= 0 && t.road) tiles[t.root].road = true;
  }
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t.root >= 0) t.road = tiles[t.root].road;
  }

  const effects = simulationModifiers();
  const p = runNetwork('powerCap', (t, i) => powerUseOf(t, i) * effects.powerUse, 'powered');
  const w = runNetwork('waterCap', (t, i) => waterUseOf(t, i) * effects.waterUse, 'watered');
  S.stats.powerCap = p.cap; S.stats.powerUse = p.use;
  S.stats.waterCap = w.cap; S.stats.waterUse = w.use;
  S.stats.powerNet = supplyReport(p);
  S.stats.waterNet = supplyReport(w);
  // 재난으로 멈춘 발전소는 자체 전력 표시도 중단한다.
  for (const t of tiles) {
    if (t.type && DEFS[t.type] && DEFS[t.type].powerCap && !t.flooded && !t.disasterDisabled) t.powered = true;
  }
  S.netDirty = false;
}

// ---------- 공공 서비스 범위 ----------
// 반경과 중심 위치가 같으면 거리별 가중치도 같다. 시설별 배율과 오염량은 적용 때마다 계산한다.
const influenceKernels = new Map();
function influenceRows(radius, sampleOffset, service) {
  const key = `${radius}:${sampleOffset}:${service}`;
  if (influenceKernels.has(key)) return influenceKernels.get(key);
  const rows = [], reach = Math.ceil(radius + sampleOffset);
  for (let dy = -reach; dy <= reach; dy++) {
    let firstX = 0;
    const weights = [];
    for (let dx = -reach; dx <= reach; dx++) {
      const distance = Math.hypot(dx + sampleOffset, dy + sampleOffset);
      if (distance > radius) continue;
      if (!weights.length) firstX = dx;
      weights.push(service ? 1 - Math.pow(distance / radius, 2) * .7 : 1 - distance / (radius + 1));
    }
    if (weights.length) rows.push({ dy, firstX, weights });
  }
  influenceKernels.set(key, rows);
  return rows;
}

function recomputeCoverage() {
  const effects = simulationModifiers();
  for (const k of SERVICE_KEYS) S.cov[k].fill(0);
  const tiles = S.tiles;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!t.type || t.root !== i || t.fire > 0 || t.disasterDisabled || t.flooded) continue;
    const d = facilityDefinition(t, i);
    const service = d.serviceKey || t.type;
    if (!SERVICE_KEYS.includes(service)) continue;
    if (d.serviceKey && !isFacilityOperating(t, i)) continue;
    if (t.type !== 'park' && !t.powered) continue; // 전기 없으면 운영 불가
    const center = Math.floor(d.size / 2), cx = i % MAP_W + center, cy = ((i / MAP_W) | 0) + center;
    const rows = influenceRows(d.radius, d.size % 2 === 0 ? .5 : 0, true);
    const cov = S.cov[service];
    const factor = effects[service] || 1;
    for (const { dy, firstX, weights } of rows) {
      const y = cy + dy;
      if (y < 0 || y >= MAP_H) continue;
      const left = cx + firstX, end = Math.min(weights.length, MAP_W - left), offset = y * MAP_W + left;
      for (let k = Math.max(0, -left); k < end; k++) {
        const v = Math.min(1, weights[k] * factor), j = offset + k;
        if (v > cov[j]) cov[j] = v;
      }
    }
  }
}

// ---------- 오염/범죄/땅값 ----------
function recomputeMaps() {
  const effects = simulationModifiers();
  const tiles = S.tiles;
  const N = tiles.length;
  const poll = new Float32Array(N);
  // 매번 새 누적합을 만들어 나무 생성·철거도 반영한다. 5×5 범위는 네 번의 조회로 센다.
  const treeStride = MAP_W + 1;
  const treeSums = new Int32Array(treeStride * (MAP_H + 1));
  for (let y = 1; y <= MAP_H; y++) {
    const row = y * treeStride, previous = row - treeStride, tileRow = (y - 1) * MAP_W;
    let rowTrees = 0;
    for (let x = 1; x <= MAP_W; x++) {
      if (tiles[tileRow + x - 1].tree) rowTrees++;
      treeSums[row + x] = treeSums[previous + x] + rowTrees;
    }
  }
  const emit = (i, amount, r) => {
    const cx = i % MAP_W, cy = (i / MAP_W) | 0;
    for (const { dy, firstX, weights } of influenceRows(r, 0, false)) {
      const y = cy + dy;
      if (y < 0 || y >= MAP_H) continue;
      const left = cx + firstX, end = Math.min(weights.length, MAP_W - left), offset = y * MAP_W + left;
      for (let k = Math.max(0, -left); k < end; k++) poll[offset + k] += amount * weights[k];
    }
  };
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.flooded || t.disasterDisabled) continue;
    if (t.type === 'ind' && t.level > 0) emit(i, 12 * t.level * effects.pollution, 4);
    else if (t.type && t.root === i && DEFS[t.type]?.pollution) {
      const d = facilityDefinition(t, i);
      emit(i + (d.size > 1 ? MAP_W + 1 : 0), d.pollution * effects.pollution, d.pollutionRadius || (t.type === 'power' ? 7 : 4));
    }
    else if (t.type === 'com' && t.level === 3) emit(i, 4 * effects.pollution, 2);
  }
  const popCrime = Math.min(20, S.stats.pop / 500);
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    const left = Math.max(0, x - 2), right = Math.min(MAP_W, x + 3);
    const top = Math.max(0, y - 2) * treeStride, bottom = Math.min(MAP_H, y + 3) * treeStride;
    const trees = treeSums[bottom + right] - treeSums[top + right] - treeSums[bottom + left] + treeSums[top + left];
    let p = poll[i] - S.cov.park[i] * 25 - trees * 1.5;
    t.poll = Math.max(0, Math.min(100, p));

    let c = 0;
    if ((t.type === 'res' || t.type === 'com' || t.type === 'ind') && t.level > 0) {
      c = 8 + t.level * 12 + (t.type === 'com' ? 8 : 0) + popCrime;
      c -= S.cov.police[i] * 75;
    }
    t.crime = Math.max(0, Math.min(100, c));

    let land = 25 + (S.nearWater[i] ? 12 : 0) + Math.min(8, trees * 1.2)
      + S.cov.park[i] * 20 + S.cov.school[i] * 12 + S.cov.hospital[i] * 6
      + S.cov.stadium[i] * 15 + S.cov.police[i] * 5
      - t.poll * 0.45 - t.crime * 0.25
      - (typeof TRAFFIC !== 'undefined' ? Math.min(12, Math.max(0, ((t.nearbyTraffic || 0) - 50) * 0.24)) : 0)
      - (typeof WASTE !== 'undefined' ? WASTE.penalty(t) + WASTE.landfillPenalty(i) : 0);
    t.land = Math.max(0, Math.min(100, land));
  }
}

// ---------- 통계/수요/행복도 ----------
function computeStats() {
  const st = S.stats;
  const effects = simulationModifiers();
  let pop = 0, comJobs = 0, indJobs = 0;
  let hapSum = 0, hapW = 0;
  for (let i = 0; i < S.tiles.length; i++) {
    const t = S.tiles[i];
    if (t.type && t.root === i && isFacilityOperating(t, i)) {
      const d = facilityDefinition(t, i);
      comJobs += d.comJobs || 0;
      indJobs += d.indJobs || 0;
    }
    if (!t.type || t.level === 0) continue;
    if (t.type === 'res') {
      const p = ZONE_CAP.res[t.level];
      pop += p;
      let h = 55 + (t.land - 40) * 0.4 - t.poll * 0.4 - t.crime * 0.3
        + S.cov.fire[i] * 5 + S.cov.hospital[i] * 12 + S.cov.school[i] * 8 + S.cov.stadium[i] * 10
        + (t.watered ? 5 : -15) + (t.powered ? 0 : -25)
        - (typeof TRAFFIC !== 'undefined' ? TRAFFIC.residentialPenalty(i) : 0)
        + (typeof TRANSIT !== 'undefined' && t.transitCovered ? 2 : 0)
        - (typeof WASTE !== 'undefined' ? WASTE.penalty(t) : 0);
      hapSum += h * p; hapW += p;
    } else if (t.type === 'com') comJobs += ZONE_CAP.com[t.level];
    else if (t.type === 'ind') indJobs += ZONE_CAP.ind[t.level];
  }
  const jobs = comJobs + indJobs;
  const workers = pop * 0.55;
  // 일자리 정원은 성장 수요에, 실제 고용은 세금과 시설 운영 수입에 사용한다.
  let jobFillRate = jobs > 0 ? Math.min(1, workers / jobs) : 0;
  let employedCom = comJobs * jobFillRate, employedInd = indJobs * jobFillRate;
  if (typeof TRAFFIC !== 'undefined' && S.traffic) {
    employedCom = Math.min(comJobs, S.traffic.employedCom || 0);
    employedInd = Math.min(indJobs, S.traffic.employedInd || 0);
    const scale = Math.min(1, workers / Math.max(1, employedCom + employedInd));
    employedCom *= scale; employedInd *= scale;
    jobFillRate = jobs > 0 ? (employedCom + employedInd) / jobs : 0;
  }
  const unemployment = workers > 0 ? Math.max(0, workers - employedCom - employedInd) / workers : 0;
  let hap = hapW > 0 ? hapSum / hapW : 60;
  hap -= (S.taxes.res - 9) * 2.5;
  hap -= unemployment * 30;
  hap += effects.happiness;
  hap = Math.max(0, Math.min(100, hap));

  const clamp = v => Math.max(-1, Math.min(1, v));
  const taxAdj = r => -(r - 9) * 0.05;
  const dRes = clamp((jobs * 1.7 + 80 - pop) / Math.max(80, pop * 0.35) + taxAdj(S.taxes.res) + (hap - 55) / 120);
  const dCom = clamp((pop * 0.22 + 15 - comJobs) / Math.max(25, comJobs * 0.5 + pop * 0.05) + taxAdj(S.taxes.com));
  const dInd = clamp((pop * 0.3 + 30 - indJobs) / Math.max(25, indJobs * 0.5 + pop * 0.05) + taxAdj(S.taxes.ind));

  Object.assign(st, { pop, comJobs, indJobs, workers, jobFillRate, employedCom, employedInd, unemployment, happiness: hap });
  st.demand = { res: clamp(dRes + effects.resDemand), com: clamp(dCom + effects.comDemand), ind: clamp(dInd + effects.indDemand) };
}

// ---------- 시간 진행 ----------
function dayTick() {
  if (typeof DISASTER !== 'undefined' && DISASTER.onDay()) recomputeAll();
  if (S.layoutDirty) recomputeAll();
  else if (S.netDirty) { recomputeNetworks(); recomputeCoverage(); }
  const tiles = S.tiles;
  const dem = S.stats.demand;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t.fire > 0) {
      if (t.root < 0 || t.root === i) fireStep(i); // 다칸 건물은 하루에 한 번만 진행
      continue;
    }
    if (t.type !== 'res' && t.type !== 'com' && t.type !== 'ind') continue;
    if (Math.random() > 1 / 10) continue;
    growTile(t, dem[t.type]);
  }
  if (S.layoutDirty) recomputeAll(); // 화재 멸실·진압도 그날 바로 반영한다.
  else computeStats();
  checkSupplyAlerts();
  if (typeof CIVIC !== 'undefined' && CIVIC.onDay) CIVIC.onDay();
  S.day++;
  if (S.day > 30) { S.day = 1; monthTick(); }
}

// 정전·단수·고립된 공급 시설이 새로 생기면 바로 알린다 (위치 클릭으로 이동)
function checkSupplyAlerts() {
  const st = S.stats;
  if (!st.powerNet || !st.waterNet) return;
  const prev = S._supplyAlert || { pShort: 0, wShort: 0, pIdle: 0, wIdle: 0, pCut: 0, wCut: 0 };
  const at = i => [i % MAP_W, (i / MAP_W) | 0];
  const say = (msg, kind, i) => i === undefined ? notify(msg, kind) : notify(msg, kind, ...at(i));
  const P = st.powerNet, W = st.waterNet;
  if (P.short > 0 && prev.pShort === 0) say(`⚡ 정전 발생! 전력이 모자라 ${P.short}곳에 전기가 끊겼어요. 발전소를 더 지으세요. (클릭하면 이동)`, 'bad', P.targets[0]);
  if (W.short > 0 && prev.wShort === 0) say(`💧 단수 발생! 물이 모자라 ${W.short}곳에 물이 끊겼어요. 급수 시설을 더 지으세요. (클릭하면 이동)`, 'bad', W.targets[0]);
  if (P.idleSources.length > prev.pIdle) say('⚡ 도로·건물과 연결되지 않은 발전소가 있어요. 도로에 붙여야 전기를 보낼 수 있어요. (클릭하면 이동)', 'warn', P.idleSources[P.idleSources.length - 1]);
  if (W.idleSources.length > prev.wIdle) say('💧 도로·건물과 연결되지 않은 급수 시설이 있어요. 도로에 붙여야 물을 보낼 수 있어요. (클릭하면 이동)', 'warn', W.idleSources[W.idleSources.length - 1]);
  if (P.cutDeveloped > 0 && prev.pCut === 0) say(`⚡ 발전소와 이어지지 않은 건물 ${P.cutDeveloped}곳에 전기가 끊겼어요. 도로 연결을 확인하세요. (클릭하면 이동)`, 'warn', P.firstCut);
  S._supplyAlert = { pShort: P.short, wShort: W.short, pIdle: P.idleSources.length, wIdle: W.idleSources.length, pCut: P.cutDeveloped, wCut: W.cutDeveloped };
}

function growTile(t, d) {
  if (t.flooded) return;
  if (!t.road) {
    if (t.level > 0 && Math.random() < 0.3) { t.level--; markGrowthDirty(); }
    return;
  }
  if (!t.powered) {
    t.noPower++;
    if (t.level > 0 && t.noPower > 3 && Math.random() < 0.25) { t.level--; markGrowthDirty(); }
    return;
  }
  t.noPower = 0;
  let des;
  if (t.type === 'res') des = (t.land - 35) / 80 - t.poll / 120 - t.crime / 160;
  else if (t.type === 'com') des = (t.land - 30) / 100 - t.crime / 150;
  else des = 0.08 - t.crime / 200 - (t.land - 50) / 300;
  const score = d + des;
  const growthFactor = t.type === 'com' && (t.nearbyTraffic || 0) >= 85 ? 0.5 : 1;
  if (score > 0 && t.level < 3 && (t.garbage || 0) < 70 && Math.random() < score * 0.35 * growthFactor) {
    if (t.level >= 1 && !t.watered) return;
    if (t.level === 2) {
      if (t.type === 'res' && t.land < 48) return;
      if (t.type === 'com' && t.land < 52) return;
    }
    t.level++;
    markGrowthDirty();
  } else if (score < -0.3 && t.level > 0 && Math.random() < -score * 0.12) {
    t.level--;
    markGrowthDirty();
  }
}

function isBurnable(t) {
  if (!t.type || t.type === 'road' || t.type === 'rubble' || t.fire > 0) return false;
  if (DEFS[t.type] && DEFS[t.type].zone) return t.level > 0;
  return t.type !== 'park' && t.type !== 'levee';
}

function fireTargets(i) {
  const t = S.tiles[i];
  return t.root >= 0 ? S.tiles.map((tt, j) => tt.root === t.root ? j : -1).filter(j => j >= 0) : [i];
}

function startFire(i) {
  for (const j of fireTargets(i)) S.tiles[j].fire = 14;
  markLayoutDirty();
}

function fireStep(i) {
  const t = S.tiles[i];
  const targets = fireTargets(i);
  const cov = S.cov.fire[i];
  if (cov > 0.2 && Math.random() < 0.15 + cov * 0.4) {
    for (const j of targets) {
      const tt = S.tiles[j];
      tt.fire = 0;
      if (tt.level > 1) tt.level--;
    }
    markLayoutDirty();
    return;
  }
  // 번짐은 기존처럼 각 점유 칸의 경계에서 검사
  for (const j of targets) {
    if (Math.random() < 0.08 * (1 - S.cov.fire[j])) {
      const [dx, dy] = DIR4[(Math.random() * 4) | 0];
      const x = j % MAP_W + dx, y = ((j / MAP_W) | 0) + dy;
      if (inMap(x, y)) {
        const ni = idx(x, y);
        if (isBurnable(S.tiles[ni])) startFire(ni);
      }
    }
  }
  const remaining = Math.max(0, t.fire - 1);
  for (const j of targets) {
    const tt = S.tiles[j];
    tt.fire = remaining;
    if (remaining === 0) {
      tt.type = 'rubble'; tt.root = -1; tt.level = 0;
      tt.upgrade = 0;
      tt.landfillStored = 0;
    }
  }
  if (remaining === 0) markLayoutDirty();
}

// 도시 행정비: 인구 300명까지는 없고, 도시가 커질수록 더 가파르게 늘어난다
// (중후반에 돈이 끝없이 쌓이지 않도록 하는 장치)
function adminCost(pop) {
  if (pop <= 300) return 0;
  return Math.round((pop - 300) * 0.09 + Math.pow(pop / 1000, 1.5) * 75);
}

// 난이도별 배율 (없는 난이도는 보통 기준)
function difficultyRule(key) {
  const d = (S && DIFFICULTY[S.difficulty]) || DIFFICULTY.normal;
  return Number.isFinite(d[key]) ? d[key] : 1;
}
function difficultyReward(amount) { return Math.round(amount * difficultyRule('reward')); }
function applyDifficultyUpkeep(exp) {
  const mul = difficultyRule('upkeep');
  if (mul !== 1) for (const k in exp) exp[k] = Math.round(exp[k] * mul * 10) / 10;
  return exp;
}

function operatingCostScale(pop) {
  const r = typeof OPERATING_COSTS !== 'undefined' ? OPERATING_COSTS : null;
  if (!r) return 0;
  return Math.max(0, Math.min(1, ((pop || 0) - r.startPop) / (r.fullPop - r.startPop)));
}

// 사용량 기반 운영비: 화력 연료비(태양광은 없음)·정수비·쓰레기 처리비·주민 1명당 공공 서비스 운영비
function operatingCosts() {
  const rates = typeof OPERATING_COSTS !== 'undefined' ? OPERATING_COSTS : null;
  const out = { fuel: 0, water: 0, waste: 0, services: 0, served: {} };
  if (!rates || !S) return out;
  const st = S.stats;
  // 화력 비중: 운영 중인 발전 시설 용량 중 화력 발전소 몫만큼 연료비를 낸다
  let coal = 0, total = 0;
  for (let i = 0; i < S.tiles.length; i++) {
    const t = S.tiles[i];
    if (!t.type || t.root !== i || !DEFS[t.type]?.powerCap) continue;
    const cap = facilityDefinition(t, i).powerCap || 0;
    total += cap;
    if (t.type === 'power') coal += cap;
  }
  out.fuel = total > 0 ? (st.powerUse || 0) * (coal / total) * rates.fuel : 0;
  out.water = (st.waterUse || 0) * rates.water;
  const w = typeof WASTE !== 'undefined' && S.waste ? S.waste : null;
  if (w) out.waste = (w.landfilled || 0) * rates.waste.landfill + (w.incinerated || 0) * rates.waste.incinerator + (w.recycled || 0) * rates.waste.recycling;
  // 각 서비스 범위 안에 사는 주민 수 (같은 서비스가 겹쳐도 주민은 한 번만 센다)
  for (const key of Object.keys(rates.services)) out.served[key] = 0;
  for (let i = 0; i < S.tiles.length; i++) {
    const t = S.tiles[i];
    if (t.type !== 'res' || !t.level) continue;
    const people = ZONE_CAP.res[t.level];
    for (const key of Object.keys(rates.services)) if (S.cov[key] && S.cov[key][i] > 0) out.served[key] += people;
  }
  for (const [key, rate] of Object.entries(rates.services)) out.services += out.served[key] * rate;
  out.scale = operatingCostScale(st.pop);
  for (const k of ['fuel', 'water', 'waste', 'services']) out[k] = Math.round(out[k] * out.scale * 10) / 10;
  return out;
}

function monthTick() {
  const newsBefore = { milestone: S.milestone, offerCounter: S.civic?.eventCounter || 0 };
  const previousSeason = typeof AMBIENCE !== 'undefined' ? AMBIENCE.season(S.month) : null;
  if (S.netDirty || S.layoutDirty) {
    recomputeNetworks();
    recomputeCoverage();
  }
  if (typeof TRAFFIC !== 'undefined') TRAFFIC.recompute();
  computeStats();
  // 재정
  const st = S.stats;
  const tx = S.taxes;
  const incRes = st.pop * tx.res / 100 * TAX_BASE.res;
  const incCom = st.employedCom * tx.com / 100 * TAX_BASE.com;
  const incInd = st.employedInd * tx.ind / 100 * TAX_BASE.ind;
  const exp = {};
  let roads = 0;
  let incFacilities = 0;
  for (let i = 0; i < S.tiles.length; i++) {
    const t = S.tiles[i];
    if (!t.type) continue;
    if (t.type === 'road') { roads += t.lanes === 2 ? DEFS.avenue.upkeep : DEFS.road.upkeep; continue; }
    if (t.root === i) {
      const d = facilityDefinition(t, i);
      exp[t.type] = (exp[t.type] || 0) + d.upkeep;
      if (isFacilityOperating(t, i)) incFacilities += (d.monthlyIncome || 0)
        * (typeof TRAFFIC !== 'undefined' ? t.trafficJobFill || 0 : st.jobFillRate);
    }
  }
  exp.road = roads;
  exp.admin = adminCost(st.pop);
  const ops = operatingCosts();
  exp.fuel = ops.fuel; exp.waterOps = ops.water; exp.wasteOps = ops.waste; exp.services = ops.services;
  applyDifficultyUpkeep(exp);
  if (typeof CIVIC !== 'undefined') exp.civic = CIVIC.monthSettlementCost ? CIVIC.monthSettlementCost() : CIVIC.monthlyCost();
  const baseIncome = incRes + incCom + incInd + incFacilities;
  // 이벤트 수입 효과는 실제 적용된 날짜만 반영하며 만료된 부분 월도 정산한다.
  const incomeMultiplier = typeof CIVIC !== 'undefined' && CIVIC.incomeMultiplierForMonth
    ? CIVIC.incomeMultiplierForMonth() * (typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.modifiers().income ?? 1 : 1)
    : simulationModifiers().income;
  const incBonus = baseIncome * (incomeMultiplier - 1);
  const incTransit = typeof TRANSIT !== 'undefined' ? S.transit?.fare || 0 : 0;
  const income = baseIncome + incBonus + incTransit;
  const loanSettlement = typeof FINANCE !== 'undefined' ? FINANCE.onMonth() : { payment: 0, principal: 0, interest: 0, paidOff: [] };
  exp.loans = loanSettlement.payment;
  const expense = Object.values(exp).reduce((a, b) => a + b, 0);
  S.money += income - expense;
  S.budget = { incRes, incCom, incInd, incFacilities, incBonus, incTransit, exp, income, expense,
    loanPrincipal: loanSettlement.principal, loanInterest: loanSettlement.interest, loanPaidOff: loanSettlement.paidOff };
  st.income = income; st.expense = expense;
  if (typeof CIVIC !== 'undefined' && CIVIC.settleMonth) CIVIC.settleMonth();
  if (typeof WASTE !== 'undefined') WASTE.onMonth();
  S.layoutDirty = false;
  S.servicesDirty = false;

  recomputeMaps();
  computeStats();
  if (typeof CIVIC !== 'undefined') CIVIC.onMonth();
  if (typeof DISASTER !== 'undefined') {
    DISASTER.onMonth();
    if (S.layoutDirty) recomputeAll();
  }

  // 화재
  for (let i = 0; i < S.tiles.length; i++) {
    const t = S.tiles[i];
    if (!isBurnable(t) || (t.root >= 0 && t.root !== i)) continue;
    const base = t.type === 'ind' ? 0.0008 : 0.0003;
    if (Math.random() < base * (1 - S.cov.fire[i]) * (t.level || 1)) {
      startFire(i);
      notify(`🔥 화재 발생! (${i % MAP_W}, ${(i / MAP_W) | 0})`, 'bad', i % MAP_W, (i / MAP_W) | 0);
    }
  }

  // 기록
  S.history.push({ pop: st.pop, money: Math.round(S.money), y: S.year, m: S.month });
  if (S.history.length > 240) S.history.shift();

  // 경고
  S.warnCool = S.warnCool || {};
  const warn = (key, cond, msg, at) => {
    if (typeof NEWS !== 'undefined') return; // 월간 운영 조언은 신문으로 모은다.
    if (cond && !(S.warnCool[key] > 0)) { notify(msg, 'warn', at === undefined ? undefined : at % MAP_W, at === undefined ? undefined : (at / MAP_W) | 0); S.warnCool[key] = 6; }
    if (S.warnCool[key] > 0) S.warnCool[key]--;
  };
  const pn = st.powerNet, wn = st.waterNet;
  warn('traffic', S.traffic && S.traffic.congestedRoads > 10, '🚗 도로가 막히고 있어요. 큰길로 넓히거나 우회 도로를 만드세요. (클릭하면 이동)', S.traffic?.worstRoad);
  warn('power', pn && pn.short === 0 && pn.linkedCap > 0 && st.powerUse > pn.linkedCap * 0.92, '⚡ 전력이 거의 바닥났어요. 곧 정전이 시작돼요. 발전소를 더 지으세요.');
  warn('water', wn && wn.short === 0 && wn.linkedCap > 0 && st.waterUse > wn.linkedCap * 0.92, '💧 물 공급이 거의 바닥났어요. 급수탑이나 양수장을 더 지으세요.');
  warn('nowater', st.pop > 150 && st.waterCap === 0, '💧 물이 없으면 건물이 커지지 않아요. 급수탑을 도로 옆에 지으세요.');
  warn('nopower', st.powerCap === 0 && S.tiles.some(t => t.type === 'res'), '⚡ 구역이 자라려면 전기가 필요해요. 발전소를 도로 옆에 지으세요.');
  if (S.money < 0) {
    S.negMonths++;
    if (typeof NEWS === 'undefined') notify(`💸 적자 상태입니다! 세금을 올리거나 지출을 줄이세요. (${S.negMonths}개월째)`, 'bad');
  } else S.negMonths = 0;

  // 마일스톤
  while (S.milestone < MILESTONES.length && st.pop >= MILESTONES[S.milestone].pop) {
    const m = MILESTONES[S.milestone];
    const reward = difficultyReward(m.reward);
    S.money += reward;
    if (typeof SOUND !== 'undefined') SOUND.play('reward');
    if (typeof NEWS === 'undefined') notify(`🎉 '${m.title}' 달성! 인구 ${m.pop.toLocaleString()}명 · 보상 ₩${reward.toLocaleString()}`, 'good');
    S.milestone++;
  }
  if (typeof ACHIEVEMENTS !== 'undefined') ACHIEVEMENTS.onMonth();
  // 해금 알림
  for (const k in DEFS) {
    const d = DEFS[k];
    if (d.unlock && !S.unlockedSeen[k] && isUnlocked(k)) {
      S.unlockedSeen[k] = true;
      notify(`🔓 새 건물 해금: ${d.icon} ${d.name}`, 'good');
    }
  }

  // 해당 월의 마일스톤 보상까지 반영한 뒤 도전 기한과 목표를 판정한다.
  if (typeof FINANCE !== 'undefined' && FINANCE.checkCrisis()
    && typeof UI !== 'undefined' && UI.openFinanceCrisis) UI.openFinanceCrisis();
  if (typeof DEVELOPMENT !== 'undefined') DEVELOPMENT.onMonth();
  if (typeof NEWS !== 'undefined') NEWS.onMonth(newsBefore);
  S.month++;
  if (S.month > 12) { S.month = 1; S.year++; }
  if (typeof AMBIENCE !== 'undefined' && AMBIENCE.season(S.month) !== previousSeason) {
    recomputeNetworks(); recomputeCoverage(); recomputeMaps(); computeStats();
    S.servicesDirty = true;
  }
  if (S.month % 6 === 1) saveGame(true);
}

function cityTitle() {
  let t = '정착지';
  for (let i = 0; i < S.milestone; i++) t = MILESTONES[i].title;
  return t;
}

// ---------- 저장/불러오기 ----------
const SAVE_KEY = 'citysim_save_v1';
function serializeCity() {
    if (!S || !Number.isFinite(S.money)) throw new Error('도시 자금이 올바르지 않아 기존 저장을 유지합니다.');
    const tiles = S.tiles.map(t => [t.t, t.tree ? 1 : 0, t.type || 0, t.root, t.level, t.fire, t.upgrade || 0, t.lanes === undefined ? 1 : t.lanes,
      t.garbage === undefined ? 0 : t.garbage, t.landfillStored === undefined ? 0 : t.landfillStored]);
    return {
      version: 1, name: S.name, difficulty: S.difficulty, seed: S.seed,
      money: S.money, year: S.year, month: S.month, day: S.day, startedAt: S.startedAt ?? null,
      taxes: S.taxes, history: S.history, milestone: S.milestone,
      unlockedSeen: S.unlockedSeen, negMonths: S.negMonths, tiles,
      loans: S.loans || [], finance: S.finance,
      waste: typeof WASTE !== 'undefined' ? WASTE.normalize(S.waste) : undefined,
      news: typeof NEWS !== 'undefined' ? NEWS.normalize(S.news) : undefined,
      achievements: typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.normalize(S.achievements) : undefined,
      disasterMode: S.disasterMode || 'rare',
      disasters: typeof DISASTER !== 'undefined' ? DISASTER.normalize(S.disasters) : undefined,
      civic: S.civic, development: S.development,
      traffic: typeof TRAFFIC !== 'undefined' ? { version: 1 } : undefined,
      transit: typeof TRANSIT !== 'undefined' ? { version: 1 } : undefined,
    };
}
function saveGame(auto) {
  if (typeof SAVES !== 'undefined') {
    const result = SAVES.save(auto ? 'auto' : SAVES.lastSlot);
    notify(result.ok ? (auto ? '💾 자동 저장됨' : '💾 저장 완료') : '저장 실패: ' + result.reason, result.ok ? 'info' : 'bad');
    return result.ok;
  }
  try {
    const data = serializeCity();
    validateCityRecord(data);
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    notify(auto ? '💾 자동 저장됨' : '💾 저장 완료', 'info');
    return true;
  } catch (e) {
    notify('저장 실패: ' + e.message, 'bad');
    return false;
  }
}
function hasSave() {
  if (typeof SAVES !== 'undefined') return SAVES.hasAny();
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

// 슬롯 조회와 가져오기는 현재 도시를 건드리지 않는 동일한 검사기를 사용한다.
function validateCityRecord(input) {
    const d = typeof input === 'string' ? JSON.parse(input) : input;
    const integerInRange = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.version !== 1 || typeof d.name !== 'string' || !Object.hasOwn(DIFFICULTY, d.difficulty)
      || !Number.isFinite(d.money) || !integerInRange(d.year, 1, Number.MAX_SAFE_INTEGER)
      || !integerInRange(d.month, 1, 12) || !integerInRange(d.day, 1, 30)
      || !d.taxes || !['res', 'com', 'ind'].every(k => Number.isFinite(d.taxes[k]))
      || (d.history != null && !Array.isArray(d.history))
      || !integerInRange(d.milestone || 0, 0, MILESTONES.length)
      || !Array.isArray(d.tiles) || d.tiles.length !== MAP_W * MAP_H) {
      throw new Error('저장 데이터 형식이 올바르지 않습니다.');
    }
    if ((d.savedAt !== undefined && !integerInRange(d.savedAt, 0, Number.MAX_SAFE_INTEGER))
      || (d.startedAt != null && (!Number.isSafeInteger(d.startedAt) || d.startedAt < 0
        || d.startedAt > d.year * 12 + d.month - 1))
      || (d.disasterMode !== undefined && !['off', 'rare', 'frequent'].includes(d.disasterMode))
      || (d.negMonths !== undefined && !integerInRange(d.negMonths, 0, Number.MAX_SAFE_INTEGER))
      || (d.unlockedSeen !== undefined && (!d.unlockedSeen || typeof d.unlockedSeen !== 'object' || Array.isArray(d.unlockedSeen)
        || !Object.values(d.unlockedSeen).every(v => typeof v === 'boolean')))) {
      throw new Error('저장된 도시 기록이 올바르지 않습니다.');
    }
    const history = d.history || [];
    const validHistoryNumber = v => Number.isFinite(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
    if (history.length > 240 || !history.every(h => h && typeof h === 'object' && !Array.isArray(h)
      && validHistoryNumber(h.pop) && h.pop >= 0 && validHistoryNumber(h.money)
      && integerInRange(h.y, 1, Number.MAX_SAFE_INTEGER) && integerInRange(h.m, 1, 12))) {
      throw new Error('저장된 월별 기록 데이터가 올바르지 않습니다.');
    }
    if (!d.tiles.every((a, i) => {
      if (!Array.isArray(a) || a.length < 5) return false;
      const type = a[2];
      const validType = type === 0 || type === null || type === 'rubble'
        || (typeof type === 'string' && type !== 'avenue' && Object.hasOwn(DEFS, type) && DEFS[type].cat !== 'tool');
      return integerInRange(a[0], TERRAIN.GRASS, TERRAIN.SAND)
        && (a[1] === 0 || a[1] === 1) && validType
        && integerInRange(a[3], -1, MAP_W * MAP_H - 1)
        && integerInRange(a[4], 0, 3)
        && integerInRange(a[5] === undefined ? 0 : a[5], 0, 14)
        && integerInRange(a[6] === undefined ? 0 : a[6], 0, 2)
        && integerInRange(a[7] === undefined ? 1 : a[7], 1, 2)
        && (type === 'road' || a[7] === undefined || a[7] === 1)
        && (a[8] === undefined || (Number.isFinite(a[8]) && a[8] >= 0 && a[8] <= 100))
        && (a[9] === undefined || (Number.isFinite(a[9]) && a[9] >= 0 && a[9] <= DEFS.landfill.wasteCapacity
          && (a[9] === 0 || (type === 'landfill' && a[3] === i))));
    })) {
      throw new Error('저장된 지도 데이터가 올바르지 않습니다.');
    }
    const candidate = {
      version: 1, name: d.name, difficulty: d.difficulty, seed: d.seed,
      money: d.money, year: d.year, month: d.month, day: d.day, startedAt: d.startedAt ?? null,
      taxes: { ...d.taxes }, history: history.map(h => ({ ...h })), milestone: d.milestone || 0,
      unlockedSeen: { ...d.unlockedSeen }, negMonths: d.negMonths || 0, budget: null,
      loans: typeof FINANCE !== 'undefined' ? FINANCE.normalizeLoans(d.loans) : [],
      finance: typeof FINANCE !== 'undefined' ? FINANCE.normalize(d.finance) : undefined,
      waste: typeof WASTE !== 'undefined' ? WASTE.normalize(d.waste) : undefined,
      news: typeof NEWS !== 'undefined' ? NEWS.normalize(d.news) : undefined,
      achievements: typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.normalize(d.achievements) : undefined,
      disasterMode: d.disasterMode === undefined ? 'rare' : d.disasterMode,
      disasters: typeof DISASTER !== 'undefined' ? DISASTER.normalize(d.disasters) : undefined,
      civic: typeof CIVIC !== 'undefined' ? CIVIC.normalize(d.civic) : undefined,
      development: typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.normalize(d.development) : undefined,
      traffic: typeof TRAFFIC !== 'undefined' ? TRAFFIC.normalize(d.traffic) : undefined,
      transit: typeof TRANSIT !== 'undefined' ? TRANSIT.normalize(d.transit) : undefined,
      tiles: d.tiles,
    };
    if (typeof FINANCE !== 'undefined') {
      const month = candidate.year * 12 + candidate.month - 1;
      if (!Number.isSafeInteger(month) || candidate.loans.some(loan => loan.takenAt > month)
        || ['lastPaymentMonth', 'lastCrisisMonth'].some(key => candidate.finance[key] !== null && candidate.finance[key] > month)) {
        throw new Error('저장된 채권 날짜가 도시 날짜보다 늦습니다.');
      }
    }
    if (typeof WASTE !== 'undefined') {
      const month = candidate.year * 12 + candidate.month - 1;
      if (!Number.isSafeInteger(month) || (candidate.waste.lastMonth !== null && candidate.waste.lastMonth > month)) {
        throw new Error('저장된 쓰레기 처리 날짜가 도시 날짜보다 늦습니다.');
      }
    }
    if (typeof NEWS !== 'undefined') {
      const month = candidate.year * 12 + candidate.month - 1;
      const dates = [candidate.news.lastMonth, ...Object.values(candidate.news.lastKinds),
        ...candidate.news.items.map(item => item.year * 12 + item.month - 1)].filter(value => value !== null);
      if (!Number.isSafeInteger(month) || dates.some(value => !Number.isSafeInteger(value) || value > month)) {
        throw new Error('저장된 뉴스 날짜가 도시 날짜보다 늦습니다.');
      }
    }
    if (typeof ACHIEVEMENTS !== 'undefined') {
      const month = candidate.year * 12 + candidate.month - 1, state = candidate.achievements;
      if (Object.values(state.unlocked).some(value => value > month) || (state.recover && state.recover.at > month)) {
        throw new Error('저장된 업적 날짜가 도시 날짜보다 늦습니다.');
      }
    }
    if (typeof DISASTER !== 'undefined') {
      const month = candidate.year * 12 + candidate.month - 1, state = candidate.disasters;
      const eventMonth = state.lastEvent ? state.lastEvent.year * 12 + state.lastEvent.month - 1 : null;
      if (!Number.isSafeInteger(month) || [state.lastMonth, eventMonth]
        .some(value => value !== null && (!Number.isSafeInteger(value) || value > month))) {
        throw new Error('저장된 재난 날짜가 도시 날짜보다 늦습니다.');
      }
    }
    return candidate;
}

function parseCity(input) {
  const city = validateCityRecord(input);
  // 저장 검사와 실제 로드가 같은 검사를 거친다. 게임용 타일은 로드할 때만 만든다.
  city.tiles = city.tiles.map(a => {
    const t = newTile(a[0]);
    t.tree = !!a[1]; t.type = a[2] || null; t.root = a[3]; t.level = a[4]; t.fire = a[5] || 0;
    t.upgrade = a[6] || 0;
    t.lanes = a[7] === undefined ? 1 : a[7];
    t.garbage = a[8] === undefined ? 0 : a[8];
    t.landfillStored = a[9] === undefined ? 0 : a[9];
    return t;
  });
  return city;
}

function loadCity(input) {
  const previous = S;
  try {
    S = parseCity(input); // 파생 데이터 계산은 동기식이며 실패하면 기존 도시를 복원
    initDerived();
    return true;
  } catch (e) {
    S = previous;
    console.error(e);
    return false;
  }
}

function loadGame() {
  if (typeof SAVES !== 'undefined') return SAVES.loadLatest().ok;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? loadCity(raw) : false;
  } catch (e) {
    console.error(e);
    return false;
  }
}
