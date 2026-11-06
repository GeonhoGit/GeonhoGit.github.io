// ===== 도로로 출근할 수 있는 통행의 대중교통 분담 =====
const TRANSIT = {
  revision: 0,
  _city: null,
  _network: null,
  _signature: null,
  _stations: [],
  _busCoverage: [],
  _subwayCoverage: [],
  _usage: null,

  normalize(raw) {
    if (raw == null) return { version: 1 };
    const fail = () => { throw new Error('저장된 대중교통 데이터가 올바르지 않습니다.'); };
    const amount = n => Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail();
    for (const key of ['busUsers', 'subwayUsers', 'users', 'totalCommuters', 'fare']) {
      if (raw[key] !== undefined && !amount(raw[key])) fail();
    }
    if (raw.stations !== undefined) {
      if (!Array.isArray(raw.stations) || raw.stations.length > MAP_W * MAP_H) fail();
      const seen = new Set();
      for (const station of raw.stations) {
        if (!station || typeof station !== 'object' || Array.isArray(station)
          || !Number.isInteger(station.i) || station.i < 0 || station.i >= MAP_W * MAP_H || seen.has(station.i)
          || !['busstop', 'subway'].includes(station.type) || typeof station.operating !== 'boolean'
          || !Number.isInteger(station.connected) || station.connected < 0 || station.connected >= MAP_W * MAP_H
          || !amount(station.users)) fail();
        seen.add(station.i);
      }
    }
    // 이용량과 요금은 저장된 건물·통행을 바탕으로 다시 계산한다.
    return { version: 1 };
  },

  prepare() {
    if (!S) return;
    const network = TRAFFIC.topology(), stations = [];
    for (let i = 0; i < S.tiles.length; i++) {
      const t = S.tiles[i];
      if (!['busstop', 'subway'].includes(t.type) || t.root !== i) continue;
      const d = facilityDefinition(t, i), entry = TRAFFIC.entry(i, d.size, network);
      stations.push({ i, type: t.type, radius: d.radius, size: d.size, entry,
        component: entry >= 0 ? network.component[entry] : -1,
        eligible: entry >= 0 && isFacilityOperating(t, i), operating: false, connected: 0 });
    }
    const signature = stations.map(s => `${s.i}:${s.type}:${s.radius}:${s.entry}:${s.eligible}`).join('|');
    if (this._city === S && this._network === network && this._signature === signature) return;
    this._city = S; this._network = network; this._signature = signature;
    this._stations = stations;
    this._busCoverage = Array(S.tiles.length);
    this._subwayCoverage = Array(S.tiles.length);
    for (const t of S.tiles) {
      t.transitCovered = t.transitOperating = false;
      t.transitModes = t.transitUsage = t.transitConnected = 0;
    }
    const subways = stations.filter(s => s.type === 'subway' && s.eligible);
    const buses = stations.filter(s => s.type === 'busstop' && s.eligible);
    for (const station of stations) {
      station.operating = station.eligible && (station.type === 'busstop' || subways.length >= 2);
      if (station.operating) station.connected = station.type === 'subway' ? subways.length - 1
        : buses.filter(s => s.component === station.component).length - 1;
      const t = S.tiles[station.i];
      t.transitOperating = station.operating; t.transitConnected = station.connected;
      if (!station.operating) continue;
      const cx = station.i % MAP_W + station.size / 2, cy = Math.floor(station.i / MAP_W) + station.size / 2;
      const r = station.radius, bus = station.type === 'busstop';
      const coverage = bus ? this._busCoverage : this._subwayCoverage;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(MAP_H - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(MAP_W - 1, Math.ceil(cx + r)); x++) {
          if (Math.hypot(x + .5 - cx, y + .5 - cy) > r) continue;
          const i = idx(x, y);
          if (!coverage[i]) coverage[i] = [];
          coverage[i].push(station);
          S.tiles[i].transitCovered = true;
          S.tiles[i].transitModes |= bus ? 1 : 2;
        }
      }
    }
    this.revision++;
  },

  modeSplit(trip) {
    const split = { car: trip.workers, bus: 0, subway: 0, roadLoad: trip.workers,
      busOrigin: -1, busDestination: -1, subwayOrigin: -1, subwayDestination: -1 };
    // 서로 다른 역이어야 한다. 범위가 겹쳐도 같은 역으로 왕복한 것으로 계산하지 않는다.
    const origins = this._subwayCoverage[trip.home] || [], destinations = this._subwayCoverage[trip.work] || [];
    for (const origin of origins) {
      const destination = destinations.find(s => s.i !== origin.i);
      if (!destination) continue;
      split.subway = trip.workers * .5;
      split.subwayOrigin = origin.i; split.subwayDestination = destination.i;
      break;
    }
    const component = this._network.component[trip.path[0]];
    const busOrigin = (this._busCoverage[trip.home] || []).find(s => s.component === component);
    const busDestination = (this._busCoverage[trip.work] || []).find(s => s.component === component);
    if (busOrigin && busDestination) {
      split.bus = (trip.workers - split.subway) * .25;
      split.busOrigin = busOrigin.i; split.busDestination = busDestination.i;
    }
    split.car -= split.subway + split.bus;
    split.roadLoad = split.car + split.bus * .1;
    return split;
  },

  resetUsage() {
    this._usage = { busUsers: 0, subwayUsers: 0, totalCommuters: 0 };
    for (const station of this._stations) S.tiles[station.i].transitUsage = 0;
  },

  record(trip, split) {
    this._usage.busUsers += split.bus;
    this._usage.subwayUsers += split.subway;
    this._usage.totalCommuters += trip.workers;
    // 시설 정보는 승하차 이용량, 도시 합계와 요금은 승객을 한 번만 집계한다.
    for (const mode of ['bus', 'subway']) {
      const origin = split[mode + 'Origin'], destination = split[mode + 'Destination'];
      if (origin < 0 || !split[mode]) continue;
      S.tiles[origin].transitUsage += split[mode];
      if (destination !== origin) S.tiles[destination].transitUsage += split[mode];
    }
  },

  summary() {
    const usage = this._usage || { busUsers: 0, subwayUsers: 0, totalCommuters: 0 };
    const users = usage.busUsers + usage.subwayUsers;
    S.transit = { version: 1, ...usage, users, fare: users * .3,
      stations: this._stations.map(s => ({ i: s.i, type: s.type, operating: s.operating,
        connected: s.connected, users: S.tiles[s.i].transitUsage })) };
    return S.transit;
  },
};
