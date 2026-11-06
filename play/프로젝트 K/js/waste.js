// ===== 같은 도로망의 쓰레기를 월 단위로 수거·처리 =====
const WASTE = {
  _landfillMap: null,

  normalize(raw) {
    const state = { version: 1, lastMonth: null, last: null, warnCool: { rate: 0, landfill: 0, landfill70: 0 } };
    if (raw == null) return state;
    const fail = () => { throw new Error('저장된 쓰레기 데이터가 올바르지 않습니다.'); };
    const amount = value => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail();
    if (raw.lastMonth != null) {
      if (!Number.isSafeInteger(raw.lastMonth) || raw.lastMonth < 0) fail();
      state.lastMonth = raw.lastMonth;
    }
    if (raw.warnCool !== undefined) {
      if (!raw.warnCool || typeof raw.warnCool !== 'object' || Array.isArray(raw.warnCool)) fail();
      for (const key of ['rate', 'landfill', 'landfill70']) {
        const value = raw.warnCool[key] === undefined ? 0 : raw.warnCool[key];
        if (!Number.isInteger(value) || value < 0 || value > 6) fail();
        state.warnCool[key] = value;
      }
    }
    if (raw.last != null) {
      const report = raw.last;
      if (typeof report !== 'object' || Array.isArray(report)) fail();
      const keys = ['generated', 'processed', 'total', 'rate', 'recycled', 'incinerated', 'landfilled'];
      if (!keys.every(key => amount(report[key])) || report.processed > report.total + 1e-7
        || report.generated > report.total + 1e-7 || report.rate > 1
        || Math.abs(report.processed - report.recycled - report.incinerated - report.landfilled) > 1e-7
        || Math.abs(report.rate - (report.total ? report.processed / report.total : 1)) > 1e-7) fail();
      state.last = Object.fromEntries(keys.map(key => [key, report[key]]));
      const currentKeys = ['currentProcessed', 'currentRate', 'backlogProcessed'];
      if (currentKeys.some(key => report[key] !== undefined)) {
        if (!currentKeys.every(key => amount(report[key])) || report.currentProcessed > report.generated + 1e-7
          || report.backlogProcessed > report.total - report.generated + 1e-7 || report.currentRate > 1
          || Math.abs(report.currentProcessed + report.backlogProcessed - report.processed) > 1e-7
          || Math.abs(report.currentRate - (report.generated ? report.currentProcessed / report.generated : 1)) > 1e-7) fail();
        for (const key of currentKeys) state.last[key] = report[key];
      }
    }
    return state;
  },

  penalty(tile) { return (tile?.garbage || 0) >= 40 ? Math.min(15, tile.garbage * .15) : 0; },
  landfillPenalty(i) { return this._landfillMap?.[i] || 0; },

  sourceEntry(i, size, network) {
    const entry = TRAFFIC.entry(i, size, network);
    if (entry >= 0) return entry;
    if (this._sourceTopology !== network) { this._sourceTopology = network; this._sourceEntries = new Map(); }
    const key = `${i}:${size}`;
    if (this._sourceEntries.has(key)) return this._sourceEntries.get(key);
    const x = i % MAP_W, y = Math.floor(i / MAP_W);
    let best = -1;
    const check = (nx, ny) => {
      if (!inMap(nx, ny)) return;
      const next = idx(nx, ny);
      if (network.mask[next] && (best < 0 || next < best)) best = next;
    };
    // 기본 접근 2칸 밖의 거리 3 테두리만 검사한다. 한 칸 시설·구역은 12칸이다.
    for (let dy = -3; dy <= size + 2; dy++) {
      const distanceY = Math.max(-dy, 0, dy - size + 1), distanceX = 3 - distanceY;
      if (!distanceX) for (let dx = 0; dx < size; dx++) check(x + dx, y + dy);
      else { check(x - distanceX, y + dy); check(x + size - 1 + distanceX, y + dy); }
    }
    this._sourceEntries.set(key, best);
    return best;
  },

  _plan() {
    const network = TRAFFIC.topology(), facilities = [], sources = [], groups = new Map();
    const landfillMap = new Uint8Array(S.tiles.length);
    for (let i = 0; i < S.tiles.length; i++) {
      const t = S.tiles[i];
      if (!['recycling', 'incinerator', 'landfill'].includes(t.type) || t.root !== i) continue;
      const d = facilityDefinition(t, i), entry = TRAFFIC.entry(i, d.size, network);
      const capacity = d.wasteCapacity || d.wasteProcess, stored = t.type === 'landfill' ? t.landfillStored || 0 : 0;
      const remaining = Math.max(0, capacity - stored);
      let reason = '';
      if (t.fire > 0) reason = '화재로 운영 중단';
      else if (t.flooded || t.disasterDisabled) reason = '재난으로 운영 중단';
      else if (!t.road || entry < 0) reason = '도로 연결 필요';
      else if (d.powerUse > 0 && !t.powered) reason = '전력 공급 필요';
      else if (!isFacilityOperating(t, i)) reason = '기반 시설 연결 필요';
      else if (!remaining) reason = '매립 용량 가득 참';
      facilities.push({ i, type: t.type, operating: !reason, reason, capacity, stored, remaining,
        component: entry >= 0 ? network.component[entry] : -1, processed: 0 });
      if (t.type === 'landfill') {
        const cx = i % MAP_W + d.size / 2, cy = Math.floor(i / MAP_W) + d.size / 2;
        for (let y = Math.max(0, Math.floor(cy - 4)); y <= Math.min(MAP_H - 1, Math.ceil(cy + 4)); y++) {
          for (let x = Math.max(0, Math.floor(cx - 4)); x <= Math.min(MAP_W - 1, Math.ceil(cx + 4)); x++) {
            if (Math.hypot(x + .5 - cx, y + .5 - cy) <= 4) landfillMap[idx(x, y)] = 8;
          }
        }
      }
    }
    const reduction = Math.min(.3, facilities.filter(f => f.type === 'recycling' && f.operating).length * .15);
    const served = new Set(facilities.filter(f => f.operating).map(f => f.component));
    let generated = 0, backlog = 0, unservedResidential = 0;
    for (let i = 0; i < S.tiles.length; i++) {
      const t = S.tiles[i];
      let amount = 0, size = 1;
      if (t.type === 'res') amount = t.level * 2;
      else if (t.type === 'com') amount = t.level * 3;
      else if (t.type === 'ind') amount = t.level * 4;
      else if (t.type && t.type !== 'rubble' && t.type !== 'road' && DEFS[t.type]?.cat !== 'infra' && t.root === i) {
        size = facilityDefinition(t, i).size; amount = size * 3;
      }
      amount *= 1 - reduction;
      const accumulated = t.garbage || 0;
      if (!amount && !accumulated && t.type !== 'res') continue;
      const entry = this.sourceEntry(i, size, network), component = entry >= 0 ? network.component[entry] : -1;
      // Empty residential zones keep this placement-derived guide check valid while buildings grow.
      if (t.type === 'res' && !served.has(component)) unservedResidential++;
      if (!amount && !accumulated) continue;
      const source = { i, generated: amount, backlog: accumulated, total: amount + accumulated, component };
      generated += amount; backlog += accumulated; sources.push(source);
      if (component >= 0) {
        if (!groups.has(component)) groups.set(component, { total: 0, generated: 0, backlog: 0, processed: 0 });
        const group = groups.get(component);
        group.total += source.total; group.generated += amount; group.backlog += accumulated;
      }
    }
    const priority = { recycling: 0, incinerator: 1, landfill: 2 };
    const report = { generated, processed: 0, total: generated + backlog, rate: 1, recycled: 0, incinerated: 0, landfilled: 0,
      currentProcessed: 0, currentRate: 1, backlogProcessed: 0 };
    for (const f of [...facilities].sort((a, b) => priority[a.type] - priority[b.type] || a.i - b.i)) {
      const group = groups.get(f.component);
      if (!f.operating || !group) continue;
      f.processed = Math.min(f.remaining, Math.max(0, group.total - group.processed));
      group.processed += f.processed; report.processed += f.processed;
      report[{ recycling: 'recycled', incinerator: 'incinerated', landfill: 'landfilled' }[f.type]] += f.processed;
    }
    report.rate = report.total ? Math.min(1, report.processed / report.total) : 1;
    for (const group of groups.values()) {
      group.currentProcessed = Math.min(group.generated, group.processed);
      group.backlogProcessed = Math.max(0, group.processed - group.currentProcessed);
      report.currentProcessed += group.currentProcessed; report.backlogProcessed += group.backlogProcessed;
    }
    report.currentRate = generated ? Math.min(1, report.currentProcessed / generated) : 1;
    return { ...report, backlog, reduction, unservedResidential, facilities, sources, groups, landfillMap,
      landfillRemaining: facilities.filter(f => f.type === 'landfill').reduce((sum, f) => sum + f.remaining, 0) };
  },

  refresh() {
    if (!S) return null;
    const state = this.normalize(S.waste), plan = this._plan();
    this._landfillMap = plan.landfillMap;
    for (const t of S.tiles) { t.wasteOperating = false; t.wasteProcessed = t.wasteCapacity = 0; t.wasteReason = ''; }
    for (const f of plan.facilities) {
      const t = S.tiles[f.i];
      t.wasteOperating = f.operating; t.wasteProcessed = f.processed; t.wasteCapacity = f.capacity; t.wasteReason = f.reason;
    }
    const { sources, groups, landfillMap, ...summary } = plan;
    S.waste = { ...state, ...summary };
    return S.waste;
  },

  onMonth() {
    const state = this.normalize(S.waste), month = S.year * 12 + S.month - 1;
    if (!Number.isSafeInteger(month) || month < 0) throw new Error('쓰레기 처리 날짜가 올바르지 않습니다.');
    if (state.lastMonth !== null && state.lastMonth >= month) return state.last;
    const plan = this._plan();
    for (const source of plan.sources) {
      const group = plan.groups.get(source.component);
      const currentFraction = group?.generated ? Math.min(1, group.currentProcessed / group.generated) : 0;
      const backlogFraction = group?.backlog ? Math.min(1, group.backlogProcessed / group.backlog) : 0;
      const remaining = Math.max(0, source.generated * (1 - currentFraction) + source.backlog * (1 - backlogFraction));
      S.tiles[source.i].garbage = remaining < 1e-9 ? 0 : Math.min(100, remaining);
    }
    for (const f of plan.facilities) if (f.type === 'landfill') S.tiles[f.i].landfillStored = Math.min(f.capacity, f.stored + f.processed);
    state.lastMonth = month;
    state.last = Object.fromEntries(['generated', 'processed', 'total', 'rate', 'recycled', 'incinerated', 'landfilled', 'currentProcessed', 'currentRate', 'backlogProcessed'].map(key => [key, plan[key]]));
    for (const key of ['rate', 'landfill', 'landfill70']) state.warnCool[key] = Math.max(0, state.warnCool[key] - 1);
    const warn = (key, condition, message, i) => {
      if (!condition || state.warnCool[key]) return;
      state.warnCool[key] = 6;
      if (typeof NEWS === 'undefined' && typeof notify === 'function') notify(message, 'warn', i === undefined ? undefined : i % MAP_W, i === undefined ? undefined : Math.floor(i / MAP_W));
    };
    const worst = plan.sources.reduce((best, source) => !best || S.tiles[source.i].garbage > S.tiles[best.i].garbage ? source : best, null);
    warn('rate', plan.generated > 0 && plan.currentRate < .8, '🗑️ 이번 달 발생한 쓰레기의 처리율이 80% 미만이에요. 같은 도로망의 처리 시설을 늘려 주세요.', worst?.i);
    const full = plan.facilities.find(f => f.type === 'landfill' && S.tiles[f.i].landfillStored >= f.capacity * .9);
    warn('landfill', !!full, '🗑️ 매립지가 90% 이상 찼어요. 재활용센터·소각장 또는 새 매립지가 필요해요.', full?.i);
    const filling = plan.facilities.find(f => f.type === 'landfill' && S.tiles[f.i].landfillStored >= f.capacity * .7);
    warn('landfill70', !full && !!filling, '🗑️ 매립지가 70% 이상 찼어요. 처리 시설을 미리 준비해 주세요.', filling?.i);
    S.waste = state;
    this.refresh();
    return state.last;
  },

  summary() { return S.waste || this.refresh(); },
};
