// ===== 재난 상태와 피해. 화면 효과는 visual을 읽는 렌더러가 담당 =====
const DISASTER = {
  visual: null,
  _city: null,
  _eventId: 0,
  chances: { flood: .02, quake: .002, typhoon: .015 },

  normalize(raw) {
    const state = { version: 1, lastMonth: null, flood: null, storm: null, lastEvent: null };
    if (raw == null) return state;
    const fail = () => { throw new Error('저장된 재난 데이터가 올바르지 않습니다.'); };
    const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail();
    if (raw.lastMonth != null) {
      if (!integer(raw.lastMonth, 0, Number.MAX_SAFE_INTEGER)) fail();
      state.lastMonth = raw.lastMonth;
    }
    for (const [key, days] of [['flood', 10], ['storm', 3]]) {
      const active = raw[key];
      if (active == null) continue;
      if (typeof active !== 'object' || Array.isArray(active) || !integer(active.remaining, 1, days)
        || !Array.isArray(active.indices) || !active.indices.length || active.indices.length > MAP_W * MAP_H
        || !active.indices.every(i => integer(i, 0, MAP_W * MAP_H - 1))
        || new Set(active.indices).size !== active.indices.length) fail();
      state[key] = { indices: [...active.indices], remaining: active.remaining };
      if (key === 'storm') {
        if (!['x', 'y'].includes(active.axis) || !integer(active.start, 0, (active.axis === 'x' ? MAP_H : MAP_W) - 5)
          || active.indices.length !== (active.axis === 'x' ? MAP_W : MAP_H) * 5
          || !active.indices.every(i => { const coordinate = active.axis === 'x' ? Math.floor(i / MAP_W) : i % MAP_W;
            return coordinate >= active.start && coordinate < active.start + 5; })) fail();
        state.storm.axis = active.axis; state.storm.start = active.start;
      }
    }
    if (raw.lastEvent != null) {
      const event = raw.lastEvent;
      if (!event || typeof event !== 'object' || Array.isArray(event) || !['flood', 'quake', 'typhoon'].includes(event.kind)
        || typeof event.title !== 'string' || !event.title.length || event.title.length > 160
        || !integer(event.year, 1, Number.MAX_SAFE_INTEGER) || !integer(event.month, 1, 12)
        || !Number.isSafeInteger(event.year * 12 + event.month - 1)
        || !integer(event.x, 0, MAP_W - 1) || !integer(event.y, 0, MAP_H - 1)
        || !integer(event.damage, 0, MAP_W * MAP_H)) fail();
      state.lastEvent = Object.fromEntries(['kind', 'title', 'year', 'month', 'x', 'y', 'damage'].map(key => [key, event[key]]));
    }
    return state;
  },

  setMode(mode) {
    if (!['off', 'rare', 'frequent'].includes(mode)) return { ok: false, reason: '재난 설정이 올바르지 않아요.' };
    if (typeof S === 'undefined' || !S) return { ok: false, reason: '먼저 도시를 시작해 주세요.' };
    S.disasterMode = mode;
    return { ok: true };
  },

  _facility(t) { return !!t.type && t.root >= 0 && !!DEFS[t.type] && !DEFS[t.type].zone && t.type !== 'road'; },

  applyState() {
    if (!S) return;
    if (this._city !== S) { this._city = S; this.visual = null; }
    const flood = S.disasters?.flood, storm = S.disasters?.storm;
    const floodedRoots = new Set(), stormRoots = new Set();
    for (const t of S.tiles) {
      t.flooded = t.disasterDisabled = t.floodDisabled = t.stormDisabled = false;
      t.disasterDays = 0;
    }
    for (const i of flood?.indices || []) {
      const t = S.tiles[i];
      t.flooded = true; t.disasterDays = flood.remaining;
      if (this._facility(t)) floodedRoots.add(t.root);
    }
    for (const i of storm?.indices || []) {
      const t = S.tiles[i];
      if (this._facility(t) && t.type !== 'power') stormRoots.add(t.root);
    }
    for (const t of S.tiles) {
      if (!this._facility(t)) continue;
      t.floodDisabled = floodedRoots.has(t.root);
      t.stormDisabled = stormRoots.has(t.root);
      t.disasterDisabled = t.floodDisabled || t.stormDisabled;
      t.disasterDays = Math.max(t.disasterDays, t.floodDisabled ? flood.remaining : 0, t.stormDisabled ? storm.remaining : 0);
    }
  },

  tileStatus(i) {
    const t = S?.tiles[i];
    if (!t) return { floodDays: 0, stormDays: 0, stopped: false };
    return { floodDays: t.flooded || t.floodDisabled ? S.disasters?.flood?.remaining || 0 : 0,
      stormDays: t.stormDisabled ? S.disasters?.storm?.remaining || 0 : 0, stopped: !!(t.flooded || t.disasterDisabled) };
  },

  view() {
    if (typeof S === 'undefined' || !S) return { mode: 'rare', flood: null, storm: null, lastEvent: null, visual: null };
    const state = this.normalize(S.disasters);
    return { mode: S.disasterMode || 'rare', flood: state.flood, storm: state.storm, lastEvent: state.lastEvent, visual: this.visual };
  },

  _eligible(kind, manual) {
    if (!['flood', 'quake', 'typhoon'].includes(kind)) return '알 수 없는 재난입니다.';
    if (manual) return '';
    if (S.disasterMode === 'off') return '자동 재난이 꺼져 있어요.';
    if (Number.isSafeInteger(S.startedAt) && S.year * 12 + S.month - 1 - S.startedAt < 24) return '새 도시는 시작 후 24개월 동안 자동 재난이 발생하지 않아요.';
    if ((S.stats?.pop || 0) < 300) return '인구 300명 전에는 자동 재난이 발생하지 않아요.';
    if (kind === 'flood' && (S.month < 6 || S.month > 8) || kind === 'typhoon' && (S.month < 7 || S.month > 9)) return '이번 달은 해당 재난이 발생하는 계절이 아니에요.';
    return '';
  },

  onMonth() {
    const state = this.normalize(S.disasters), month = S.year * 12 + S.month - 1;
    if (!Number.isSafeInteger(month) || month < 0) throw new Error('재난 날짜가 올바르지 않습니다.');
    if (state.lastMonth !== null && state.lastMonth >= month) return [];
    state.lastMonth = month; S.disasters = state;
    const factor = S.disasterMode === 'frequent' ? 3 : 1, results = [];
    for (const [kind, chance] of Object.entries(this.chances)) {
      if (this._eligible(kind, false) || Math.random() >= chance * factor) continue;
      const result = this.trigger(kind);
      if (result.ok) results.push(result);
    }
    return results;
  },

  onDay() {
    if (!S?.disasters || !S.disasters.flood && !S.disasters.storm) return false;
    let changed = false;
    for (const key of ['flood', 'storm']) {
      const active = S.disasters[key];
      if (active && --active.remaining <= 0) { S.disasters[key] = null; changed = true; }
    }
    this.applyState();
    if (changed) { S.netDirty = true; S.layoutDirty = true; S.servicesDirty = true; }
    return changed;
  },

  _flood(state) {
    if (state.flood) return { ok: false, reason: '이미 홍수가 진행 중이에요.' };
    const protectedTiles = new Set(), affected = new Set();
    for (let i = 0; i < S.tiles.length; i++) {
      if (S.tiles[i].type !== 'levee') continue;
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      protectedTiles.add(i);
      for (const [dx, dy] of DIR4) {
        if (!inMap(x + dx, y + dy) || S.tiles[idx(x + dx, y + dy)].t !== TERRAIN.WATER) continue;
        for (let distance = 1; distance <= 2; distance++) if (inMap(x - dx * distance, y - dy * distance)) protectedTiles.add(idx(x - dx * distance, y - dy * distance));
      }
    }
    for (let i = 0; i < S.tiles.length; i++) {
      if (S.tiles[i].t !== TERRAIN.WATER) continue;
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 2 || !inMap(x + dx, y + dy)) continue;
        const next = idx(x + dx, y + dy), t = S.tiles[next];
        if (!protectedTiles.has(next) && (t.t !== TERRAIN.WATER || t.type === 'road')) affected.add(next);
      }
    }
    const indices = [...affected].sort((a, b) => a - b);
    if (!indices.length) return { ok: false, reason: '침수될 물가 지역이 없어요.' };
    const buildings = new Set();
    for (const i of indices) {
      const t = S.tiles[i];
      if (DEFS[t.type]?.zone && t.level > 0) t.level--;
      if (t.type && t.type !== 'rubble') buildings.add(t.root >= 0 ? t.root : i);
    }
    state.flood = { indices, remaining: 5 + Math.floor(Math.random() * 6) };
    const location = indices.find(i => S.tiles[i].type) ?? indices[0];
    return { ok: true, x: location % MAP_W, y: Math.floor(location / MAP_W), damage: buildings.size,
      title: '홍수 피해 발생', message: `🌊 홍수: ${indices.length}칸 침수 · ${buildings.size}곳 피해 · ${state.flood.remaining}일 뒤 복구` };
  },

  _quake() {
    const land = [];
    for (let i = 0; i < S.tiles.length; i++) if (S.tiles[i].t !== TERRAIN.WATER) land.push(i);
    if (!land.length) return { ok: false, reason: '지진이 발생할 땅이 없어요.' };
    const center = land[Math.floor(Math.random() * land.length)], x = center % MAP_W, y = Math.floor(center / MAP_W);
    const radius = 6 + Math.floor(Math.random() * 5), roots = new Set();
    for (let ny = Math.max(0, y - radius); ny <= Math.min(MAP_H - 1, y + radius); ny++) {
      for (let nx = Math.max(0, x - radius); nx <= Math.min(MAP_W - 1, x + radius); nx++) {
        if (Math.hypot(nx - x, ny - y) > radius) continue;
        const i = idx(nx, ny), t = S.tiles[i];
        if (DEFS[t.type]?.zone && t.level > 0 || this._facility(t)) roots.add(t.root >= 0 ? t.root : i);
      }
    }
    let damage = 0, fires = 0;
    for (const root of roots) {
      const t = S.tiles[root], size = this._facility(t) ? DEFS[t.type].size : 1;
      const base = this._facility(t) ? .15 : [0, .1, .2, .35][t.level];
      if (Math.random() >= base * (S.cov?.hospital?.[root] > 0 ? .6 : 1)) continue;
      damage++;
      const rx = root % MAP_W, ry = Math.floor(root / MAP_W);
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        const i = idx(rx + dx, ry + dy), tile = S.tiles[i];
        tile.type = 'rubble'; tile.root = -1; tile.level = tile.upgrade = tile.landfillStored = tile.fire = tile.noPower = 0; tile.lanes = 1;
        if (Math.random() < .1 * (S.cov?.fire?.[i] > 0 ? .5 : 1)) { tile.fire = 14; fires++; }
      }
    }
    return { ok: true, x, y, radius, damage, title: '지진 피해 발생', message: `🌎 지진: 건물 ${damage}곳 붕괴 · 화재 ${fires}곳` };
  },

  _typhoon(state) {
    if (state.storm) return { ok: false, reason: '이미 태풍 피해를 복구 중이에요.' };
    const axis = Math.random() < .5 ? 'x' : 'y', start = Math.floor(Math.random() * ((axis === 'x' ? MAP_H : MAP_W) - 4));
    const indices = [], buildings = new Set();
    let trees = 0, zones = 0;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const coordinate = axis === 'x' ? y : x;
      if (coordinate < start || coordinate >= start + 5) continue;
      const i = idx(x, y), t = S.tiles[i]; indices.push(i);
      if (t.tree && Math.random() < .5) { t.tree = false; trees++; }
      if (DEFS[t.type]?.zone && t.level === 1 && Math.random() < .2) { t.level = 0; zones++; }
      if (this._facility(t) && t.type !== 'power') buildings.add(t.root);
    }
    state.storm = { indices, remaining: 3, axis, start };
    return { ok: true, x: axis === 'x' ? Math.floor(MAP_W / 2) : start + 2, y: axis === 'x' ? start + 2 : Math.floor(MAP_H / 2),
      axis, center: start + 2.5, width: 5, damage: trees + zones + buildings.size,
      title: '태풍 피해 발생', message: `🌀 태풍: 나무 ${trees}그루 · 구역 ${zones}곳 피해 · 시설 ${buildings.size}곳 3일 정지` };
  },

  trigger(kind, options = {}) {
    if (typeof S === 'undefined' || !S) return { ok: false, reason: '먼저 도시를 시작해 주세요.' };
    const reason = this._eligible(kind, !!options.manual);
    if (reason) return { ok: false, reason };
    const state = this.normalize(S.disasters);
    const result = kind === 'flood' ? this._flood(state) : kind === 'quake' ? this._quake() : this._typhoon(state);
    if (!result.ok) return result;
    state.lastEvent = { kind, title: result.title, year: S.year, month: S.month, x: result.x, y: result.y, damage: result.damage };
    S.disasters = state; this.applyState(); S.netDirty = true; S.layoutDirty = true; S.servicesDirty = true;
    this.visual = { id: ++this._eventId, kind, x: result.x, y: result.y,
      ...(result.radius ? { radius: result.radius } : {}), ...(result.axis ? { axis: result.axis, center: result.center, width: 5 } : {}) };
    if (options.manual && typeof recomputeAll === 'function') recomputeAll();
    if (options.manual && typeof drawMinimap === 'function' && (typeof R === 'undefined' || R.mini && R.miniCtx)) drawMinimap();
    if (typeof notify === 'function') notify(result.message, 'bad', result.x, result.y);
    if (typeof SOUND !== 'undefined') SOUND.play('disaster');
    return { ok: true, kind, damage: result.damage };
  },
};
