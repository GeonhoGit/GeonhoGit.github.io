// ===== 렌더링 =====
const R = {
  canvas: null, ctx: null,
  cam: { x: 0, y: 0, zoom: 1 },
  overlay: 'none',
  preview: null,      // { cells:[{x,y,ok}], size, key }
  hover: null,        // {x,y}
  selected: null,     // {x,y}
  particles: [],
  cars: [],
  time: 0,
  mini: null, miniCtx: null, miniTimer: 0,
};

function initRender(canvas, mini) {
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');
  R.mini = mini;
  R.miniCtx = mini.getContext('2d', { willReadFrequently: true });
  resizeCanvas();
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  R.dpr = dpr;
  R.canvas.width = Math.floor(window.innerWidth * dpr);
  R.canvas.height = Math.floor(window.innerHeight * dpr);
  R.canvas.style.width = window.innerWidth + 'px';
  R.canvas.style.height = window.innerHeight + 'px';
}

function centerCamera(tx, ty) {
  const ts = TILE * R.cam.zoom;
  R.cam.x = tx * ts - window.innerWidth / 2;
  R.cam.y = ty * ts - window.innerHeight / 2;
  clampCamera();
}
function clampCamera() {
  const ts = TILE * R.cam.zoom;
  const W = window.innerWidth, H = window.innerHeight;
  R.cam.x = Math.max(-W * 0.5, Math.min(MAP_W * ts - W * 0.5, R.cam.x));
  R.cam.y = Math.max(-H * 0.5, Math.min(MAP_H * ts - H * 0.5, R.cam.y));
}
function screenToTile(sx, sy) {
  const ts = TILE * R.cam.zoom;
  return { x: Math.floor((sx + R.cam.x) / ts), y: Math.floor((sy + R.cam.y) / ts) };
}

// ---------- 색 유틸 ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function pick(arr, x, y, salt) { return arr[Math.floor(hash2(x * 7 + (salt || 0), y * 13) * arr.length)]; }

// 의사 3D 상자: 바닥 사각형(px,py,w,h) 위로 height 만큼 솟은 건물
function box(ctx, px, py, w, h, height, top, side, windows) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(px + height * 0.35, py + h * 0.15, w, h);
  ctx.fillStyle = side;
  ctx.fillRect(px, py + h - height, w, height);
  ctx.fillStyle = top;
  ctx.fillRect(px, py - height, w, h);
  if (R.season === 'winter') {
    ctx.fillStyle = 'rgba(232,240,242,0.82)';
    ctx.fillRect(px + w * 0.06, py - height + h * 0.04, w * 0.88, h * 0.72);
  }
  if (windows && height > 6) {
    ctx.fillStyle = windows;
    const rows = Math.floor((height - 3) / 5);
    const cols = Math.max(1, Math.floor(w / 5));
    const cw = w / cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      ctx.fillRect(px + c * cw + cw * 0.25, py + h - height + 2 + r * 5, cw * 0.5, 2.2);
    }
  }
  if (R.lightBuilding && R.nightStrength > 0 && height > 2) {
    const rows = Math.max(1, Math.floor((height - 3) / 5)), cols = Math.max(1, Math.floor(w / 5)), cw = w / cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (hash2(R.lightSeed + c * 13, r * 17) < 0.3) continue;
      R.nightWindows.push([px + c * cw + cw * 0.25, py + h - height + 2 + r * 5, cw * 0.5, Math.min(2.2, height * 0.3)]);
    }
  }
}

// ---------- 메인 그리기 ----------
function render(dt, dayFraction = 0) {
  R.time += dt;
  const ctx = R.ctx;
  const dpr = R.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1b2a1e';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  if (!S) return;
  syncDisasterVisual();
  syncAmbience(dayFraction);
  const z = R.cam.zoom;
  const ts = TILE * z;
  const x0 = Math.max(0, Math.floor(R.cam.x / ts) - 1);
  const y0 = Math.max(0, Math.floor(R.cam.y / ts) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil((R.cam.x + window.innerWidth) / ts) + 1);
  const y1 = Math.min(MAP_H - 1, Math.ceil((R.cam.y + window.innerHeight) / ts) + 3);
  ctx.save();
  ctx.translate(-Math.round(R.cam.x), -Math.round(R.cam.y));
  const quake = R.disasterEffect;
  if (quake?.kind === 'quake' && !R.reducedMotion) {
    const age = R.time - quake.started, strength = 5 * (1 - age / 0.6);
    ctx.translate(Math.sin(age * 85 + 1) * strength, Math.cos(age * 71) * strength * 0.65);
  }

  // 1) 지면
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawGround(ctx, x, y, ts, z);

  // 2) 차량
  drawCars(ctx, ts, z);

  // 3) 건물/나무 (행 순서)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawObject(ctx, x, y, ts, z);

  // 4) 연기 파티클
  drawParticles(ctx, dt, z);

  // 침수와 재난은 건물 위에 표시하고 지도 정보는 그 위에 유지한다.
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawFlood(ctx, x, y, ts);
  drawDisasterEffects(ctx, ts);

  // 낮·밤 음영과 조명 다음에 지도 정보·경고를 그려 가독성을 유지한다.
  drawNightLighting(ctx, ts, z, x0, y0, x1, y1);

  // 5) 오버레이
  if (R.overlay !== 'none') for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawOverlay(ctx, x, y, ts);

  // 6) 상태 아이콘
  if (z >= 0.55) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawStatus(ctx, x, y, ts);

  // 7) 미리보기/선택
  drawPreview(ctx, ts);

  // 맵 테두리
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, MAP_W * ts, MAP_H * ts);
  ctx.restore();

  R.miniTimer -= dt;
  if (R.miniTimer <= 0) { drawMinimap(); R.miniTimer = 0.5; }
  drawMiniViewport();
}

function syncAmbience(dayFraction) {
  const settings = typeof AMBIENCE !== 'undefined' ? AMBIENCE.settings : { dayNight: false, seasons: false };
  R.season = settings.seasons ? AMBIENCE.season() : 'spring';
  R.nightStrength = settings.dayNight && R.overlay === 'none' ? AMBIENCE.nightStrength(AMBIENCE.phase(dayFraction)) : 0;
  R.nightWindows ||= []; R.nightWindows.length = 0; R.lightBuilding = false;
}

function drawNightLighting(ctx, ts, z, x0, y0, x1, y1) {
  const strength = R.nightStrength;
  if (!(strength > 0)) return;
  const glow = strength / 0.45;
  ctx.save();
  ctx.fillStyle = `rgba(13,24,58,${strength})`;
  ctx.fillRect(R.cam.x, R.cam.y, window.innerWidth, window.innerHeight);
  ctx.fillStyle = `rgba(255,226,151,${0.88 * glow})`;
  for (const [x, y, w, h] of R.nightWindows) ctx.fillRect(x, y, w, h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = S.tiles[idx(x, y)];
    if (t.type !== 'road' || !t.powered || t.flooded) continue;
    const junction = Number(isRoad(x - 1, y)) + Number(isRoad(x + 1, y)) + Number(isRoad(x, y - 1)) + Number(isRoad(x, y + 1)) >= 3;
    if (!junction && (x + y) % 5) continue;
    const lx = (x + 0.15) * ts, ly = (y + 0.15) * ts;
    ctx.fillStyle = `rgba(255,220,144,${0.14 * glow})`; ctx.beginPath(); ctx.arc(lx, ly, ts * 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,237,184,${glow})`; ctx.beginPath(); ctx.arc(lx, ly, Math.max(0.8, ts * 0.045), 0, 7); ctx.fill();
  }
  if (z >= 0.4) for (const car of R.cars) {
    if (car.ni < 0) continue;
    const pose = getCarPose(car);
    if (pose.x < x0 || pose.x > x1 + 1 || pose.y < y0 || pose.y > y1 + 1) continue;
    ctx.save(); ctx.translate(pose.x * ts, pose.y * ts); ctx.rotate(pose.angle);
    ctx.fillStyle = `rgba(255,236,172,${0.14 * glow})`;
    ctx.beginPath(); ctx.moveTo(ts * 0.13, -ts * 0.05); ctx.lineTo(ts * 0.85, -ts * 0.22);
    ctx.lineTo(ts * 0.85, ts * 0.22); ctx.lineTo(ts * 0.13, ts * 0.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,240,198,${glow})`;
    ctx.fillRect(ts * 0.1, -ts * 0.06, ts * 0.04, ts * 0.04); ctx.fillRect(ts * 0.1, ts * 0.02, ts * 0.04, ts * 0.04);
    ctx.restore();
  }
  ctx.restore();
}

function syncDisasterVisual() {
  R.reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visual = typeof DISASTER !== 'undefined' ? DISASTER.visual : null;
  if (R.disasterCity !== S) { R.disasterCity = S; R.disasterSeen = null; R.disasterEffect = null; }
  if (!visual) { R.disasterSeen = null; R.disasterEffect = null; return; }
  if (visual !== R.disasterSeen) {
    R.disasterSeen = visual;
    R.disasterEffect = visual.kind === 'quake' || visual.kind === 'typhoon' ? { ...visual, started: R.time } : null;
  }
  const effect = R.disasterEffect;
  if (effect && R.time - effect.started >= (effect.kind === 'quake' ? 0.6 : 2)) R.disasterEffect = null;
}

function drawFlood(ctx, x, y, ts) {
  if (!S.tiles[idx(x, y)].flooded) return;
  const px = x * ts, py = y * ts, phase = R.reducedMotion ? 0 : R.time * 2;
  ctx.fillStyle = 'rgba(47,135,206,0.48)'; ctx.fillRect(px, py, ts, ts);
  ctx.strokeStyle = 'rgba(177,227,250,0.75)'; ctx.lineWidth = Math.max(1, ts * 0.035);
  for (let row = 0; row < 2; row++) {
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const wx = px + (0.12 + k * 0.12) * ts, wy = py + (0.32 + row * 0.4 + Math.sin(k * 1.4 + phase + x + y) * 0.045) * ts;
      if (k) ctx.lineTo(wx, wy); else ctx.moveTo(wx, wy);
    }
    ctx.stroke();
  }
}

function drawDisasterEffects(ctx, ts) {
  const effect = R.disasterEffect;
  if (!effect) return;
  const age = R.time - effect.started;
  ctx.save();
  if (effect.kind === 'quake') {
    const x = (effect.x + 0.5) * ts, y = (effect.y + 0.5) * ts;
    ctx.strokeStyle = `rgba(49,34,24,${R.reducedMotion ? 0.8 : 0.9 * (1 - age / 0.6)})`; ctx.lineWidth = Math.max(1.5, ts * 0.065);
    for (let ray = 0; ray < 7; ray++) {
      const angle = ray * Math.PI * 2 / 7, length = (effect.radius || 6) * ts * (0.45 + hash2(ray, effect.x) * 0.4);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let part = 1; part <= 4; part++) {
        const turn = angle + (hash2(ray, part) - 0.5) * 0.36;
        ctx.lineTo(Math.max(0, Math.min(MAP_W * ts, x + Math.cos(turn) * length * part / 4)),
          Math.max(0, Math.min(MAP_H * ts, y + Math.sin(turn) * length * part / 4)));
      }
      ctx.stroke();
    }
  } else {
    const horizontal = effect.axis === 'x', center = effect.center * ts, width = (effect.width || 5) * ts;
    const fade = R.reducedMotion ? 1 : Math.min(1, (2 - age) * 2);
    ctx.fillStyle = `rgba(152,189,196,${0.17 * fade})`;
    if (horizontal) ctx.fillRect(0, center - width / 2, MAP_W * ts, width);
    else ctx.fillRect(center - width / 2, 0, width, MAP_H * ts);
    const travel = (horizontal ? MAP_W : MAP_H) * ts * (R.reducedMotion ? 0.5 : age / 2);
    ctx.strokeStyle = `rgba(219,242,244,${0.65 * fade})`; ctx.lineWidth = Math.max(1, ts * 0.055);
    for (let k = -1; k <= 1; k++) {
      const along = Math.max(ts, Math.min((horizontal ? MAP_W : MAP_H) * ts - ts, travel + k * ts * 2));
      const cx = horizontal ? along : center + k * width * 0.16, cy = horizontal ? center + k * width * 0.16 : along;
      for (let ring = 0; ring < 3; ring++) {
        const spin = R.reducedMotion ? 0 : age * 9;
        ctx.beginPath(); ctx.arc(cx, cy, ts * (0.25 + ring * 0.2), spin + ring, spin + ring + Math.PI * 1.5); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawGround(ctx, x, y, ts, z) {
  const t = S.tiles[idx(x, y)];
  const px = x * ts, py = y * ts;
  const h = hash2(x, y);
  const season = R.season || 'spring';
  if (t.t === TERRAIN.WATER) {
    ctx.fillStyle = `hsl(208, 58%, ${38 + h * 4}%)`;
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
    if (z > 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      const wv = Math.sin(R.time * 1.5 + x * 0.9 + y * 0.6);
      ctx.fillRect(px + ts * (0.2 + 0.1 * wv), py + ts * (0.3 + h * 0.4), ts * 0.35, Math.max(1, ts * 0.05));
    }
    if (season === 'winter') {
      ctx.fillStyle = 'rgba(214,235,242,0.78)';
      const edge = ts * 0.17;
      if (inMap(x, y - 1) && S.tiles[idx(x, y - 1)].t !== TERRAIN.WATER) ctx.fillRect(px, py, ts, edge);
      if (inMap(x, y + 1) && S.tiles[idx(x, y + 1)].t !== TERRAIN.WATER) ctx.fillRect(px, py + ts - edge, ts, edge);
      if (inMap(x - 1, y) && S.tiles[idx(x - 1, y)].t !== TERRAIN.WATER) ctx.fillRect(px, py, edge, ts);
      if (inMap(x + 1, y) && S.tiles[idx(x + 1, y)].t !== TERRAIN.WATER) ctx.fillRect(px + ts - edge, py, edge, ts);
    }
  } else if (t.t === TERRAIN.SAND) {
    ctx.fillStyle = `hsl(45, 48%, ${68 + h * 5}%)`;
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
  } else {
    ctx.fillStyle = season === 'summer' ? `hsl(${100 + h * 8}, 48%, ${34 + h * 5}%)`
      : season === 'autumn' ? `hsl(${86 + h * 9}, 30%, ${43 + h * 6}%)`
      : season === 'winter' ? `hsl(${95 + h * 8}, 18%, ${72 + h * 4}%)` : `hsl(${95 + h * 12}, 42%, ${40 + h * 6}%)`;
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
    if (z > 0.7 && h > 0.7) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(px + ts * h * 0.6, py + ts * (1 - h) * 0.8, ts * 0.1, ts * 0.1);
    }
  }
  if (!t.type) return;
  if (t.type === 'road') return drawRoad(ctx, x, y, px, py, ts, z, t);
  if (t.type === 'rubble') {
    ctx.fillStyle = '#6d625a';
    ctx.fillRect(px, py, ts, ts);
    ctx.fillStyle = '#857a70';
    for (let k = 0; k < 4; k++) {
      const a = hash2(x + k, y * 3 + k);
      ctx.fillRect(px + ts * a * 0.7, py + ts * hash2(y + k, x) * 0.7, ts * 0.25, ts * 0.18);
    }
    return;
  }
  const d = DEFS[t.type];
  if (d && d.zone) {
    if (t.level === 0) {
      ctx.fillStyle = d.color + '55';
      ctx.fillRect(px, py, ts, ts);
      ctx.strokeStyle = d.color;
      ctx.lineWidth = Math.max(1, 1.5 * z);
      ctx.strokeRect(px + ts * 0.12, py + ts * 0.12, ts * 0.76, ts * 0.76);
    } else {
      ctx.fillStyle = t.type === 'res' ? '#8fb07a' : t.type === 'com' ? '#a9b2bd' : '#9c9282';
      ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
      ctx.fillStyle = d.color + '40';
      ctx.fillRect(px, py, ts, Math.max(1, ts * 0.06));
    }
    return;
  }
  // 공공/유틸 건물 바닥
  if (t.type === 'park') {
    ctx.fillStyle = season === 'winter' ? '#becbb7' : season === 'summer' ? '#4a9840' : season === 'autumn' ? '#8c9b57' : '#5fae4f';
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
    ctx.fillStyle = '#d8c79a';
    ctx.fillRect(px + ts * 0.42, py, ts * 0.16, ts);
    ctx.fillRect(px, py + ts * 0.42, ts, ts * 0.16);
  } else if (t.type === 'stadium' || t.type === 'school') {
    ctx.fillStyle = '#6dab5a';
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
  } else if (t.type === 'solar') {
    ctx.fillStyle = '#9aa58a';
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
  } else {
    ctx.fillStyle = '#9ea4a8';
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
  }
}

function isRoad(x, y) { return inMap(x, y) && S.tiles[idx(x, y)].type === 'road'; }

function drawRoad(ctx, x, y, px, py, ts, z, t) {
  const bridge = t.t === TERRAIN.WATER;
  const avenue = t.lanes === 2;
  const n = isRoad(x, y - 1), s = isRoad(x, y + 1), w = isRoad(x - 1, y), e = isRoad(x + 1, y);
  if (bridge) {
    ctx.fillStyle = '#7a6550';
    ctx.fillRect(px, py, ts, ts);
  } else {
    ctx.fillStyle = '#b9b6ae'; // 인도
    ctx.fillRect(px, py, ts + 0.5, ts + 0.5);
  }
  const m = ts * (avenue ? 0.06 : 0.12);
  ctx.fillStyle = bridge ? '#4a4c50' : '#43474e';
  ctx.fillRect(px + m, py + m, ts - 2 * m, ts - 2 * m);
  if (n) ctx.fillRect(px + m, py, ts - 2 * m, m);
  if (s) ctx.fillRect(px + m, py + ts - m, ts - 2 * m, m + 0.5);
  if (w) ctx.fillRect(px, py + m, m, ts - 2 * m);
  if (e) ctx.fillRect(px + ts - m, py + m, m + 0.5, ts - 2 * m);
  if (bridge) {
    ctx.fillStyle = '#d2c4a8';
    if (!(n || s) || w || e) { ctx.fillRect(px, py + m * 0.3, ts, m * 0.4); ctx.fillRect(px, py + ts - m * 0.7, ts, m * 0.4); }
    else { ctx.fillRect(px + m * 0.3, py, m * 0.4, ts); ctx.fillRect(px + ts - m * 0.7, py, m * 0.4, ts); }
  }
  if (z < 0.6) return;
  // 차선
  ctx.fillStyle = 'rgba(255,230,140,0.75)';
  const c = ts / 2, lw = Math.max(1, ts * 0.04);
  const dash = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(len / (ts * 0.22)));
    for (let k = 0; k < steps; k += 2) {
      const a = k / steps, b = Math.min(1, (k + 1) / steps);
      const ax = x1 + (x2 - x1) * a, ay = y1 + (y2 - y1) * a;
      const bx = x1 + (x2 - x1) * b, by = y1 + (y2 - y1) * b;
      ctx.fillRect(Math.min(ax, bx) - lw / 2, Math.min(ay, by) - lw / 2, Math.abs(bx - ax) + lw, Math.abs(by - ay) + lw);
    }
  };
  const doubleLine = (x1, y1, x2, y2) => {
    const width = Math.max(0.75, ts * 0.025), gap = ts * 0.055;
    for (const offset of [-gap, gap]) {
      const dx = x1 === x2 ? offset : 0, dy = y1 === y2 ? offset : 0;
      ctx.fillRect(Math.min(x1, x2) + dx - width / 2, Math.min(y1, y2) + dy - width / 2,
        Math.abs(x2 - x1) + width, Math.abs(y2 - y1) + width);
    }
  };
  const cnt = n + s + w + e;
  if (cnt >= 3) {
    if (avenue) {
      if (n) doubleLine(px + c, py, px + c, py + ts * 0.22);
      if (s) doubleLine(px + c, py + ts * 0.78, px + c, py + ts);
      if (w) doubleLine(px, py + c, px + ts * 0.22, py + c);
      if (e) doubleLine(px + ts * 0.78, py + c, px + ts, py + c);
    }
    // 정지선은 우측 진입 차선에만, 신호는 차량 이동과 같은 상태를 표시한다.
    ctx.fillStyle = '#e3e6df';
    const stopWidth = Math.max(1, ts * 0.035);
    if (n) ctx.fillRect(px + ts * 0.18, py + ts * 0.055, ts * 0.3, stopWidth);
    if (s) ctx.fillRect(px + ts * 0.52, py + ts * 0.91, ts * 0.3, stopWidth);
    if (w) ctx.fillRect(px + ts * 0.055, py + ts * 0.52, stopWidth, ts * 0.3);
    if (e) ctx.fillRect(px + ts * 0.91, py + ts * 0.18, stopWidth, ts * 0.3);
    const signal = (sx, sy, axis) => {
      const phase = trafficSignal(idx(x, y), axis);
      const left = px + sx * ts, top = py + sy * ts;
      ctx.fillStyle = '#182521';
      ctx.fillRect(left, top, ts * 0.1, ts * 0.27);
      for (const [k, state, color] of [[0, 'red', '#f26c64'], [1, 'amber', '#f2c94c'], [2, 'green', '#6fd38a']]) {
        ctx.fillStyle = phase === state ? color : '#39433f';
        ctx.beginPath();
        ctx.arc(left + ts * 0.05, top + ts * (0.055 + k * 0.08), Math.max(0.65, ts * 0.03), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    if (n) signal(0.02, 0.02, 'vertical');
    if (s) signal(0.88, 0.71, 'vertical');
    if (w) signal(0.02, 0.71, 'horizontal');
    if (e) signal(0.88, 0.02, 'horizontal');
    return;
  }
  const line = avenue ? doubleLine : dash;
  if (n) line(px + c, py, px + c, py + c);
  if (s) line(px + c, py + c, px + c, py + ts);
  if (w) line(px, py + c, px + c, py + c);
  if (e) line(px + c, py + c, px + ts, py + c);
}

function drawObject(ctx, x, y, ts, z) {
  const i = idx(x, y);
  const t = S.tiles[i];
  const px = x * ts, py = y * ts;
  if (!t.type && t.tree) return drawTree(ctx, x, y, px, py, ts);
  if (!t.type) return;
  if (t.type === 'park') {
    const k = hash2(x, y);
    drawTreeAt(ctx, px + ts * 0.22, py + ts * 0.25, ts * 0.17);
    drawTreeAt(ctx, px + ts * 0.78, py + ts * 0.78, ts * 0.17);
    if (k > 0.5) drawTreeAt(ctx, px + ts * 0.78, py + ts * 0.22, ts * 0.14);
    else { ctx.fillStyle = '#4f8fd4'; ctx.beginPath(); ctx.ellipse(px + ts * 0.25, py + ts * 0.76, ts * 0.13, ts * 0.09, 0, 0, 7); ctx.fill(); }
  }
  const d = DEFS[t.type];
  R.lightBuilding = !!t.powered && !t.fire && !t.flooded && !t.disasterDisabled;
  R.lightSeed = i;
  if (d && d.zone && t.level > 0) drawZoneBuilding(ctx, x, y, px, py, ts, z, t);
  else if (t.root === i && t.type !== 'park') drawFacility(ctx, x, y, px, py, ts, z, t);
  R.lightBuilding = false;
  if (t.fire > 0) drawFire(ctx, px, py, ts);
}

function drawTreeAt(ctx, cx, cy, r) {
  const season = R.season || 'spring', autumn = hash2(Math.round(cx / r), Math.round(cy / r)) > 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(cx + r * 0.3, cy + r * 0.5, r, r * 0.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5b3d24';
  ctx.fillRect(cx - r * 0.12, cy, r * 0.24, r * 0.6);
  ctx.fillStyle = season === 'summer' ? '#245b2b' : season === 'autumn' ? (autumn ? '#a95e30' : '#8b7134') : season === 'winter' ? '#657d70' : '#2f6b2f';
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.2, r, 0, 7); ctx.fill();
  ctx.fillStyle = season === 'summer' ? '#327734' : season === 'autumn' ? (autumn ? '#d58a3e' : '#bc984c') : season === 'winter' ? '#b1c2b4' : '#3f8a3a';
  ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.45, r * 0.55, 0, 7); ctx.fill();
}
function drawTree(ctx, x, y, px, py, ts) {
  const h1 = hash2(x, y), h2 = hash2(y + 31, x + 7);
  drawTreeAt(ctx, px + ts * (0.3 + h1 * 0.15), py + ts * (0.35 + h2 * 0.1), ts * (0.2 + h1 * 0.06));
  if (h2 > 0.4) drawTreeAt(ctx, px + ts * (0.7 - h2 * 0.1), py + ts * (0.72), ts * (0.16 + h2 * 0.05));
}

const ROOF_RES = ['#b5533c', '#8c4a3a', '#5a6f8c', '#7a5c44', '#a8643e'];
const WALL_RES = ['#efe2c8', '#e6d3b3', '#f1ece0', '#d9c7a8'];
const GLASS = ['#5d89b8', '#4f7ba8', '#6c9cc4', '#4d6f92'];

function drawZoneBuilding(ctx, x, y, px, py, ts, z, t) {
  const L = t.level;
  const s = ts / 32; // 스케일
  const hv = hash2(x, y);
  const dark = !t.powered;
  if (t.type === 'res') {
    if (L === 1) {
      const wall = pick(WALL_RES, x, y), roof = pick(ROOF_RES, x, y, 3);
      box(ctx, px + 6 * s, py + 9 * s, 20 * s, 16 * s, 7 * s, roof, shade(wall, -0.1));
      ctx.fillStyle = shade(roof, -0.25);
      ctx.fillRect(px + 6 * s, py + 9 * s - 7 * s + 7 * s, 20 * s, 2 * s);
      ctx.fillStyle = '#5a3d2a';
      ctx.fillRect(px + 14 * s, py + 25 * s - 5 * s, 4 * s, 5 * s);
    } else if (L === 2) {
      const wall = pick(WALL_RES, x, y, 5);
      box(ctx, px + 3 * s, py + 5 * s, 26 * s, 24 * s, 16 * s, shade(wall, -0.05), shade(wall, -0.2), dark ? '#555' : '#8fb6d8');
    } else {
      const wall = pick(['#d8d0c4', '#c9c2b8', '#e3d9c6'], x, y, 9);
      box(ctx, px + 4 * s, py + 4 * s, 24 * s, 24 * s, 34 * s, shade(wall, 0.05), shade(wall, -0.22), dark ? '#555' : '#ffe9a8');
    }
  } else if (t.type === 'com') {
    if (L === 1) {
      const c = pick(['#4a90d9', '#d9534a', '#5cb85c', '#9b59b6'], x, y, 2);
      box(ctx, px + 4 * s, py + 7 * s, 24 * s, 20 * s, 9 * s, '#dfe3e8', '#c6ccd3');
      ctx.fillStyle = c;
      ctx.fillRect(px + 4 * s, py + 27 * s - 9 * s, 24 * s, 3 * s);
    } else if (L === 2) {
      const g = pick(GLASS, x, y, 4);
      box(ctx, px + 4 * s, py + 4 * s, 24 * s, 24 * s, 22 * s, shade(g, 0.25), g, dark ? '#334' : '#bfe0ff');
    } else {
      const g = pick(GLASS, x, y, 8);
      box(ctx, px + 5 * s, py + 5 * s, 22 * s, 22 * s, (46 + hv * 12) * s, shade(g, 0.3), shade(g, -0.1), dark ? '#334' : '#dff1ff');
      ctx.fillStyle = '#c0c8d0';
      ctx.fillRect(px + 14 * s, py + 5 * s - (46 + hv * 12) * s - 5 * s, 1.5 * s, 5 * s);
    }
  } else if (t.type === 'ind') {
    const chim = (cx, cy, h) => {
      ctx.fillStyle = '#7b6f66';
      ctx.fillRect(cx, cy - h, 4 * s, h);
      ctx.fillStyle = '#a33';
      ctx.fillRect(cx, cy - h, 4 * s, 2 * s);
      if (t.powered && Math.random() < 0.04) spawnSmoke(cx + 2 * s, cy - h, z);
    };
    if (L === 1) {
      box(ctx, px + 4 * s, py + 8 * s, 24 * s, 18 * s, 8 * s, '#b49a6e', '#8f7a56');
    } else if (L === 2) {
      box(ctx, px + 3 * s, py + 6 * s, 26 * s, 22 * s, 12 * s, '#a0a4a8', '#7e8287');
      chim(px + 22 * s, py + 12 * s - 12 * s + 6 * s, 14 * s);
    } else {
      box(ctx, px + 2 * s, py + 5 * s, 28 * s, 24 * s, 16 * s, '#8d969c', '#6b7378');
      ctx.fillStyle = '#e0b030';
      ctx.fillRect(px + 2 * s, py + 5 * s - 16 * s + 3 * s, 28 * s, 2 * s);
      chim(px + 6 * s, py + 2 * s, 18 * s);
      chim(px + 20 * s, py + 2 * s, 22 * s);
    }
  }
}

function drawFacility(ctx, x, y, px, py, ts, z, t) {
  const s = ts / 32;
  const d = DEFS[t.type];
  const W = d.size * ts;
  const icon = (ic, cx, cy, size) => {
    if (z < 0.45) return;
    ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ic, cx, cy);
  };
  switch (t.type) {
    case 'levee': {
      const northSouthWater = [-1, 1].some(dy => inMap(x, y + dy) && S.tiles[idx(x, y + dy)].t === TERRAIN.WATER);
      ctx.fillStyle = '#71816e'; ctx.fillRect(px + 2 * s, py + 3 * s, 28 * s, 27 * s);
      if (northSouthWater) {
        box(ctx, px + s, py + 12 * s, 30 * s, 11 * s, 5 * s, '#b8b5a2', '#787e77');
        ctx.strokeStyle = '#8c9185'; ctx.lineWidth = s;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + k * 8 * s, py + 7 * s); ctx.lineTo(px + k * 8 * s, py + 18 * s); ctx.stroke(); }
      } else {
        box(ctx, px + 10 * s, py + 5 * s, 12 * s, 26 * s, 5 * s, '#b8b5a2', '#787e77');
        ctx.strokeStyle = '#8c9185'; ctx.lineWidth = s;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + 10 * s, py + k * 7 * s); ctx.lineTo(px + 22 * s, py + k * 7 * s); ctx.stroke(); }
      }
      break;
    }
    case 'landfill': {
      ctx.fillStyle = '#77634c'; ctx.fillRect(px + 4 * s, py + 4 * s, W - 8 * s, W - 8 * s);
      ctx.strokeStyle = '#b3b095'; ctx.lineWidth = 2 * s;
      ctx.strokeRect(px + 5 * s, py + 5 * s, W - 10 * s, W - 10 * s);
      const filled = Math.ceil(Math.max(0, Math.min(1, (t.landfillStored || 0) / d.wasteCapacity)) * 9);
      for (let k = 0; k < 9; k++) {
        const bx = px + (11 + k % 3 * 27) * s, by = py + (14 + Math.floor(k / 3) * 25) * s;
        ctx.fillStyle = k < filled ? ['#a49a80','#8c9a85','#b3a08a'][k % 3] : '#65513d';
        ctx.fillRect(bx, by, 21 * s, 16 * s);
        if (k < filled) { ctx.fillStyle = '#c2b698'; ctx.fillRect(bx + 4 * s, by - 3 * s, 12 * s, 5 * s); }
      }
      icon('🗑️', px + 78 * s, py + 13 * s, 14 * s);
      break;
    }
    case 'incinerator':
      box(ctx, px + 5 * s, py + 25 * s, 47 * s, 32 * s, 18 * s, '#ac8c6b', '#7c6856', '#ddbc77');
      ctx.fillStyle = '#667174'; ctx.fillRect(px + 45 * s, py + 2 * s, 9 * s, 30 * s);
      ctx.fillStyle = '#a95e4d'; ctx.fillRect(px + 45 * s, py + 2 * s, 9 * s, 5 * s);
      ctx.fillStyle = '#384b47'; ctx.fillRect(px + 12 * s, py + 40 * s, 13 * s, 17 * s);
      ctx.fillStyle = '#d4ae63'; ctx.fillRect(px + 8 * s, py + 30 * s, 37 * s, 3 * s);
      icon('♨', px + 31 * s, py + 28 * s, 12 * s);
      break;
    case 'recycling':
      box(ctx, px + 5 * s, py + 17 * s, 52 * s, 39 * s, 14 * s, '#75a286', '#47775d', '#c0d8ba');
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = ['#5986aa','#c1a15d','#79a56b'][k];
        ctx.fillRect(px + (9 + k * 17) * s, py + 44 * s, 12 * s, 14 * s);
        ctx.fillStyle = '#d0d3b8'; ctx.fillRect(px + (8 + k * 17) * s, py + 43 * s, 14 * s, 3 * s);
      }
      icon('♻️', px + 31 * s, py + 17 * s, 18 * s);
      break;
    case 'busstop':
      ctx.fillStyle = '#d4cbb5';
      ctx.fillRect(px + 2 * s, py + 20 * s, 28 * s, 9 * s);
      ctx.fillStyle = '#46685c';
      ctx.fillRect(px + 5 * s, py + 10 * s, 2 * s, 16 * s);
      ctx.fillRect(px + 22 * s, py + 10 * s, 2 * s, 16 * s);
      ctx.fillStyle = '#94b9ac';
      ctx.fillRect(px + 7 * s, py + 12 * s, 15 * s, 11 * s);
      ctx.fillStyle = '#3e806b';
      ctx.fillRect(px + 3 * s, py + 7 * s, 23 * s, 5 * s);
      ctx.fillStyle = '#b99a65';
      ctx.fillRect(px + 8 * s, py + 23 * s, 13 * s, 3 * s);
      ctx.fillStyle = '#d2b85d';
      ctx.fillRect(px + 27 * s, py + 11 * s, 2 * s, 17 * s);
      icon('🚏', px + 28 * s, py + 7 * s, 11 * s);
      break;
    case 'subway':
      ctx.fillStyle = '#c2c5bf';
      ctx.fillRect(px + 4 * s, py + 8 * s, W - 8 * s, W - 12 * s);
      ctx.fillStyle = '#243f48';
      ctx.fillRect(px + 14 * s, py + 26 * s, 36 * s, 28 * s);
      for (let step = 0; step < 5; step++) {
        ctx.fillStyle = step % 2 ? '#6e8587' : '#8fa1a0';
        ctx.fillRect(px + 16 * s, py + (28 + step * 4) * s, 32 * s, 2 * s);
      }
      ctx.fillStyle = '#54747c';
      ctx.fillRect(px + 9 * s, py + 15 * s, 4 * s, 40 * s);
      ctx.fillRect(px + 51 * s, py + 15 * s, 4 * s, 40 * s);
      ctx.fillStyle = '#547fb0';
      ctx.fillRect(px + 8 * s, py + 11 * s, 48 * s, 14 * s);
      ctx.fillStyle = '#eef6ed';
      icon('M', px + 32 * s, py + 18 * s, 13 * s);
      break;
    case 'power': {
      box(ctx, px + 4 * s, py + 26 * s, 34 * s, 30 * s, 16 * s, '#8a8f94', '#6d7277', '#d9d36a');
      // 냉각탑
      for (const [ox, oy] of [[44, 14], [44, 40]]) {
        ctx.fillStyle = '#c9ccce';
        ctx.beginPath(); ctx.ellipse(px + ox * s, py + oy * s, 10 * s, 8 * s, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#5c6166';
        ctx.beginPath(); ctx.ellipse(px + ox * s, py + oy * s, 6 * s, 4.5 * s, 0, 0, 7); ctx.fill();
        if (Math.random() < 0.15) spawnSmoke(px + ox * s, py + oy * s, z, true);
      }
      ctx.fillStyle = '#e8c21a';
      ctx.fillRect(px + 4 * s, py + 10 * s, 34 * s, 3 * s);
      break;
    }
    case 'solar': {
      ctx.fillStyle = '#c9cfc0';
      ctx.fillRect(px + 2 * s, py + 2 * s, W - 4 * s, W - 4 * s);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        ctx.fillStyle = '#26476e';
        ctx.fillRect(px + (5 + c * 19) * s, py + (5 + r * 14) * s, 16 * s, 10 * s);
        ctx.fillStyle = 'rgba(160,200,255,0.35)';
        ctx.fillRect(px + (5 + c * 19) * s, py + (5 + r * 14) * s, 16 * s, 2 * s);
      }
      break;
    }
    case 'watertower': {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(px + 19 * s, py + 26 * s, 10 * s, 4 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#7d8b96';
      ctx.fillRect(px + 10 * s, py + 12 * s, 2.5 * s, 16 * s);
      ctx.fillRect(px + 20 * s, py + 12 * s, 2.5 * s, 16 * s);
      ctx.fillStyle = '#5aa0d8';
      ctx.beginPath(); ctx.ellipse(px + 16 * s, py + 10 * s, 11 * s, 9 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8cc4ee';
      ctx.beginPath(); ctx.ellipse(px + 13 * s, py + 7 * s, 4 * s, 3 * s, 0, 0, 7); ctx.fill();
      break;
    }
    case 'pump': {
      box(ctx, px + 5 * s, py + 9 * s, 22 * s, 18 * s, 9 * s, '#6ea7cf', '#4f86ad');
      icon('💧', px + 16 * s, py + 9 * s, 12 * s);
      break;
    }
    case 'police':
      box(ctx, px + 3 * s, py + 6 * s, 26 * s, 22 * s, 12 * s, '#3f63b0', '#2f4d8c', '#bcd3ff');
      icon('🚓', px + 16 * s, py, 13 * s);
      break;
    case 'fire':
      box(ctx, px + 3 * s, py + 6 * s, 26 * s, 22 * s, 12 * s, '#c84436', '#9d3226', '#ffd2c2');
      icon('🚒', px + 16 * s, py, 13 * s);
      break;
    case 'school':
      ctx.fillStyle = '#c46c3f';
      ctx.beginPath(); ctx.ellipse(px + 44 * s, py + 40 * s, 15 * s, 18 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6dab5a';
      ctx.beginPath(); ctx.ellipse(px + 44 * s, py + 40 * s, 10 * s, 13 * s, 0, 0, 7); ctx.fill();
      box(ctx, px + 4 * s, py + 20 * s, 26 * s, 36 * s, 16 * s, '#d98c4a', '#b06c33', '#fff0c8');
      icon('🏫', px + 17 * s, py + 22 * s, 14 * s);
      break;
    case 'hospital':
      box(ctx, px + 6 * s, py + 14 * s, 52 * s, 44 * s, 24 * s, '#f1f3f5', '#cfd5da', '#9fc6e8');
      ctx.fillStyle = '#e03131';
      ctx.fillRect(px + 28 * s, py + 14 * s - 24 * s + 10 * s, 8 * s, 22 * s);
      ctx.fillRect(px + 21 * s, py + 14 * s - 24 * s + 17 * s, 22 * s, 8 * s);
      break;
    case 'stadium': {
      const c = 48 * s;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(px + c + 6 * s, py + c + 6 * s, 44 * s, 40 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#d5d9de';
      ctx.beginPath(); ctx.ellipse(px + c, py + c - 6 * s, 44 * s, 40 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath(); ctx.ellipse(px + c, py + c - 6 * s, 36 * s, 32 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#4caf50';
      ctx.beginPath(); ctx.ellipse(px + c, py + c - 6 * s, 26 * s, 21 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2 * s;
      ctx.strokeRect(px + c - 18 * s, py + c - 20 * s, 36 * s, 28 * s);
      ctx.beginPath(); ctx.moveTo(px + c, py + c - 20 * s); ctx.lineTo(px + c, py + c + 8 * s); ctx.stroke();
      break;
    }
    case 'hotel':
      box(ctx, px + 7 * s, py + 17 * s, 36 * s, 39 * s, 34 * s, '#c9d6bd', '#91a385', t.powered ? '#f2dfa5' : '#4a5550');
      box(ctx, px + 43 * s, py + 35 * s, 15 * s, 21 * s, 13 * s, '#7b9979', '#527451');
      ctx.fillStyle = '#bc9870';
      ctx.fillRect(px + 17 * s, py + 50 * s, 15 * s, 6 * s);
      icon('H', px + 25 * s, py - 10 * s, 14 * s);
      break;
    case 'observation':
      ctx.fillStyle = '#9caea0';
      ctx.fillRect(px + 28 * s, py + 3 * s, 9 * s, 49 * s);
      ctx.fillStyle = '#bcc6b6';
      ctx.fillRect(px + 18 * s, py + 49 * s, 29 * s, 7 * s);
      ctx.fillStyle = '#6f9683';
      ctx.beginPath(); ctx.ellipse(px + 32 * s, py + 3 * s, 21 * s, 10 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#bedbc7';
      ctx.beginPath(); ctx.ellipse(px + 32 * s, py - 3 * s, 21 * s, 8 * s, 0, 0, 7); ctx.fill();
      break;
    case 'university':
      ctx.fillStyle = '#54764d';
      ctx.fillRect(px + 5 * s, py + 5 * s, 86 * s, 86 * s);
      box(ctx, px + 8 * s, py + 13 * s, 23 * s, 64 * s, 19 * s, '#d7c7aa', '#b69d7e', '#d3e1d7');
      box(ctx, px + 65 * s, py + 13 * s, 23 * s, 64 * s, 19 * s, '#d7c7aa', '#b69d7e', '#d3e1d7');
      box(ctx, px + 31 * s, py + 13 * s, 34 * s, 24 * s, 27 * s, '#a3af99', '#7d8c72', '#e5dbb4');
      ctx.fillStyle = '#c8c6a6'; ctx.fillRect(px + 43 * s, py + 37 * s, 10 * s, 52 * s);
      icon('🎓', px + 48 * s, py + 3 * s, 17 * s);
      break;
    case 'research':
      box(ctx, px + 5 * s, py + 13 * s, 34 * s, 43 * s, 24 * s, '#b9d2ca', '#719c91', t.powered ? '#d2ede0' : '#425e56');
      box(ctx, px + 40 * s, py + 30 * s, 19 * s, 26 * s, 14 * s, '#d2d6c3', '#9ca58e');
      ctx.fillStyle = '#cbdcca';
      ctx.beginPath(); ctx.ellipse(px + 23 * s, py - 12 * s, 11 * s, 6 * s, -0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#d7e2ca'; ctx.fillRect(px + 22 * s, py - 12 * s, 2 * s, 12 * s);
      break;
    case 'logistics':
      box(ctx, px + 6 * s, py + 12 * s, 84 * s, 48 * s, 16 * s, '#bcc0a7', '#858f73');
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = '#43594a'; ctx.fillRect(px + (12 + k * 19) * s, py + 44 * s, 12 * s, 16 * s);
        ctx.fillStyle = ['#8b9f70','#b5a079','#849c91','#bb9270'][k];
        ctx.fillRect(px + (10 + k * 21) * s, py + 70 * s, 17 * s, 15 * s);
      }
      break;
    case 'advancedFactory':
      box(ctx, px + 5 * s, py + 13 * s, 54 * s, 69 * s, 22 * s, '#a8c2ae', '#708f79', t.powered ? '#d3e7c4' : '#455e4b');
      box(ctx, px + 61 * s, py + 39 * s, 29 * s, 43 * s, 15 * s, '#c1c8b6', '#909f87');
      for (let row = 0; row < 3; row++) {
        ctx.fillStyle = '#3f685c'; ctx.fillRect(px + 12 * s, py + (8 + row * 16) * s, 39 * s, 9 * s);
        ctx.fillStyle = '#8dbb9f'; ctx.fillRect(px + 12 * s, py + (8 + row * 16) * s, 39 * s, 2 * s);
      }
      icon('⚙️', px + 75 * s, py + 38 * s, 17 * s);
      break;
  }
}

function drawFire(ctx, px, py, ts) {
  const tm = R.time * 10;
  for (let k = 0; k < 4; k++) {
    const fx = px + ts * (0.25 + 0.17 * k), fy = py + ts * (0.55 + 0.1 * Math.sin(tm + k));
    const r = ts * (0.14 + 0.05 * Math.sin(tm * 1.3 + k * 2));
    ctx.fillStyle = 'rgba(255,90,20,0.85)';
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,60,0.9)';
    ctx.beginPath(); ctx.arc(fx, fy + r * 0.2, r * 0.55, 0, 7); ctx.fill();
  }
  if (Math.random() < 0.3) spawnSmoke(px + ts / 2, py + ts * 0.3, ts / TILE, true);
}

// ---------- 파티클 ----------
function spawnSmoke(x, y, z, big) {
  if (R.particles.length > 500) return;
  R.particles.push({ x, y, vx: (Math.random() - 0.3) * 6 * z, vy: -(10 + Math.random() * 8) * z, life: 0, max: 2 + Math.random() * 1.5, r: (big ? 4 : 2.5) * z, z });
}
function drawParticles(ctx, dt, z) {
  const ps = R.particles;
  for (let k = ps.length - 1; k >= 0; k--) {
    const p = ps[k];
    p.life += dt;
    if (p.life > p.max || Math.abs(p.z - z) > 0.001) { ps.splice(k, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const a = 1 - p.life / p.max;
    ctx.fillStyle = `rgba(210,210,210,${0.45 * a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.life * 1.2), 0, 7); ctx.fill();
  }
}

// ---------- 차량 ----------
const CAR_COLORS = ['#e74c3c', '#f1c40f', '#ecf0f1', '#3498db', '#2ecc71', '#34495e', '#e67e22'];
const TRAFFIC_STOP = 0.80, TRAFFIC_CLEAR = 0.20, TRAFFIC_STEP = 0.025;

function roadNeighbors(i) {
  if (!S.tiles[i] || S.tiles[i].type !== 'road' || S.tiles[i].flooded) return [];
  const x = i % MAP_W, y = Math.floor(i / MAP_W);
  return DIR4.filter(([dx,dy]) => isRoad(x+dx,y+dy) && !S.tiles[idx(x+dx,y+dy)].flooded).map(([dx,dy]) => idx(x+dx,y+dy));
}

function trafficSignal(i, axis) {
  // 차량과 같은 시계를 사용하므로 일시정지·배속에도 신호와 이동이 일치한다.
  const time = R.trafficCity && R.trafficCity !== S ? 0 : R.trafficTime || 0;
  const phase = (time % 16 + 16) % 16;
  if (axis === 'horizontal') return phase < 6 ? 'green' : phase < 7 ? 'amber' : 'red';
  return phase >= 8 && phase < 14 ? 'green' : phase >= 14 && phase < 15 ? 'amber' : 'red';
}

function getCarPose(c) {
  const x = c.i % MAP_W + .5, y = Math.floor(c.i / MAP_W) + .5;
  let ox = c.ni >= 0 ? c.ni % MAP_W - c.i % MAP_W : 0;
  let oy = c.ni >= 0 ? Math.floor(c.ni / MAP_W) - Math.floor(c.i / MAP_W) : 0;
  let ix = c.prev >= 0 ? c.i % MAP_W - c.prev % MAP_W : ox;
  let iy = c.prev >= 0 ? Math.floor(c.i / MAP_W) - Math.floor(c.prev / MAP_W) : oy;
  if (!ix && !iy) ix = 1;
  if (!ox && !oy) { ox = ix; oy = iy; }
  // 한 칸의 진입 경계부터 출구 경계까지 주행하므로 칸이 바뀌어도 차선이 이어진다.
  const ax = x-ix*.5-iy*.16, ay = y-iy*.5+ix*.16;
  const bx = x+ox*.5-oy*.16, by = y+oy*.5+ox*.16;
  const t = c.t, u = 1-t;
  let px, py, dx, dy;
  if (ix === ox && iy === oy) {
    px = ax+(bx-ax)*t; py = ay+(by-ay)*t; dx = ox; dy = oy;
  } else {
    const qx = ix ? bx : ax, qy = ix ? ay : by;
    px = u*u*ax+2*u*t*qx+t*t*bx; py = u*u*ay+2*u*t*qy+t*t*by;
    dx = 2*(u*(qx-ax)+t*(bx-qx)); dy = 2*(u*(qy-ay)+t*(by-qy));
  }
  const length = Math.hypot(dx,dy) || 1;
  return { x:px,y:py,angle:Math.atan2(dy,dx),ux:dx/length,uy:dy/length };
}

function carBodiesOverlap(a,b,padding=0) {
  // 차체 .26 × .15에 여유를 더해 회전 중에도 실제 도형이 겹치지 않게 한다.
  const dx = b.x-a.x, dy = b.y-a.y;
  if (Math.abs(dx) > .5+padding*3 || Math.abs(dy) > .5+padding*3) return false;
  for (const [x,y] of [[a.ux,a.uy],[-a.uy,a.ux],[b.ux,b.uy],[-b.uy,b.ux]]) {
    const radius = p => (.17+padding)*Math.abs(p.ux*x+p.uy*y)+(.095+padding)*Math.abs(-p.uy*x+p.ux*y);
    if (Math.abs(dx*x+dy*y) >= radius(a)+radius(b)-1e-9) return false;
  }
  return true;
}

function trafficIndex() {
  const poses = new Map(), bins = new Map();
  const key = p => `${Math.floor(p.x)},${Math.floor(p.y)}`;
  const remove = c => {
    const old = poses.get(c);
    if (old) { const bin = bins.get(key(old)); bin.splice(bin.indexOf(c),1); }
    poses.delete(c);
  };
  const put = (c,p) => {
    remove(c);
    const k = key(p);
    if (!bins.has(k)) bins.set(k,[]);
    bins.get(k).push(c); poses.set(c,p);
  };
  const free = (p,except) => {
    const x = Math.floor(p.x), y = Math.floor(p.y);
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
      for (const c of bins.get(`${x+dx},${y+dy}`) || []) {
        if (c !== except && carBodiesOverlap(p,poses.get(c))) return false;
      }
    }
    return true;
  };
  for (const c of R.cars) put(c,getCarPose(c));
  return { put,remove,free };
}

function syncTrafficRoads(paused = false) {
  // 정지 중에도 사라지거나 잠긴 도로는 반영하되, 같은 지도에서는 차량·시계를 그대로 둔다.
  if (paused && R.trafficCity === S && R.trafficRoadMask
      && !S.tiles.some((t,i) => R.trafficRoadMask[i] !== (t.type === 'road' && !t.flooded ? 1 : 0))) return;
  if (R.trafficCity && R.trafficCity !== S) R.cars = [];
  if (R.trafficCity !== S || R.trafficCars !== R.cars) {
    R.trafficTime = R.trafficCity && R.trafficCity !== S ? 0 : R.trafficTime || 0;
    R.trafficCity = S; R.trafficCars = R.cars;
    R.trafficRoadMask = null;
    R.trafficAccumulator = 0; R.trafficSpawnCredit = 0; R.trafficPruneCredit = 0;
  }
  let changed = !R.trafficRoadMask;
  const mask = R.trafficRoadMask || new Uint8Array(S.tiles.length);
  for (let i=0;i<S.tiles.length;i++) {
    const road = S.tiles[i].type === 'road' && !S.tiles[i].flooded ? 1 : 0;
    if (mask[i] !== road) { mask[i] = road; changed = true; }
  }
  if (!changed) return;
  R.trafficRoadMask = mask;
  R.trafficRoadVersion = (R.trafficRoadVersion || 0)+1; R.trafficDemand = null;
  R.trafficGroups = new Map(); R.trafficClaims = new Map();
  R.trafficPaths = new Map(); R.trafficPlans = new WeakMap();
  const junctions = new Set();
  for (let i=0;i<mask.length;i++) if (mask[i] && roadNeighbors(i).length >= 3) junctions.add(i);
  // 붙어 있는 교차로는 출구까지 경로를 계획하되, 예약은 충돌하는 경로끼리만 제한한다.
  for (const start of junctions) {
    if (R.trafficGroups.has(start)) continue;
    const queue = [start]; R.trafficGroups.set(start,start);
    for (let p=0;p<queue.length;p++) for (const n of roadNeighbors(queue[p])) {
      if (junctions.has(n) && !R.trafficGroups.has(n)) { R.trafficGroups.set(n,start); queue.push(n); }
    }
  }
  for (let k=R.cars.length-1;k>=0;k--) {
    const c = R.cars[k], route = c.route || [], approved = c.junction !== undefined;
    const entered = c.enteredJunction, routeValid = route.every(i => mask[i]);
    c.route = approved && routeValid ? route : [];
    delete c.nextAfter; delete c.rerouteAt; delete c.junction; delete c.enteredJunction;
    // prev는 이미 지나온 칸의 방향 정보다. 현재 칸·앞길이 유효하면 주행을 계속한다.
    if (!mask[c.i] || (c.ni >= 0 && !mask[c.ni])) { R.cars.splice(k,1); continue; }
    const group = R.trafficGroups.get(c.i) ?? (c.t < TRAFFIC_CLEAR ? R.trafficGroups.get(c.prev) : undefined)
      ?? (approved && routeValid && c.t > TRAFFIC_STOP ? R.trafficGroups.get(c.ni) : undefined);
    if (group !== undefined) {
      if (!(approved && routeValid) && R.trafficGroups.get(c.ni) === group) c.route = junctionRoute(c,group);
      c.enteredJunction = !(approved && !entered && R.trafficGroups.get(c.i) !== group);
      reserveTrafficPath(c,group);
    }
  }
}

function junctionRoutes(c,group) {
  const queue = [[c.ni]], seen = new Set([c.i,c.ni]);
  const routes = [], exits = new Set();
  const dx = c.ni % MAP_W-c.i % MAP_W, dy = Math.floor(c.ni/MAP_W)-Math.floor(c.i/MAP_W);
  for (let p=0;p<queue.length;p++) {
    const path = queue[p], current = path[path.length-1], neighbors = roadNeighbors(current);
    // 넓은 도로도 입구 쪽으로 돌아나오지 않고 진행 방향으로 이어지는 길을 먼저 찾는다.
    neighbors.sort((a,b) => ((b%MAP_W-current%MAP_W)*dx+(Math.floor(b/MAP_W)-Math.floor(current/MAP_W))*dy)
      -((a%MAP_W-current%MAP_W)*dx+(Math.floor(a/MAP_W)-Math.floor(current/MAP_W))*dy));
    for (const next of neighbors) {
      if (seen.has(next)) continue;
      const route = [...path,next];
      if (R.trafficGroups.get(next) !== group) {
        if (!exits.has(next)) { exits.add(next); routes.push(route.slice(1)); }
        continue;
      }
      seen.add(next); queue.push(route);
    }
  }
  const score = route => {
    const exit = route[route.length-1], ex = exit%MAP_W-c.i%MAP_W, ey = Math.floor(exit/MAP_W)-Math.floor(c.i/MAP_W);
    return (ex*dx+ey*dy)*10-Math.abs(ex*dy-ey*dx);
  };
  return routes.sort((a,b) => score(b)-score(a));
}

function junctionRoute(c,group) {
  const routes = junctionRoutes(c,group);
  // 단일 교차로는 직진·좌우회전을 고르고, 연속된 교차로는 먼 전방 출구를 우선한다.
  if (routes.length && routes.every(route => route.length === 1)) return routes[Math.floor(Math.random()*routes.length)];
  return routes[0] || [];
}

function trafficPath(c) {
  const nodes = [c.i,c.ni,...c.route].filter(i => i >= 0);
  const key = nodes.join(':');
  const cached = R.trafficPlans.get(c);
  if (cached?.key === key) return cached;
  const poses = [], bins = new Map();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (let n=0;n<nodes.length;n++) {
    const i = nodes[n], prev = n ? nodes[n-1] : c.prev;
    const ni = nodes[n+1] ?? roadNeighbors(i).find(j => j !== prev) ?? -1;
    const first = n ? 0 : c.enteredJunction ? c.t : TRAFFIC_STOP;
    const last = n === nodes.length-1 ? .6 : 1;
    for (let t=first;t<=last+1e-9;t+=.05) {
      const pose = { ...getCarPose({i,ni,prev,t}),progress:n+t };
      poses.push(pose);
      minX=Math.min(minX,pose.x); minY=Math.min(minY,pose.y);
      maxX=Math.max(maxX,pose.x); maxY=Math.max(maxY,pose.y);
      const bin = `${Math.floor(pose.x)},${Math.floor(pose.y)}`;
      if (!bins.has(bin)) bins.set(bin,[]);
      bins.get(bin).push(pose);
    }
  }
  const path = { key,nodes,poses,bins,minX,minY,maxX,maxY,minProgress:0 };
  R.trafficPlans.set(c,path);
  return path;
}

function trafficPoseConflicts(p,path) {
  if (p.x < path.minX-.61 || p.x > path.maxX+.61 || p.y < path.minY-.61 || p.y > path.maxY+.61) return false;
  const x = Math.floor(p.x), y = Math.floor(p.y);
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
    for (const q of path.bins.get(`${x+dx},${y+dy}`) || []) {
      if (q.progress+1e-9 >= path.minProgress && carBodiesOverlap(p,q,.035)) return true;
    }
  }
  return false;
}

function trafficPathFree(c,path) {
  for (const [other,occupied] of R.trafficPaths) {
    // 같은 경로의 차는 실제 차간 거리로 추종하고, 교차·합류하는 다른 경로는 기다린다.
    if (other === c || occupied.key === path.key) continue;
    // 먼 교차로는 차체 여유보다 넓은 경계로 먼저 제외해 정밀 검사 비용을 줄인다.
    if (path.maxX+.61 < occupied.minX || path.minX-.61 > occupied.maxX
        || path.maxY+.61 < occupied.minY || path.minY-.61 > occupied.maxY) continue;
    if (path.poses.some(p => p.progress+1e-9 >= path.minProgress && trafficPoseConflicts(p,occupied))) return false;
  }
  return true;
}

function reserveTrafficPath(c,group) {
  if (!R.trafficClaims.has(group)) R.trafficClaims.set(group,new Set());
  R.trafficClaims.get(group).add(c);
  R.trafficPaths.set(c,trafficPath(c));
  c.junction = group;
}

function releaseTrafficClaim(c) {
  const owners = R.trafficClaims?.get(c.junction);
  owners?.delete(c);
  if (owners?.size === 0) R.trafficClaims.delete(c.junction);
  R.trafficPaths?.delete(c);
  R.trafficPlans?.delete(c);
  delete c.junction; delete c.enteredJunction;
}

function trafficSpawnClear(c,index) {
  const pose = getCarPose(c);
  return index.free(pose,c) && [...R.trafficPaths.values()].every(path => !trafficPoseConflicts(pose,path));
}

function junctionExitFree(c,index) {
  const exit = c.route[c.route.length-1];
  if (exit === undefined) return false;
  const prev = c.route.length > 1 ? c.route[c.route.length-2] : c.ni;
  const next = roadNeighbors(exit).find(i => i !== prev) ?? -1;
  for (const t of [0,.2,.4,.6]) if (!index.free(getCarPose({i:exit,prev,ni:next,t}),c)) return false;
  return true;
}

function prepareJunctionRoute(c,group,index) {
  if (!c.route.length) c.route = junctionRoute(c,group);
  if (junctionExitFree(c,index)) return true;
  if ((c.rerouteAt || 0) > R.trafficTime) return false;
  c.rerouteAt = R.trafficTime+.5;
  const blocked = c.route;
  for (const route of junctionRoutes(c,group)) {
    c.route = route;
    if (junctionExitFree(c,index) && trafficPathFree(c,trafficPath(c))) {
      delete c.nextAfter;
      return true;
    }
  }
  c.route = blocked;
  return false;
}

// 차량 수요는 서로 떨어진 도로의 여유를 공유하지 않고, 도로 변경 때만 다시 집계한다.
function trafficTarget() {
  if (!S) return 0;
  const version = R.trafficRoadVersion || 0;
  if (!R.trafficDemand || R.trafficDemand.city !== S || R.trafficDemand.version !== version
      || R.trafficDemand.mask !== R.trafficRoadMask) {
    const byRoad = new Int32Array(S.tiles.length).fill(-1), roads = [], capacities = [];
    for (let i=0;i<S.tiles.length;i++) {
      if (S.tiles[i].type !== 'road' || S.tiles[i].flooded || byRoad[i] >= 0) continue;
      const component = capacities.length, queue = [i];
      byRoad[i] = component;
      let junctions = 0;
      for (let p=0;p<queue.length;p++) {
        const neighbors = roadNeighbors(queue[p]);
        if (neighbors.length >= 3) junctions++;
        for (const next of neighbors) if (byRoad[next] < 0) {
          byRoad[next] = component; queue.push(next);
        }
      }
      // 교차로가 많은 망은 대기 공간을 더 남긴다. 고립된 한 칸에는 차를 만들지 않는다.
      const capacity = queue.length < 2 ? 0
        : Math.max(1, Math.floor(.35 * queue.length / (1 + 4 * junctions / queue.length)));
      capacities.push(capacity);
      if (capacity) roads.push(...queue);
    }
    R.trafficDemand = { city:S, version, mask:R.trafficRoadMask, byRoad, roads, capacities,
      capacity:capacities.reduce((sum,n) => sum+n,0) };
  }
  return Math.max(0,Math.min(220,Math.floor(S.stats.pop/18),R.trafficDemand.capacity));
}

// 실제 출근 통행량을 생성 위치에 반영한다. 안전한 차량 수와 생성 간격은 기존 제한을 따른다.
function trafficSpawnRoad(demand) {
  const revision = typeof TRAFFIC !== 'undefined' ? TRAFFIC.revision : 0;
  if (demand.loadRevision !== revision || !demand.roadWeights) {
    demand.roadWeights = new Float64Array(demand.roads.length);
    demand.weightTotal = 0;
    demand.roads.forEach((i, k) => {
      const load = S.tiles[i].trafficLoad;
      demand.weightTotal += 1 + (Number.isFinite(load) ? Math.max(0, load) / 40 : 0);
      demand.roadWeights[k] = demand.weightTotal;
    });
    demand.loadRevision = revision;
  }
  const choice = Math.random() * demand.weightTotal;
  let low = 0, high = demand.roads.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (choice < demand.roadWeights[mid]) high = mid;
    else low = mid + 1;
  }
  return demand.roads[low];
}

function spawnTraffic(index, step = .025) {
  if (!S || !(step > 0) || !Number.isFinite(step)) return;
  const target = trafficTarget(), demand = R.trafficDemand;
  if (R.cars.length >= target || !demand.roads.length) { R.trafficSpawnCredit = 0; return; }
  const rate = Math.min(3,1+target/60);
  R.trafficSpawnCredit = Math.min(3,(R.trafficSpawnCredit || 0)+step*rate);
  if (R.trafficSpawnCredit < 1-1e-9) return;
  const counts = new Int32Array(demand.capacities.length);
  for (const c of R.cars) if (demand.byRoad[c.i] >= 0) counts[demand.byRoad[c.i]]++;
  while (R.trafficSpawnCredit >= 1-1e-9 && R.cars.length < target) {
    R.trafficSpawnCredit = Math.max(0,R.trafficSpawnCredit-1);
    for (let tries=0;tries<20;tries++) {
      const i = trafficSpawnRoad(demand);
      const component = demand.byRoad[i];
      if (counts[component] >= demand.capacities[component] || R.trafficGroups.has(i)) continue;
      const neighbors = roadNeighbors(i), ni = nextRoad(i,-1);
      if (ni < 0) continue;
      const c = { i,ni,prev:neighbors.find(n => n !== ni) ?? -1,t:.5,route:[],
        c:CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)],sp:1.2+Math.random()*.8 };
      const pose = getCarPose(c);
      if (!index.free(pose,c) || (typeof trafficSpawnClear === 'function' && !trafficSpawnClear(c,index))) continue;
      R.cars.push(c); counts[component]++; index.put(c,pose); break;
    }
  }
}

function pruneTraffic(index, step = .025) {
  if (!S || !(step > 0) || !Number.isFinite(step)) return;
  const target = trafficTarget(), demand = R.trafficDemand;
  R.trafficPruneCredit = Math.min(2,(R.trafficPruneCredit || 0)+step*2);
  if (R.trafficPruneCredit < 1-1e-9) return;
  const counts = new Int32Array(demand.capacities.length);
  for (const c of R.cars) if (demand.byRoad[c.i] >= 0) counts[demand.byRoad[c.i]]++;
  while (R.trafficPruneCredit >= 1-1e-9) {
    const overloaded = c => {
      const component = demand.byRoad[c.i];
      return component < 0 || counts[component] > demand.capacities[component];
    };
    const localExcess = R.cars.some(overloaded);
    if (!localExcess && R.cars.length <= target) { R.trafficPruneCredit = 0; return; }
    let chosen = -1;
    for (let k=R.cars.length-1;k>=0;k--) {
      if (localExcess && !overloaded(R.cars[k])) continue;
      chosen = k;
      if (R.cars[k].junction === undefined) break;
    }
    if (chosen < 0) break;
    const c = R.cars[chosen], component = demand.byRoad[c.i];
    releaseTrafficClaim(c);
    index.remove(c); R.cars.splice(chosen,1);
    if (component >= 0) counts[component]--;
    R.trafficPruneCredit = Math.max(0,R.trafficPruneCredit-1);
  }
}

function updateCars(dt, speedMul) {
  if (!S) return;
  const moving = dt > 0 && speedMul > 0 && Number.isFinite(dt*speedMul);
  syncTrafficRoads(!moving);
  if (!moving) return;
  const cars = R.cars;
  const index = trafficIndex();
  const remove = c => {
    releaseTrafficClaim(c);
    index.remove(c); cars.splice(cars.indexOf(c),1);
  };
  // 프레임 수와 관계없이 같은 시간 간격으로 생성·신호·주행을 진행한다.
  R.trafficAccumulator += dt*speedMul;
  while (R.trafficAccumulator+1e-9 >= TRAFFIC_STEP) {
    const step = TRAFFIC_STEP;
    R.trafficAccumulator = Math.max(0,R.trafficAccumulator-step); R.trafficTime += step;
    spawnTraffic(index,step); pruneTraffic(index,step);
    for (const c of [...cars]) {
      const currentGroup = R.trafficGroups.get(c.i);
      if (c.junction !== undefined && c.enteredJunction && currentGroup !== c.junction && c.t >= TRAFFIC_CLEAR) {
        releaseTrafficClaim(c);
      }
      let t = c.t+step*c.sp;
      const nextGroup = R.trafficGroups.get(c.ni);
      if (nextGroup !== undefined && nextGroup !== currentGroup && c.junction !== nextGroup && t > TRAFFIC_STOP) {
        const axis = c.i % MAP_W === c.ni % MAP_W ? 'vertical' : 'horizontal';
        if (trafficSignal(c.ni,axis) === 'green' && prepareJunctionRoute(c,nextGroup,index)
            && trafficPathFree(c,trafficPath(c))) {
          reserveTrafficPath(c,nextGroup); c.enteredJunction = false;
        } else t = Math.max(c.t,TRAFFIC_STOP);
      }
      if (c.ni < 0 && t >= .5) { remove(c); continue; } // 막다른 길 끝에서 통행 종료
      let candidate = { ...c,t };
      if (t >= 1) {
        const route = [...c.route];
        if (c.nextAfter === undefined) c.nextAfter = route.length ? route[0] : nextRoad(c.ni,c.i);
        candidate = { ...c,prev:c.i,i:c.ni,ni:c.nextAfter,t:t-1,route:route.slice(1) };
        delete candidate.nextAfter;
      }
      const pose = getCarPose(candidate);
      if (!index.free(pose,c)) continue;
      if (candidate.i !== c.i) delete c.nextAfter;
      Object.assign(c,candidate);
      if (R.trafficGroups.get(c.i) === c.junction && c.junction !== undefined) c.enteredJunction = true;
      const path = R.trafficPaths.get(c);
      if (path) {
        const n = path.nodes.indexOf(c.i);
        if (n >= 0) path.minProgress = Math.max(path.minProgress,n+c.t-.30);
      }
      index.put(c,pose);
    }
  }
}
function nextRoad(i, prev) {
  const opts = roadNeighbors(i).filter(n => n !== prev);
  if (!opts.length) return -1;
  return opts[(Math.random()*opts.length)|0];
}
function drawCars(ctx, ts, z) {
  if (z < 0.4) return;
  for (const c of R.cars) {
    if (c.ni < 0) continue;
    const pose = getCarPose(c);
    const L = ts * 0.26, W = ts * 0.15;
    ctx.save();
    ctx.translate(pose.x * ts, pose.y * ts);
    ctx.rotate(pose.angle);
    ctx.fillStyle = c.c;
    ctx.fillRect(-L / 2, -W / 2, L, W);
    ctx.fillStyle = 'rgba(225,241,246,0.8)';
    ctx.fillRect(L * 0.12, -W * 0.33, L * 0.17, W * 0.66);
    ctx.restore();
  }
}

// ---------- 오버레이 ----------
function heat(v, bad) {
  // v: 0..1
  if (bad) return `rgba(${200 + v * 55 | 0},${60 - v * 40 | 0},${120 - v * 80 | 0},${0.12 + v * 0.55})`;
  const r = v < 0.5 ? 230 : Math.round(230 - (v - 0.5) * 2 * 180);
  const g = v < 0.5 ? Math.round(60 + v * 2 * 170) : 230;
  return `rgba(${r},${g},60,0.5)`;
}
function drawOverlay(ctx, x, y, ts) {
  const i = idx(x, y);
  const t = S.tiles[i];
  const px = x * ts, py = y * ts;
  const ov = R.overlay;
  let col = null;
  if (ov === 'power' || ov === 'water') {
    const flag = ov === 'power' ? 'powered' : 'watered';
    if (t.type === 'road') col = t[flag] ? (ov === 'power' ? 'rgba(255,220,60,0.35)' : 'rgba(80,170,255,0.35)') : 'rgba(0,0,0,0.25)';
    else if (t.type && t.type !== 'rubble') {
      const need = ov === 'power' ? powerUseOf(t, t.root >= 0 ? t.root : i) > 0 || DEFS[t.type].powerCap : waterUseOf(t, t.root >= 0 ? t.root : i) > 0 || DEFS[t.type].waterCap;
      if (need || t[flag]) col = t[flag] ? 'rgba(60,220,90,0.5)' : 'rgba(240,40,40,0.55)';
    } else col = 'rgba(0,0,0,0.3)';
  } else if (ov === 'traffic') {
    const congestion = Number.isFinite(t.traffic) ? Math.max(0, Math.min(100, t.traffic)) : 0;
    col = t.type === 'road' ? `hsla(${120 * (1 - congestion / 100)},75%,48%,0.55)` : 'rgba(0,0,0,0.4)';
  } else if (ov === 'transit') {
    col = ['rgba(0,0,0,0.4)', 'rgba(72,160,232,0.45)', 'rgba(166,124,214,0.45)', 'rgba(75,196,171,0.5)'][t.transitModes & 3];
  } else if (ov === 'garbage') {
    const amount = S.tiles[rootOf(i)].garbage || 0;
    col = t.type && !['road', 'rubble'].includes(t.type)
      ? `hsla(${120 * (1 - Math.max(0, Math.min(100, amount)) / 100)},70%,45%,0.5)` : 'rgba(0,0,0,0.4)';
  } else if (ov === 'land') col = heat(t.land / 100, false);
  else if (ov === 'pollution') col = t.poll > 1 ? heat(t.poll / 100, true) : null;
  else if (ov === 'crime') col = t.crime > 1 ? heat(t.crime / 100, true) : null;
  else if (S.cov[ov]) col = S.cov[ov][i] > 0 ? `rgba(80,160,255,${0.15 + S.cov[ov][i] * 0.5})` : 'rgba(0,0,0,0.3)';
  if (col) { ctx.fillStyle = col; ctx.fillRect(px, py, ts, ts); }
}

function drawStatus(ctx, x, y, ts) {
  const i = idx(x, y);
  const t = S.tiles[i];
  if (!t.type || t.type === 'road' || t.type === 'rubble' || t.type === 'levee') return;
  if (t.root >= 0 && t.root !== i) return;
  const d = DEFS[t.type];
  const badges = [];
  if (!t.road) badges.push({ icon:'🚧', color:'#e5c37b', background:'rgba(45,37,22,0.9)' });
  else {
    if (powerUseOf(t, i) > 0 && !t.powered) badges.push({ icon:'⚡', color:'#ffda70', background:'rgba(54,42,17,0.9)' });
    if (waterUseOf(t, i) > 0 && !t.watered) badges.push({ icon:'💧', color:'#79c9ff', background:'rgba(18,42,60,0.9)' });
  }
  if (t.garbage >= 40) badges.push({ icon:'🗑️', color:'#d5bd7c', background:'rgba(48,40,23,0.9)' });
  if (!badges.length) return;
  const cx = x * ts + ts * (d.size || 1) / 2, cy = y * ts + ts * 0.15;
  const radius = Math.min(ts * (badges.length > 1 ? 0.2 : 0.22),
    (ts * (d.size || 1) * 0.94 - ts * 0.04 * (badges.length - 1)) / (2 * badges.length));
  const spacing = radius * 2 + ts * 0.04;
  ctx.save();
  ctx.lineWidth = Math.max(1, ts * 0.035);
  ctx.font = `${Math.min(ts * 0.28, radius * 1.7)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  badges.forEach((badge, k) => {
    const bx = cx + (k - (badges.length - 1) / 2) * spacing;
    ctx.fillStyle = badge.background; ctx.strokeStyle = badge.color;
    ctx.beginPath(); ctx.arc(bx, cy, radius, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = badge.color;
    ctx.fillText(badge.icon, bx, cy + 1);
  });
  ctx.restore();
}

function drawPreview(ctx, ts) {
  const p = R.preview;
  if (p && p.cells) {
    for (const c of p.cells) {
      ctx.fillStyle = c.ok ? 'rgba(120,255,140,0.35)' : 'rgba(255,70,70,0.35)';
      ctx.fillRect(c.x * ts, c.y * ts, ts * p.size, ts * p.size);
      ctx.strokeStyle = c.ok ? 'rgba(160,255,170,0.9)' : 'rgba(255,120,120,0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x * ts + 0.5, c.y * ts + 0.5, ts * p.size - 1, ts * p.size - 1);
    }
    // 범위 표시
    if (p.radius && p.cells.length === 1) {
      const c = p.cells[0];
      ctx.strokeStyle = 'rgba(120,200,255,0.8)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc((c.x + p.size / 2) * ts, (c.y + p.size / 2) * ts, p.radius * ts, 0, 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (R.selected) {
    const t = S.tiles[idx(R.selected.x, R.selected.y)];
    let sx = R.selected.x, sy = R.selected.y, sz = 1;
    if (t.root >= 0) { sx = t.root % MAP_W; sy = (t.root / MAP_W) | 0; sz = DEFS[t.type] ? DEFS[t.type].size : 1; }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx * ts + 1, sy * ts + 1, sz * ts - 2, sz * ts - 2);
  }
}

// ---------- 미니맵 ----------
function tileColor(t) {
  if (t.fire) return '#ff6020';
  if (t.flooded) return '#358dca';
  if (t.type) {
    if (t.type === 'levee') return '#a7aa98';
    if (t.type === 'road') return t.lanes === 2 ? '#4c5157' : '#3a3d42';
    if (t.type === 'busstop') return '#3e806b';
    if (t.type === 'subway') return '#547fb0';
    if (t.type === 'landfill') return '#8b7758';
    if (t.type === 'incinerator') return '#ad7552';
    if (t.type === 'recycling') return '#5f9e7a';
    if (t.type === 'rubble') return '#6d625a';
    const d = DEFS[t.type];
    if (d.zone) return t.level === 0 ? shade(d.color, 0.45) : shade(d.color, -0.1 * t.level);
    if (t.type === 'park') return '#5fae4f';
    return '#d0d4d8';
  }
  if (t.t === TERRAIN.WATER) return '#2f6fa8';
  if (t.t === TERRAIN.SAND) return '#d6c38c';
  return t.tree ? '#2f6b2f' : '#5e9a4a';
}
function drawMinimap() {
  if (!S) return;
  const c = R.miniCtx;
  const sc = R.mini.width / MAP_W;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    c.fillStyle = tileColor(S.tiles[idx(x, y)]);
    c.fillRect(x * sc, y * sc, sc, sc);
  }
  R.miniBase = c.getImageData(0, 0, R.mini.width, R.mini.height);
}
function drawMiniViewport() {
  if (!R.miniBase) return;
  const c = R.miniCtx;
  c.putImageData(R.miniBase, 0, 0);
  const sc = R.mini.width / MAP_W;
  const ts = TILE * R.cam.zoom;
  c.strokeStyle = '#fff';
  c.lineWidth = 1.5;
  c.strokeRect(R.cam.x / ts * sc, R.cam.y / ts * sc, window.innerWidth / ts * sc, window.innerHeight / ts * sc);
}
