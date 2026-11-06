// ===== 맵 생성과 칸 유틸 =====
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(rng, w, h, cell) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const g = [];
  for (let i = 0; i < gw * gh; i++) g.push(rng());
  const out = new Float32Array(w * h);
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / cell, fy = y / cell;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1];
    const c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    out[y * w + x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  }
  return out;
}

function newTile(t) {
  return {
    t, tree: false, type: null, root: -1, level: 0, lanes: 1, garbage: 0, landfillStored: 0,
    powered: false, watered: false, road: false,
    flooded: false, disasterDisabled: false,
    land: 30, poll: 0, crime: 0, fire: 0, noPower: 0,
  };
}

function generateMap(seed) {
  const rng = makeRng(seed);
  const tiles = [];
  const n1 = valueNoise(rng, MAP_W, MAP_H, 14);
  const n2 = valueNoise(rng, MAP_W, MAP_H, 5);
  const nt = valueNoise(rng, MAP_W, MAP_H, 6);

  // 강: 위에서 아래로 구불구불 흐르는 물줄기
  const riverX = [];
  let rx = MAP_W * (0.15 + rng() * 0.2);
  if (rng() < 0.5) rx = MAP_W - rx;
  for (let y = 0; y < MAP_H; y++) {
    rx += (rng() - 0.5) * 1.6 + Math.sin(y / 9) * 0.4;
    rx = Math.max(4, Math.min(MAP_W - 5, rx));
    riverX.push(rx);
  }

  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = y * MAP_W + x;
    const v = n1[i] * 0.75 + n2[i] * 0.25;
    let t = TERRAIN.GRASS;
    const rw = 1.6 + n2[i] * 1.4;
    if (Math.abs(x - riverX[y]) < rw) t = TERRAIN.WATER;
    if (v < 0.22) t = TERRAIN.WATER;
    tiles.push(newTile(t));
  }
  // 모래사장
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const tile = tiles[y * MAP_W + x];
    if (tile.t !== TERRAIN.GRASS) continue;
    let nearW = false;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (inMap(nx, ny) && tiles[ny * MAP_W + nx].t === TERRAIN.WATER) nearW = true;
    }
    if (nearW && hash2(x, y) < 0.55) tile.t = TERRAIN.SAND;
  }
  // 숲
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (tile.t === TERRAIN.GRASS && nt[i] > 0.62 && rng() < 0.85) tile.tree = true;
    else if (tile.t === TERRAIN.GRASS && rng() < 0.03) tile.tree = true;
  }
  // 시작 지점(중앙)은 나무를 조금 비워 둔다
  const cx = MAP_W / 2, cy = MAP_H / 2;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (Math.hypot(x - cx, y - cy) < 6) tiles[y * MAP_W + x].tree = false;
  }
  return tiles;
}

const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function inMap(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
function idx(x, y) { return y * MAP_W + x; }
