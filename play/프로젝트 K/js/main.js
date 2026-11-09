// ===== 입력과 게임 루프 =====
const SPEED_MUL = [0, 1, 2, 3];
const DAY_LEN = 0.5; // 1배속에서 하루 = 0.5초 (한 달 = 15초)

const input = {
  mx: 0, my: 0,
  down: false, start: null, moved: false,
  panning: false, panStart: null, camStart: null,
  pointerId: null, overCanvas: false,
  keys: {},
};

function resetInput() {
  input.keys = {};
  input.down = input.panning = input.moved = input.overCanvas = false;
  input.start = input.panStart = input.camStart = input.camStart0 = input.pointerId = null;
  R.hover = R.preview = null;
  if (typeof touchPoints !== 'undefined') { touchPoints.clear(); touchGesture = null; }
  UI.tooltip(0, 0, null);
}

function toolCells(tool, a, b) {
  const d = DEFS[tool];
  const cells = [];
  if (tool === 'inspect') return cells;
  if (d.drag === 'line') {
    // 큰 쪽 방향 먼저 → ㄱ자
    const dx = b.x - a.x, dy = b.y - a.y;
    const sx = dx >= 0 ? 1 : -1, sy = dy >= 0 ? 1 : -1;
    if (Math.abs(dx) >= Math.abs(dy)) {
      for (let k = 0; k <= Math.abs(dx); k++) cells.push({ x: a.x + k * sx, y: a.y });
      for (let k = 1; k <= Math.abs(dy); k++) cells.push({ x: b.x, y: a.y + k * sy });
    } else {
      for (let k = 0; k <= Math.abs(dy); k++) cells.push({ x: a.x, y: a.y + k * sy });
      for (let k = 1; k <= Math.abs(dx); k++) cells.push({ x: a.x + k * sx, y: b.y });
    }
  } else if (d.drag === 'rect') {
    const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(MAP_W - 1, Math.max(a.x, b.x));
    const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(MAP_H - 1, Math.max(a.y, b.y));
    for (let y = y0; y <= y1 && y - y0 < 50; y++) for (let x = x0; x <= x1 && x - x0 < 50; x++) cells.push({ x, y });
  } else {
    const off = Math.floor((d.size - 1) / 2);
    cells.push({ x: b.x - off, y: b.y - off });
  }
  return cells;
}

function evalCells(tool, cells) {
  let total = 0, treeCost = 0, treeCount = 0, okCount = 0, reason = null;
  const out = [];
  for (const c of cells) {
    if (!inMap(c.x, c.y)) continue;
    if (tool === 'bulldoze') {
      const cost = bulldozeCost(c.x, c.y);
      if (cost !== null) { total += cost; okCount++; out.push({ ...c, ok: true }); }
      else out.push({ ...c, ok: false, skip: true });
      continue;
    }
    const r = checkPlace(tool, c.x, c.y);
    if (r.ok) { total += r.cost; treeCost += r.treeCost ?? 0; treeCount += r.treeCount ?? 0; okCount++; out.push({ ...c, ok: true }); }
    else { out.push({ ...c, ok: !!r.skip, skip: true }); if (!r.skip) reason = r.reason; }
  }
  return { cells: out, total, treeCost, treeCount, okCount, reason };
}

function updatePreview() {
  if (!S) return;
  if (!input.overCanvas || UI.hasOpenModal()) {
    R.hover = R.preview = null; UI.tooltip(0, 0, null); return;
  }
  const tool = UI.tool;
  const hover = screenToTile(input.mx, input.my);
  R.hover = hover;
  if (tool === 'inspect' || input.panning) { R.preview = null; UI.tooltip(0, 0, null); return; }
  const d = DEFS[tool];
  const a = input.down && input.start ? input.start : hover;
  const cells = toolCells(tool, a, hover);
  const ev = evalCells(tool, cells);
  // 건너뛰는 칸(이미 도로 등)은 표시하지 않음
  R.preview = { cells: ev.cells.filter(c => !(c.skip && c.ok) && !(tool === 'bulldoze' && c.skip)), size: d.size, radius: d.radius };
  let html = `${d.icon} ${d.name}`;
  if (ev.okCount > 0) {
    html += ` · <b>총 ₩${fmt(ev.total)}</b>`;
    if (ev.total > S.money) html += ` <span class="no">(돈 부족)</span>`;
  } else if (ev.reason) html += ` · <span class="no">${ev.reason}</span>`;
  if (d.upkeep >= 1 && !d.drag) html += ` · 월 ₩${d.upkeep}`;
  if (ev.treeCost > 0) html += `<br>건설 ₩${fmt(ev.total - ev.treeCost)} + 나무 정리 ${fmt(ev.treeCount)}칸 ₩${fmt(ev.treeCost)}`;
  UI.tooltip(input.mx, input.my, html);
}

function applyTool() {
  const tool = UI.tool;
  const hover = screenToTile(input.mx, input.my);
  const cells = toolCells(tool, input.start || hover, hover);
  let spent = 0, treeCost = 0, built = 0, lastReason = null;
  for (const c of cells) {
    const r = tool === 'bulldoze' ? bulldozeAt(c.x, c.y) : placeAt(tool, c.x, c.y);
    if (r.ok) { spent += r.cost; treeCost += r.treeCost || 0; built++; }
    else if (r.reason && !r.skip && r.reason !== '철거할 것이 없음') lastReason = r.reason;
  }
  if (built > 0) {
    S.netDirty = true;
    recomputeAll();
    checkSupplyAlerts();
    drawMinimap();
    if (spent > 0) floatText(`-₩${fmt(spent)}${treeCost > 0 ? ` (나무 정리 ₩${fmt(treeCost)} 포함)` : ''}`);
    if (typeof SOUND !== 'undefined') SOUND.play(tool === 'bulldoze' ? 'bulldoze'
      : tool === 'road' || tool === 'avenue' ? 'road' : DEFS[tool].zone ? 'zone' : 'build', { count: built });
  }
  if (lastReason === '돈 부족' && typeof SOUND !== 'undefined') SOUND.play('funds');
  if (lastReason && (built === 0 || lastReason === '돈 부족')) UI.toast(`⛔ ${lastReason}`, 'warn');
  UI.refresh();
}

// 떠오르는 비용 텍스트
const floaters = [];
function floatText(text) { floaters.push({ text, x: input.mx, y: input.my, life: 0 }); }

// 우클릭 = 취소: 진행 중인 건설 드래그를 버리고 살펴보기로 돌아간다.
// 이미 살펴보기면 선택한 칸을 해제한다.
function cancelToInspect() {
  const wasBuilding = UI.tool !== 'inspect';
  input.down = false; input.start = null;
  if (!input.panning) input.pointerId = null;
  R.preview = null;
  UI.tooltip(0, 0, null);
  if (wasBuilding) UI.setTool('inspect');
  else if (R.selected) { R.selected = null; UI.updateInfo(); }
}

function updateZoomValue() {
  $('zoom-value').textContent = `${Math.round(R.cam.zoom * 100)}%`;
}

function zoomCamera(zoom, x = window.innerWidth / 2, y = window.innerHeight / 2) {
  if (!S || UI.hasOpenModal()) return;
  const old = R.cam.zoom;
  const next = Math.max(0.35, Math.min(2.5, zoom));
  const wx = (x + R.cam.x) / old, wy = (y + R.cam.y) / old;
  R.cam.zoom = next;
  R.cam.x = wx * next - x; R.cam.y = wy * next - y;
  clampCamera();
  R.particles = [];
  updateZoomValue();
  updatePreview();
}

// 두 손가락 터치: 건설 중이던 드래그를 버리고 지도를 옮기거나 확대·축소한다.
const touchPoints = new Map();
let touchGesture = null;
function touchCenter() {
  const pts = [...touchPoints.values()].slice(0, 2);
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, d: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) };
}
function startTouchGesture() {
  input.down = input.panning = false;
  input.start = input.pointerId = input.panStart = input.camStart = input.camStart0 = null;
  R.preview = null;
  UI.tooltip(0, 0, null);
  const c = touchCenter();
  touchGesture = { x: c.x, y: c.y, d: c.d, zoom: R.cam.zoom, camX: R.cam.x, camY: R.cam.y };
}
function moveTouchGesture() {
  const g = touchGesture, c = touchCenter();
  const zoom = Math.max(0.35, Math.min(2.5, g.zoom * c.d / g.d));
  const wx = (g.x + g.camX) / g.zoom, wy = (g.y + g.camY) / g.zoom; // 처음 두 손가락 가운데의 지도 좌표
  R.cam.zoom = zoom;
  R.cam.x = wx * zoom - c.x; R.cam.y = wy * zoom - c.y;
  clampCamera();
  if (zoom !== g.lastZoom) { R.particles = []; updateZoomValue(); g.lastZoom = zoom; }
}

function setupInput() {
  const cv = R.canvas;
  // 터치는 브라우저의 암묵적 포인터 캡처가 있어도 실제 패널 위치를 검사합니다.
  const onCanvas = e => e.pointerType === 'touch'
    ? document.elementFromPoint(e.clientX, e.clientY) === cv : e.target === cv;
  const matchesPointer = e => e.isPrimary !== false && (input.pointerId === null || input.pointerId === e.pointerId);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => {
    if (e.button === 2 && input.down && S && !UI.hasOpenModal()) { e.preventDefault?.(); cancelToInspect(); }
  });
  // 도구 바 위에서 우클릭해도 브라우저 메뉴 대신 살펴보기로
  const dock = typeof $ === 'function' ? $('tool-dock') : null;
  if (dock && typeof dock.addEventListener === 'function') {
    dock.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (S && !UI.hasOpenModal()) cancelToInspect();
    });
  }
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' && S && !UI.hasOpenModal()) {
      touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPoints.size >= 2) { if (!touchGesture) startTouchGesture(); return; }
    }
    if (touchGesture) return;
    if (!S || !matchesPointer(e) || UI.hasOpenModal()) return;
    input.mx = e.clientX; input.my = e.clientY;
    input.overCanvas = true;
    if (e.button === 2 || e.button === 1 || (e.button === 0 && UI.tool === 'inspect')) {
      input.pointerId = e.pointerId;
      input.panning = true; input.moved = false;
      input.panStart = { x: e.clientX, y: e.clientY };
      input.camStart = { x: R.cam.x, y: R.cam.y };
      input.camStart0 = { x: R.cam.x, y: R.cam.y };
      input.panButton = e.button;
      updatePreview();
      return;
    }
    if (e.button === 0) {
      input.pointerId = e.pointerId;
      input.down = true;
      input.start = screenToTile(e.clientX, e.clientY);
      updatePreview();
    }
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && touchPoints.has(e.pointerId)) {
      touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchGesture) { if (touchPoints.size >= 2) moveTouchGesture(); return; }
    }
    if (!matchesPointer(e)) return;
    if (UI.hasOpenModal()) { resetInput(); return; }
    input.mx = e.clientX; input.my = e.clientY;
    input.overCanvas = onCanvas(e);
    if (input.down && (e.buttons & 2)) { cancelToInspect(); return; }
    if (input.panning) {
      const dx = e.clientX - input.panStart.x, dy = e.clientY - input.panStart.y;
      // 우클릭은 손떨림을 넉넉히 봐준다(10px 이내면 클릭으로 처리)
      if (input.panButton === 2 ? Math.hypot(dx, dy) > 10 : Math.abs(dx) + Math.abs(dy) > 4) input.moved = true;
      R.cam.x = input.camStart.x - dx; R.cam.y = input.camStart.y - dy;
      clampCamera();
    }
    updatePreview();
  });
  const endTouch = e => {
    if (e.pointerType !== 'touch' || !touchPoints.has(e.pointerId)) return false;
    touchPoints.delete(e.pointerId);
    if (!touchGesture) return false;
    // 남은 손가락은 아무것도 하지 않다가 모두 떼면 끝난다.
    if (touchPoints.size === 0) { touchGesture = null; updatePreview(); }
    else if (touchPoints.size >= 2) startTouchGesture();
    return true;
  };
  window.addEventListener('pointerup', e => {
    if (endTouch(e)) return;
    if (!S || !matchesPointer(e)) return;
    if (UI.hasOpenModal()) { resetInput(); return; }
    input.mx = e.clientX; input.my = e.clientY;
    input.overCanvas = onCanvas(e);
    if (input.panning) {
      if (e.button !== input.panButton) return;
      input.panning = false;
      input.pointerId = input.panStart = input.camStart = null;
      if (!input.moved && input.panButton === 0 && UI.tool === 'inspect' && input.overCanvas) {
        R.selected = screenToTile(e.clientX, e.clientY);
        UI.updateInfo();
      }
      if (!input.moved && input.panButton === 2) {
        if (input.camStart0) { R.cam.x = input.camStart0.x; R.cam.y = input.camStart0.y; } // 떨림으로 움직인 화면 되돌림
        cancelToInspect();
      }
      input.camStart0 = null;
      updatePreview();
      return;
    }
    if (input.down && e.button === 0) {
      input.down = false;
      if (input.overCanvas) applyTool();
      input.start = input.pointerId = null;
      updatePreview();
    }
  });
  window.addEventListener('pointercancel', e => { if (endTouch(e)) return; if (matchesPointer(e)) resetInput(); });
  window.addEventListener('blur', resetInput);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    zoomCamera(R.cam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  }, { passive: false });
  $('zoom-in').onclick = () => zoomCamera(R.cam.zoom * 1.15);
  $('zoom-out').onclick = () => zoomCamera(R.cam.zoom / 1.15);
  $('zoom-reset').onclick = () => {
    if (!S || UI.hasOpenModal()) return;
    zoomCamera(1);
    centerCamera(MAP_W / 2, MAP_H / 2);
    updatePreview();
  };
  updateZoomValue();

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (UI.hasOpenModal()) {
      resetInput();
      if (k === 'escape') { e.preventDefault(); UI.closeTopModal(); }
      return;
    }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
    if (k === ' ' && (tag === 'BUTTON' || tag === 'SUMMARY')) return;
    if (!S) return;
    // Ctrl/Cmd 조합 키는 게임에서 쓰지 않는다 (되돌리기 기능 없음).
    if (e.ctrlKey || e.metaKey) return;
    input.keys[k] = true;
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) UI.setSpeed(UI.speed === 0 ? (UI.lastSpeed || 1) : (UI.lastSpeed = UI.speed, 0));
    }
    else if (k === '1') UI.setTool('road');
    else if (k === '2') UI.setTool('res');
    else if (k === '3') UI.setTool('com');
    else if (k === '4') UI.setTool('ind');
    else if (k === 'x') UI.setTool('bulldoze');
    else if (k === 'escape') {
      UI.setTool('inspect'); R.selected = null; resetInput();
    }
    updatePreview();
  });
  window.addEventListener('keyup', e => { input.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('resize', () => { resizeCanvas(); clampCamera(); });
}

let lastT = performance.now();
let acc = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (S) {
    if (UI.hasOpenModal()) resetInput();
    // 키보드 이동
    const pan = 600 * dt;
    const K = input.keys;
    if (K['w'] || K['arrowup']) R.cam.y -= pan;
    if (K['s'] || K['arrowdown']) R.cam.y += pan;
    if (K['a'] || K['arrowleft']) R.cam.x -= pan;
    if (K['d'] || K['arrowright']) R.cam.x += pan;
    if (K['w'] || K['s'] || K['a'] || K['d'] || K['arrowup'] || K['arrowdown'] || K['arrowleft'] || K['arrowright']) clampCamera();

    const mul = SPEED_MUL[UI.speed];
    acc += dt * mul;
    let steps = 0;
    while (acc >= DAY_LEN && steps < 8) {
      const m = S.month;
      dayTick();
      acc -= DAY_LEN; steps++;
      if (S.month !== m) drawMinimap();
    }
    if (steps >= 8) acc = 0;
    updateCars(dt, mul); // 차량과 신호도 선택한 배속으로 진행하며 일시정지하면 함께 멈춤
    UI.timer -= dt;
    if (UI.timer <= 0) { UI.refresh(); UI.timer = 0.25; }
  }
  render(dt, acc / DAY_LEN);
  if (typeof SOUND !== 'undefined') SOUND.update({ paused: !S || UI.speed === 0,
    population: S?.stats?.pop || 0, night: typeof AMBIENCE !== 'undefined'
      ? AMBIENCE.nightStrength(AMBIENCE.phase(acc / DAY_LEN)) : 0 });
  // 떠오르는 텍스트
  const ctx = R.ctx;
  for (let k = floaters.length - 1; k >= 0; k--) {
    const f = floaters[k];
    f.life += dt;
    if (f.life > 1.2) { floaters.splice(k, 1); continue; }
    ctx.globalAlpha = 1 - f.life / 1.2;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(f.text, f.x + 1, f.y - 20 - f.life * 30 + 1);
    ctx.fillStyle = '#ffdd66';
    ctx.fillText(f.text, f.x, f.y - 20 - f.life * 30);
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(loop);
}

function saveBeforeExit() {
  // 시작 화면의 미리보기 도시는 제외하고, 일시정지·메뉴 상태도 저장한다.
  if (S && UI.playing) saveGame(true);
}
// 종료 중에도 완료되도록 기존의 동기식 저장을 사용한다. 종료 확인창은 띄우지 않는다.
window.addEventListener('beforeunload', saveBeforeExit);
window.addEventListener('pagehide', saveBeforeExit);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveBeforeExit();
}, true);

window.addEventListener('load', () => {
  if (typeof SOUND !== 'undefined') SOUND.init();
  initRender($('game'), $('minimap'));
  UI.init();
  setupInput();
  // 시작 화면 뒤 배경으로 보여 줄 맵
  newGame({ name: '미리보기', difficulty: 'normal' });
  R.cam.zoom = 0.8;
  updateZoomValue();
  centerCamera(MAP_W / 2, MAP_H / 2);
  drawMinimap();
  UI.setSpeed(0);
  requestAnimationFrame(loop);
});
