// ===== 시뮬레이션용 출퇴근 교통 (화면의 차량 연출과 별개) =====
const TRAFFIC = {
  revision: 0,
  trips: [],
  _city: null,
  _topology: null,
  _signature: null,

  normalize(raw) {
    if (raw == null) return { version: 1 };
    const fail = () => { throw new Error('저장된 교통 데이터가 올바르지 않습니다.'); };
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail();
    for (const key of ['workers', 'commuters', 'failed', 'employedCom', 'employedInd', 'congestedRoads']) {
      if (raw[key] !== undefined && (!Number.isFinite(raw[key]) || raw[key] < 0 || raw[key] > Number.MAX_SAFE_INTEGER)) fail();
    }
    for (const [key, max] of [['jobFillRate', 1], ['avgCongestion', 100]]) {
      if (raw[key] !== undefined && (!Number.isFinite(raw[key]) || raw[key] < 0 || raw[key] > max)) fail();
    }
    if (raw.worstRoad !== undefined && (!Number.isInteger(raw.worstRoad) || raw.worstRoad < -1 || raw.worstRoad >= MAP_W * MAP_H)) fail();
    // 통행량과 고용은 저장된 지도로 다시 계산하므로 오래된 파생값은 사용하지 않는다.
    return { version: 1 };
  },

  capacity(tile) { return tile?.lanes === 2 ? 750 : 300; },
  nearbyCongestion(i) { return S?.tiles[i]?.nearbyTraffic || 0; },
  residentialPenalty(i) { return Math.min(8, Math.max(0, (S?.tiles[i]?.commuteTraffic || 0) - 50) * .16); },
  invalidate() { this._signature = null; },

  topology() {
    if (!S) return null;
    const tiles = S.tiles, count = tiles.length;
    let network = this._topology;
    let changed = this._city !== S || !network || network.tiles !== tiles;
    if (!changed) for (let i = 0; i < count; i++) {
      if (network.mask[i] !== (tiles[i].type === 'road' && !tiles[i].flooded ? 1 : 0)) { changed = true; break; }
    }
    if (!changed) return network;
    this._city = S;
    this._signature = null;
    const mask = new Uint8Array(count), roads = [], neighbors = Array(count), nearby = Array(count);
    const nearbyCount = new Uint8Array(count);
    const component = new Int32Array(count).fill(-1), entries = new Map();
    for (let i = 0; i < count; i++) if (tiles[i].type === 'road' && !tiles[i].flooded) { mask[i] = 1; roads.push(i); }
    for (const i of roads) {
      const x = i % MAP_W, y = Math.floor(i / MAP_W), adjacent = [];
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (inMap(nx, ny) && mask[idx(nx, ny)]) adjacent.push(idx(nx, ny));
      }
      neighbors[i] = adjacent;
      const area = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 2 || !inMap(x + dx, y + dy)) continue;
        const next = idx(x + dx, y + dy);
        area.push(next); nearbyCount[next]++;
      }
      nearby[i] = area;
    }
    const components = [];
    for (const start of roads) {
      if (component[start] >= 0) continue;
      const queue = [start], id = components.length;
      component[start] = id;
      for (let p = 0; p < queue.length; p++) for (const next of neighbors[queue[p]]) {
        if (component[next] < 0) { component[next] = id; queue.push(next); }
      }
      components.push(queue);
    }
    network = { tiles, mask, roads, neighbors, nearby, nearbyCount, component, components, entries, searches: new Map() };
    this._topology = network;
    return network;
  },

  entry(i, size = 1, network = this.topology()) {
    if (!network) return -1;
    const key = `${i}:${size}`;
    if (network.entries.has(key)) return network.entries.get(key);
    const x = i % MAP_W, y = Math.floor(i / MAP_W);
    let best = -1, distance = 3;
    for (let ny = Math.max(0, y - 2); ny <= Math.min(MAP_H - 1, y + size + 1); ny++) {
      for (let nx = Math.max(0, x - 2); nx <= Math.min(MAP_W - 1, x + size + 1); nx++) {
        const next = idx(nx, ny);
        if (!network.mask[next]) continue;
        const d = Math.max(x - nx, 0, nx - (x + size - 1)) + Math.max(y - ny, 0, ny - (y + size - 1));
        if (d <= 2 && (d < distance || (d === distance && next < best))) { best = next; distance = d; }
      }
    }
    network.entries.set(key, best);
    return best;
  },

  // 정원·인구가 바뀌어도 같은 목적지 순서의 최단 도로는 같다. 도로망 교체 시 함께 폐기한다.
  _search(network, destinations) {
    const active = [];
    destinations.forEach((d, id) => { if (d.remaining > 1e-9) active.push(id + ':' + d.entry); });
    if (!active.length) return null;
    const key = active.join(','), cached = network.searches.get(key);
    if (cached) return cached;
    const count = network.mask.length;
    const owner = new Int32Array(count).fill(-1), parent = new Int32Array(count).fill(-1);
    const distance = new Int16Array(count).fill(-1), queue = new Int32Array(count);
    let head = 0, tail = 0;
    destinations.forEach((d, id) => {
      if (d.remaining <= 1e-9) return;
      owner[d.entry] = id; distance[d.entry] = 0; queue[tail++] = d.entry;
    });
    while (head < tail) {
      const i = queue[head++];
      if (distance[i] >= 45) continue;
      for (const next of network.neighbors[i]) if (distance[next] < 0) {
        owner[next] = owner[i]; parent[next] = i; distance[next] = distance[i] + 1; queue[tail++] = next;
      }
    }
    const search = { owner, parent, routes: new Map() };
    // 장시간 운영 중 목적지 조합이 늘어도 캐시 메모리는 일정하게 유지한다.
    if (network.searches.size >= 64) network.searches.delete(network.searches.keys().next().value);
    network.searches.set(key, search);
    return search;
  },

  recompute() {
    if (!S) return null;
    const network = this.topology(), tiles = S.tiles;
    const transit = typeof TRANSIT !== 'undefined' ? TRANSIT : null;
    const stationRoots = [];
    const homes = [], jobs = [], destinations = [], byEntry = new Map();
    let workers = 0, totalJobs = 0;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.type === 'res' && t.level > 0) {
        const amount = ZONE_CAP.res[t.level] * 0.55;
        homes.push({ i, entry: this.entry(i, 1, network), workers: amount, remaining: amount });
        workers += amount;
      }
      let com = 0, ind = 0, size = 1;
      if (t.type === 'com' && t.level > 0) com = ZONE_CAP.com[t.level];
      else if (t.type === 'ind' && t.level > 0) ind = ZONE_CAP.ind[t.level];
      else if (t.type && t.root === i) {
        if (t.type === 'busstop' || t.type === 'subway') stationRoots.push(i);
        const base = DEFS[t.type];
        if (!(base?.comJobs || base?.indJobs) || !isFacilityOperating(t, i)) continue;
        const d = facilityDefinition(t, i);
        com = d.comJobs || 0; ind = d.indJobs || 0; size = d.size;
      }
      if (!(com + ind > 0)) continue;
      const job = { i, entry: this.entry(i, size, network), com, ind, capacity: com + ind };
      jobs.push(job); totalJobs += job.capacity;
      if (job.entry < 0) continue;
      let destination = byEntry.get(job.entry);
      if (!destination) {
        destination = { entry: job.entry, com: 0, ind: 0, capacity: 0, remaining: 0, allocated: 0, jobs: [] };
        byEntry.set(job.entry, destination); destinations.push(destination);
      }
      destination.jobs.push(job); destination.com += com; destination.ind += ind;
      destination.capacity += job.capacity; destination.remaining += job.capacity;
    }
    if (transit) transit.prepare(network, stationRoots);
    const signature = network.roads.map(i => tiles[i].lanes === 2 ? '2' : '1').join('')
      + '|' + homes.map(h => `${h.i}:${h.workers}`).join(',')
      + '|' + jobs.map(j => `${j.i}:${j.com}:${j.ind}:${j.entry}`).join(',')
      + '|' + (transit ? transit.revision : 0);
    if (signature === this._signature && S.traffic?.workers !== undefined) return S.traffic;
    this._signature = signature;
    for (const t of tiles) {
      t.trafficLoad = t.traffic = t.commuteTraffic = t.nearbyTraffic = 0;
      t.trafficEmployed = t.trafficJobFill = 0;
    }
    const trips = [], count = tiles.length;
    const epsilon = 1e-9;
    // 가장 가까운 직장부터 배분하고, 정원이 찬 목적지는 다음 BFS에서 제외한다.
    // 같은 목적지를 고른 주거는 잔여 정원을 비율로 나눠 지도 순서에 따른 선착순 편향을 줄인다.
    while (homes.some(h => h.remaining > epsilon)) {
      const search = this._search(network, destinations);
      if (!search) break;
      const { owner, parent } = search;
      const demand = new Float64Array(destinations.length);
      for (const h of homes) if (h.remaining > epsilon && h.entry >= 0 && owner[h.entry] >= 0) demand[owner[h.entry]] += h.remaining;
      const assigned = new Float64Array(destinations.length);
      let moved = 0;
      for (const h of homes) {
        if (h.remaining <= epsilon || h.entry < 0 || owner[h.entry] < 0) continue;
        const id = owner[h.entry], d = destinations[id];
        const amount = h.remaining * Math.min(1, d.remaining / demand[id]);
        if (amount <= epsilon) continue;
        let route = search.routes.get(h.entry);
        if (!route) {
          route = [];
          for (let i = h.entry; i >= 0; i = parent[i]) route.push(i);
          search.routes.set(h.entry, route);
        }
        for (const job of d.jobs) trips.push({ home: h.i, work: job.i, workers: amount * job.capacity / d.capacity, path: route });
        h.remaining -= amount; assigned[id] += amount; moved += amount;
      }
      destinations.forEach((d, id) => { d.remaining = Math.max(0, d.remaining - assigned[id]); d.allocated += assigned[id]; });
      if (moved <= epsilon) break;
    }
    let commuters = 0, employedCom = 0, employedInd = 0;
    for (const d of destinations) {
      commuters += d.allocated;
      employedCom += d.allocated * d.com / d.capacity;
      employedInd += d.allocated * d.ind / d.capacity;
      for (const job of d.jobs) {
        tiles[job.i].trafficEmployed = d.allocated * job.capacity / d.capacity;
        tiles[job.i].trafficJobFill = Math.min(1, d.allocated / d.capacity);
      }
    }
    if (transit) transit.resetUsage();
    const roadLoads = new Float64Array(count);
    for (const trip of trips) {
      const load = transit ? transit.roadLoadFor(trip) : trip.workers;
      for (const i of trip.path) roadLoads[i] += load;
    }
    if (transit) transit.summary();
    const nearbySum = new Float64Array(count), nearbyCount = network.nearbyCount;
    let congestedRoads = 0, worstRoad = -1, worst = 0;
    for (const i of network.roads) {
      const t = tiles[i];
      t.trafficLoad = roadLoads[i];
      t.traffic = Math.min(100, t.trafficLoad / this.capacity(t) * 100);
      if (t.traffic >= 90) congestedRoads++;
      if (t.traffic > worst) { worst = t.traffic; worstRoad = i; }
      for (const next of network.nearby[i]) nearbySum[next] += t.traffic;
    }
    for (let i = 0; i < count; i++) tiles[i].nearbyTraffic = nearbyCount[i] ? nearbySum[i] / nearbyCount[i] : 0;
    const homeCommuters = new Float64Array(count);
    const routeAverages = new Map();
    let weightedCongestion = 0;
    for (const trip of trips) {
      let average = routeAverages.get(trip.path);
      if (average === undefined) {
        average = trip.path.reduce((sum, i) => sum + tiles[i].traffic, 0) / trip.path.length;
        routeAverages.set(trip.path, average);
      }
      tiles[trip.home].commuteTraffic += average * trip.workers;
      homeCommuters[trip.home] += trip.workers;
      weightedCongestion += average * trip.workers;
    }
    for (const h of homes) if (homeCommuters[h.i]) tiles[h.i].commuteTraffic = Math.min(100, tiles[h.i].commuteTraffic / homeCommuters[h.i]);
    this.trips = trips;
    this.revision++;
    S.traffic = { version: 1, workers, commuters, failed: workers - commuters > epsilon ? workers - commuters : 0,
      employedCom, employedInd, jobFillRate: totalJobs ? Math.min(1, commuters / totalJobs) : 0,
      avgCongestion: commuters ? Math.min(100, weightedCongestion / commuters) : 0, congestedRoads, worstRoad };
    return S.traffic;
  },
};
