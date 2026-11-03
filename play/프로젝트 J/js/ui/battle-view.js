// 전투 화면과 캔버스 그리기
"use strict";

/* ---------- 전투 화면 ---------- */
const SPEEDS = [.5, 1, 2, 4, 8];
let raf = 0, speed = 1, frame = 0, ctx = null, resultTimer = 0, lastFrame = null, accumulator = 0;
function startBattle(){
  const my = me(), op = school(D.opp);
  const team = (ti, sc) => D.picks[ti].map((p,i) => ({champ:p.champ, st:D.stById[p.sid], slot:ti === 0 ? formationOf()[i] : i, bonus: teamBonus(sc, true) + (ti === 0 ? chemBonus(p.sid, D.picks[0].map(q => q.sid)) : 0)}));
  B = newBattle([team(0, my), team(1, op)], D.map, D.strategies);
  B.autoTac[0] = !!S.autoTacticPref;
  V.view = 'battle'; speed = S.speedPref || 1; render();
}
function viewBattle(){
  const op = school(D.opp);
  B.portrait = narrow();
  const nar = B.portrait;
  return `<div class="scorebar">
      <div class="l"><span class="s num" id="s0" style="color:var(--brass)">0</span><span>${esc(me().name)}</span></div>
      <div class="clock num" id="clock">60</div>
      <div class="r"><span>${esc(op.name)}</span><span class="s num" id="s1" style="color:var(--rose)">0</span></div>
    </div>
    <div class="spread" style="margin-bottom:.5rem;align-items:flex-start">${synHtml(B.els[0])}${synHtml(B.els[1], true)}</div>
    <p class="mapline"><b>${MAPS[B.map].n}</b> <span class="muted">${MAPS[B.map].d}</span></p>
    <p class="muted" style="font-size:.85rem">우리 전술: ${STRATEGIES[strategyKey(B.strategies[0])].n} · 상대 전술: ${STRATEGIES[strategyKey(B.strategies[1])].n}</p>
    <div id="cooperation-state">${cooperationStateHtml(B)}</div>
    <div id="battle-highlight" class="battle-highlight" role="status" hidden></div>
    <div class="canvas-wrap ${nar ? 'portrait' : ''}"><canvas id="cv" width="${nar ? H : W}" height="${nar ? W : H}" aria-label="자동 전투 화면${nar ? ', 우리 진영이 아래' : ''}"></canvas></div>
    ${nar ? tacticBar() : ''}
    <div class="spread" style="margin-top:.6rem">
      <div class="row speed">${SPEEDS.map((s,i) => `<button class="btn ghost small" data-a="speed" data-v="${s}" aria-pressed="${speed===s}" title="단축키 ${i+1}">${s}${nar ? '×' : '배속'}</button>`).join('')}<span class="muted hide-sm" style="font-size:.8rem">숫자키 1~5</span></div>
      <div class="row"><button class="btn ghost small" data-a="skip" id="skipBtn">결과까지 건너뛰기</button></div>
    </div>
    <div class="row" style="margin:.6rem 0"><button class="btn ghost small" id="pauseBtn" data-a="pause" aria-pressed="false">일시정지</button>
      <button class="btn ghost small" id="autoTacticBtn" data-a="autoTactic" aria-pressed="${B.autoTac[0]}">자동 작전 ${B.autoTac[0] ? '켜짐' : '꺼짐'}</button><span class="muted" id="battleMode" style="font-size:.85rem"></span></div>
    <p class="muted" style="font-size:.85rem">건너뛰면 남은 작전은 자동으로 지시합니다.</p>
    ${nar ? '' : tacticBar()}
    <div class="feed" id="feed" aria-live="polite"></div>
    <div class="units" id="units"></div>`;
}
function startLoop(){
  const cv = document.getElementById('cv');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const {CW, CH} = arena();
  cv.width = CW*dpr; cv.height = CH*dpr; ctx = cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  drawDpr = dpr;
  cancelAnimationFrame(raf); frame = 0; lastFrame = null; accumulator = 0;
  const loop = timestamp => {
    if (B.paused) accumulator = 0;
    else if (lastFrame !== null) accumulator += Math.min(Math.max((timestamp - lastFrame) / 1000, 0), .25) * speed;
    lastFrame = timestamp;
    while (accumulator + 1e-9 >= 1/60 && !B.over && !B.paused){ step(B, 1/60); accumulator -= 1/60; }
    draw(); if (frame++ % 6 === 0) hud();
    if (B.over){ hud(); onBattleOver(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
function stopLoop(){ cancelAnimationFrame(raf); }
function onBattleOver(){
  const sb = document.getElementById('skipBtn');
  if (sb){ sb.textContent = '결과 보기'; sb.dataset.a = 'toResult'; }
  clearTimeout(resultTimer);
  resultTimer = setTimeout(() => { if (V.view === 'battle') toResult(); }, 1400);
}
function toResult(){
  clearTimeout(resultTimer); stopLoop();
  V.view = 'result'; render();
}
function hud(){
  const s0 = document.getElementById('s0'); if (!s0) return;
  s0.textContent = B.score[0]; document.getElementById('s1').textContent = B.score[1];
  document.getElementById('clock').textContent = B.overtime && !B.over ? '연장' : Math.max(0, Math.ceil(B.dur - B.t));
  document.getElementById('feed').innerHTML = B.feed.map(f => `<div class="${f.team===0?'me':'op'}">${esc(f.text)}</div>`).join('');
  const col = t => `<table><thead><tr><th>학생</th><th class="r">처치</th><th class="r">죽음</th><th class="r">피해</th><th class="r">회복</th></tr></thead><tbody>${
    B.units.filter(u => u.team === t).map(u => `<tr><td>${esc(u.st.name)} <span class="muted">${u.c.n}</span></td><td class="num r">${u.k}</td><td class="num r">${u.d}</td><td class="num r">${R(u.dmg)}</td><td class="num r">${R(u.heal)}</td></tr>`).join('')}</tbody></table>`;
  document.getElementById('units').innerHTML = col(0) + col(1);
  tacticState();
  battleControlState();
  highlightState();
  const cooperation = document.getElementById('cooperation-state');
  if (cooperation) cooperation.innerHTML = cooperationStateHtml(B);
}
function battleControlState(){
  const pause = document.getElementById('pauseBtn'), auto = document.getElementById('autoTacticBtn'), mode = document.getElementById('battleMode');
  if (pause){ pause.disabled = B.over; pause.textContent = B.paused ? '계속하기' : '일시정지'; pause.setAttribute('aria-pressed', String(B.paused)); }
  if (auto){ auto.disabled = B.over; auto.textContent = `자동 작전 ${B.autoTac[0] ? '켜짐' : '꺼짐'}`; auto.setAttribute('aria-pressed', String(B.autoTac[0])); }
  if (mode) mode.textContent = B.paused ? '일시정지 중 · 작전을 사용할 수 없습니다' : B.autoTac[0] ? '코치가 작전 타이밍을 결정합니다' : '직접 작전을 지시하세요 (Q·W·E·R)';
}
/* ---------- 전투 장면 그리기 ---------- */
// 색 보조: '#rrggbb'를 밝게·어둡게, 투명도 넣기
const _shadeCache = {};
function shade(hex, amt){
  const key = hex + amt; if (_shadeCache[key]) return _shadeCache[key];
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const ch = v => Math.round(v + (t - v) * p);
  return (_shadeCache[key] = `rgb(${ch(n >> 16 & 255)},${ch(n >> 8 & 255)},${ch(n & 255)})`);
}
function rgba(hex, a){
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function rrect(c, x, y, w, h, r){
  r = Math.min(r, w/2, h/2);
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
}
// 휴대폰(세로)에서는 경기장을 90도 돌려 그림: 우리 진영이 아래, 상대 진영이 위
const P = (x, y) => B.portrait ? [y, W - x] : [x, y];
function arena(){ const p = !!B.portrait; return {CW: p ? H : W, CH: p ? W : H, K: p ? 1.18 : 1}; }
let drawDpr = 1, arenaLayer = null;

// 움직이지 않는 경기장 바닥 (가로 기준 좌표로 그리고, 세로 화면이면 통째로 돌림)
function paintArena(c){
  let g = c.createRadialGradient(W/2, H/2, 20, W/2, H/2, W*.62);
  g.addColorStop(0, '#242b66'); g.addColorStop(.55, '#151a43'); g.addColorStop(1, '#080a1e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rx = W*.475, ry = H*.47;
  // 석조 원형 경기장
  c.save(); c.translate(W/2, H/2);
  g = c.createRadialGradient(0, 0, 10, 0, 0, rx);
  g.addColorStop(0, 'rgba(70,78,150,.32)'); g.addColorStop(.8, 'rgba(38,44,98,.28)'); g.addColorStop(1, 'rgba(20,24,60,.5)');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = 'rgba(160,170,230,.07)'; c.lineWidth = 1;
  for (const k of [.36, .68]){ c.beginPath(); c.ellipse(0, 0, rx*k, ry*k, 0, 0, Math.PI*2); c.stroke(); }
  for (let i = 0; i < 24; i++){
    const a = i / 24 * Math.PI*2, ca = Math.cos(a), sa = Math.sin(a);
    c.beginPath(); c.moveTo(ca*rx*.36, sa*ry*.36); c.lineTo(ca*rx, sa*ry); c.stroke();
  }
  c.strokeStyle = 'rgba(227,196,126,.32)'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); c.stroke();
  c.strokeStyle = 'rgba(227,196,126,.12)'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, rx + 7, ry + 7, 0, 0, Math.PI*2); c.stroke();
  c.restore();
  // 양 진영 마법진
  for (const [hx, col] of [[70, '#e3c47e'], [W - 70, '#ef8aa2']]){
    g = c.createRadialGradient(hx, H/2, 4, hx, H/2, 150);
    g.addColorStop(0, rgba(col, .16)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(hx, H/2); c.strokeStyle = rgba(col, .26); c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(0, 0, 54, 120, 0, 0, Math.PI*2); c.stroke();
    c.beginPath(); c.ellipse(0, 0, 44, 104, 0, 0, Math.PI*2); c.stroke();
    c.beginPath(); for (let i = 0; i <= 3; i++){ const a = -Math.PI/2 + i * Math.PI*2/3; const x = Math.cos(a)*40, y = Math.sin(a)*94; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    c.restore();
  }
  // 네 귀퉁이 화로 불빛
  for (const [fx, fy] of [[W*.2, H*.1], [W*.8, H*.1], [W*.2, H*.9], [W*.8, H*.9]]){
    g = c.createRadialGradient(fx, fy, 2, fx, fy, 70);
    g.addColorStop(0, 'rgba(255,170,90,.22)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    c.fillStyle = g; c.fillRect(fx - 70, fy - 70, 140, 140);
    c.fillStyle = 'rgba(255,200,130,.55)'; c.beginPath(); c.arc(fx, fy, 2.2, 0, Math.PI*2); c.fill();
  }
  paintTerrain(c);
  // 가장자리 어둡게
  g = c.createRadialGradient(W/2, H/2, H*.45, W/2, H/2, W*.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
// 지형 바닥 (가로 기준 좌표, 움직이지 않는 부분)
function paintTerrain(c){
  const TAU = Math.PI*2;
  for (const z of (B && B.terrain) || []){
    if (z.k === 'pillar') continue;
    c.save();
    if (z.k === 'lava'){
      let g = c.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r + 14);
      g.addColorStop(0, 'rgba(255,190,90,.9)'); g.addColorStop(.45, 'rgba(240,90,30,.85)'); g.addColorStop(.85, 'rgba(120,28,14,.9)'); g.addColorStop(1, 'rgba(40,12,10,0)');
      c.fillStyle = g; c.beginPath(); c.arc(z.x, z.y, z.r + 14, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(40,14,12,.75)'; c.lineWidth = 3;
      for (let i = 0; i < 7; i++){ const a = i*TAU/7 + .3, r1 = z.r*.25, r2 = z.r*.95;
        c.beginPath(); c.moveTo(z.x + Math.cos(a)*r1, z.y + Math.sin(a)*r1); c.lineTo(z.x + Math.cos(a + .25)*z.r*.6, z.y + Math.sin(a + .25)*z.r*.6); c.lineTo(z.x + Math.cos(a)*r2, z.y + Math.sin(a)*r2); c.stroke(); }
      c.strokeStyle = 'rgba(255,150,70,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(z.x, z.y, z.r, 0, TAU); c.stroke();
    } else if (z.k === 'spring'){
      let g = c.createRadialGradient(z.x, z.y, 2, z.x, z.y, z.r);
      g.addColorStop(0, 'rgba(150,255,220,.55)'); g.addColorStop(.7, 'rgba(40,150,140,.55)'); g.addColorStop(1, 'rgba(20,80,90,.6)');
      c.fillStyle = g; c.beginPath(); c.arc(z.x, z.y, z.r, 0, TAU); c.fill();
      c.fillStyle = '#5b6488';
      for (let i = 0; i < 12; i++){ const a = i*TAU/12, rr = 4 + (i*7)%4; c.beginPath(); c.ellipse(z.x + Math.cos(a)*(z.r + 3), z.y + Math.sin(a)*(z.r + 3), rr, rr*.8, a, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(190,255,235,.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(z.x, z.y, z.r, 0, TAU); c.stroke();
    } else if (z.k === 'mana'){
      let g = c.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r);
      g.addColorStop(0, 'rgba(180,140,255,.35)'); g.addColorStop(1, 'rgba(120,80,220,.08)');
      c.fillStyle = g; c.beginPath(); c.arc(z.x, z.y, z.r, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(200,170,255,.55)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(z.x, z.y, z.r, 0, TAU); c.stroke(); c.beginPath(); c.arc(z.x, z.y, z.r*.82, 0, TAU); c.stroke();
      c.beginPath(); for (const off of [0, Math.PI]) for (let i = 0; i <= 3; i++){ const a = off - Math.PI/2 + i*TAU/3, x = z.x + Math.cos(a)*z.r*.78, y = z.y + Math.sin(a)*z.r*.78; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    } else if (z.k === 'wind'){
      c.fillStyle = 'rgba(160,240,225,.09)'; rrect(c, z.x, z.y, z.w, z.h, 16); c.fill();
      c.strokeStyle = 'rgba(190,255,240,.28)'; c.lineWidth = 1.2; c.setLineDash([6, 8]); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(200,255,245,.22)'; c.lineWidth = 2;
      const dir = z.y < H/2 ? 1 : -1;
      for (let x = z.x + 22; x < z.x + z.w - 10; x += 36){ const cy = z.y + z.h/2;
        c.beginPath(); c.moveTo(x - 5*dir, cy - 8); c.lineTo(x + 5*dir, cy); c.lineTo(x - 5*dir, cy + 8); c.stroke(); }
    }
    c.restore();
  }
}
// 지형의 움직이는 부분 (용암 거품, 샘 물결, 바람 줄기, 마력진 룬)
function drawTerrainLive(c, now, K){
  const TAU = Math.PI*2;
  for (const [zi, z] of ((B && B.terrain) || []).entries()){
    if (z.k === 'pillar') continue;
    c.save(); c.globalCompositeOperation = 'lighter';
    if (z.k === 'lava'){
      const [x, y] = P(z.x, z.y), pulse = .5 + .5*Math.sin(now*1.7 + zi);
      const g = c.createRadialGradient(x, y, 0, x, y, z.r*1.25);
      g.addColorStop(0, `rgba(255,150,60,${.16 + .12*pulse})`); g.addColorStop(1, 'rgba(255,90,30,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, z.r*1.25, 0, TAU); c.fill();
      for (let i = 0; i < 8; i++){
        const ph = (now*.55 + i*.37) % 1, a = i*2.39 + zi, d = z.r*(.15 + ((i*.618) % 1)*.7);
        const [bx, by] = P(z.x + Math.cos(a)*d, z.y + Math.sin(a)*d), br = (1.5 + ph*4.5)*K;
        c.globalAlpha = ph < .85 ? .8 : (1 - ph)/.15*.8;
        c.strokeStyle = '#ffd08a'; c.lineWidth = 1.2; c.beginPath(); c.arc(bx, by, br, 0, TAU); c.stroke();
      }
    } else if (z.k === 'spring'){
      const [x, y] = P(z.x, z.y);
      for (let i = 0; i < 3; i++){ const ph = (now*.45 + i/3 + zi*.2) % 1;
        c.globalAlpha = (1 - ph)*.55; c.strokeStyle = '#b8fff0'; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, z.r*ph, 0, TAU); c.stroke(); }
      for (let i = 0; i < 4; i++){ const ph = (now*.6 + i*.29 + zi*.13) % 1, a = i*1.9 + zi;
        const [sx, sy] = P(z.x + Math.cos(a)*z.r*.5, z.y + Math.sin(a)*z.r*.5);
        c.globalAlpha = Math.sin(ph*Math.PI)*.8; c.fillStyle = '#e8fff8'; c.beginPath(); c.arc(sx, sy - ph*14*K, 1.6*K, 0, TAU); c.fill(); }
    } else if (z.k === 'mana'){
      const [x, y] = P(z.x, z.y), pulse = .5 + .5*Math.sin(now*2.2);
      const g = c.createRadialGradient(x, y, 0, x, y, z.r);
      g.addColorStop(0, `rgba(190,150,255,${.12 + .1*pulse})`); g.addColorStop(1, 'rgba(160,110,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, z.r, 0, TAU); c.fill();
      c.translate(x, y); c.rotate(now*.35); c.fillStyle = '#d9c4ff'; c.globalAlpha = .55 + .3*pulse;
      c.font = `${Math.round(11*K)}px "Song Myung", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const runes = '火風土水光闇';
      for (let i = 0; i < 6; i++){ const a = i*TAU/6; c.fillText(runes[i], Math.cos(a)*z.r*.91, Math.sin(a)*z.r*.91); }
    } else if (z.k === 'wind'){
      const dir = z.y < H/2 ? 1 : -1;
      c.strokeStyle = '#d6fff6'; c.lineCap = 'round';
      for (let i = 0; i < 9; i++){
        const ph = (now*.5 + i*.137 + zi*.31) % 1, len = 22 + (i % 3)*10;
        const sx = dir > 0 ? z.x + ph*(z.w - len) : z.x + z.w - len - ph*(z.w - len), sy = z.y + 8 + ((i*.618) % 1)*(z.h - 16);
        const [x1, y1] = P(sx, sy), [x2, y2] = P(sx + len, sy);
        c.globalAlpha = Math.sin(ph*Math.PI)*.45; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      c.lineCap = 'butt';
    }
    c.restore();
  }
}
// 돌기둥 (유닛과 함께 앞뒤 순서대로 그림)
function drawPillar(c, z, K, now){
  const [x, y] = P(z.x, z.y), r = z.r, w = r*1.45, h = 54*K, TAU = Math.PI*2;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + 5, y + 5, r*1.15, r*.5, 0, 0, TAU); c.fill();
  c.fillStyle = '#3d4263'; c.beginPath(); c.ellipse(x, y, r, r*.5, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(200,205,235,.25)'; c.lineWidth = 1; c.stroke();
  const g = c.createLinearGradient(x - w/2, 0, x + w/2, 0);
  g.addColorStop(0, '#454a6d'); g.addColorStop(.38, '#9aa0c4'); g.addColorStop(.6, '#7a80a6'); g.addColorStop(1, '#3a3f60');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(x - w/2, y - h); c.lineTo(x - w/2, y - 2); c.ellipse(x, y - 2, w/2, w*.22, 0, Math.PI, 0, false); c.lineTo(x + w/2, y - h); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(20,22,44,.5)'; c.lineWidth = 1;
  for (const k of [.3, .62]){ c.beginPath(); c.moveTo(x - w/2, y - h*k); c.lineTo(x + w/2, y - h*k); c.stroke(); }
  c.beginPath(); c.moveTo(x - w*.15, y - h*.62); c.lineTo(x - w*.05, y - h*.5); c.lineTo(x - w*.2, y - h*.4); c.stroke();
  c.fillStyle = '#b5bbdc'; c.beginPath(); c.ellipse(x, y - h, w/2 + 3, w*.24 + 1, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(60,64,96,.8)'; c.stroke();
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .55 + .3*Math.sin(now*1.6 + z.x*.01);
  c.fillStyle = '#e3c47e'; c.font = `${Math.round(13*K)}px "Song Myung", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('柱', x, y - h*.47); c.restore();
}
function arenaBackground(c, CW, CH){
  const key = `${CW}x${CH}x${drawDpr}x${B.map || 'plain'}`;
  if (!arenaLayer || arenaLayer.key !== key){
    arenaLayer = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function'){
      const cv = document.createElement('canvas'); cv.width = Math.round(CW*drawDpr); cv.height = Math.round(CH*drawDpr);
      const lc = cv.getContext && cv.getContext('2d');
      if (lc){
        lc.setTransform(drawDpr, 0, 0, drawDpr, 0, 0);
        if (CW !== W){ lc.translate(0, W); lc.rotate(-Math.PI/2); }
        paintArena(lc); arenaLayer = {key, cv};
      }
    }
  }
  if (arenaLayer) c.drawImage(arenaLayer.cv, 0, 0, CW, CH);
  else { c.save(); if (CW !== W){ c.translate(0, W); c.rotate(-Math.PI/2); } paintArena(c); c.restore(); }
}

/* ---------- 캐릭터 (코드로 그리는 꼬마 마법사) ---------- */
const SKIN = '#f3d4b4', BOOT = '#2a2238', METAL = '#c3c9de';
// 로컬 좌표: 발 가운데가 원점, 위쪽이 -y, 오른쪽을 바라봄(+x). o: 자세 정보
function drawCharacter(c, u, o){
  const ec = EL[u.c.e].c, tc = u.team === 0 ? '#e3c47e' : '#ef8aa2', role = u.c.role, s = o.s;
  const melee = u.c.range < 100;
  c.save();
  c.translate(o.x, o.y);
  if (o.tilt) c.rotate(o.tilt);
  c.scale(o.face * s, s);
  c.globalAlpha *= o.alpha == null ? 1 : o.alpha;
  const bob = o.bob || 0, lean = o.lean || 0;
  // 발
  c.fillStyle = BOOT;
  c.beginPath(); c.ellipse(-4 + o.leg, -1.5, 4.2, 2.3, 0, 0, Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(4 - o.leg, -1.5, 4.2, 2.3, 0, 0, Math.PI*2); c.fill();
  c.translate(lean, -bob);
  // 뒤팔 (몸 뒤)
  const armBack = o.armBack;
  c.save(); c.translate(-4, -20); c.rotate(armBack);
  c.strokeStyle = shade(ec, -.35); c.lineWidth = 4.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 9); c.stroke();
  c.fillStyle = SKIN; c.beginPath(); c.arc(0, 10, 2.2, 0, Math.PI*2); c.fill();
  c.restore();
  // 로브
  const g = c.createLinearGradient(0, -24, 0, 0);
  g.addColorStop(0, shade(ec, .28)); g.addColorStop(.55, ec); g.addColorStop(1, shade(ec, -.38));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-7, -23); c.lineTo(7, -23);
  c.quadraticCurveTo(10, -12, 12 + o.sway, -3); c.quadraticCurveTo(0, 0, -12 + o.sway, -3);
  c.quadraticCurveTo(-10, -12, -7, -23); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke();
  // 팀 색 단과 띠
  c.strokeStyle = tc; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-11.5 + o.sway, -4); c.quadraticCurveTo(0, -1.2, 11.5 + o.sway, -4); c.stroke();
  c.lineWidth = 1.8; c.beginPath(); c.moveTo(-6.5, -21); c.lineTo(6, -12); c.stroke();
  // 머리
  const hx = 0.5, hy = -30;
  if (role === '돌격' || role === '치유'){  // 두건 뒷부분
    c.fillStyle = shade(ec, role === '치유' ? .45 : -.3); c.beginPath(); c.arc(hx - 1, hy, 9, 0, Math.PI*2); c.fill();
  }
  c.fillStyle = SKIN; c.beginPath(); c.arc(hx, hy, 7, 0, Math.PI*2); c.fill();
  // 머리카락 살짝
  if (role !== '수호'){ c.fillStyle = '#4a3326'; c.beginPath(); c.arc(hx - 2.5, hy - 2.5, 5.2, Math.PI*.95, Math.PI*1.75); c.lineTo(hx - 2.5, hy - 2.5); c.fill(); }
  // 눈
  c.fillStyle = '#1d1630';
  if (o.ko){ c.strokeStyle = '#1d1630'; c.lineWidth = 1.1; for (const ex of [2.2, 5.3]){ c.beginPath(); c.moveTo(ex - 1.2, hy - 1.2); c.lineTo(ex + 1.2, hy + 1.2); c.moveTo(ex + 1.2, hy - 1.2); c.lineTo(ex - 1.2, hy + 1.2); c.stroke(); } }
  else if (o.blink){ c.fillRect(1.2, hy - .3, 2.2, .9); c.fillRect(4.3, hy - .3, 2.2, .9); }
  else { c.beginPath(); c.arc(2.3, hy, 1.15, 0, Math.PI*2); c.arc(5.4, hy, 1.15, 0, Math.PI*2); c.fill(); }
  c.fillStyle = 'rgba(255,120,120,.35)'; c.beginPath(); c.arc(5.5, hy + 3, 1.4, 0, Math.PI*2); c.fill();
  // 모자·투구·두건
  if (role === '사격' || role === '제어'){
    c.fillStyle = shade(ec, -.3);
    c.beginPath(); c.ellipse(hx, hy - 4.5, 11.5, 3.2, 0, 0, Math.PI*2); c.fill();
    c.beginPath(); c.moveTo(hx - 7.5, hy - 5); c.lineTo(hx + 7.5, hy - 5);
    c.quadraticCurveTo(hx + 2, hy - 15, hx - 5 + o.hatSway, hy - 22); c.quadraticCurveTo(hx - 3, hy - 13, hx - 7.5, hy - 5); c.closePath(); c.fill();
    c.strokeStyle = tc; c.lineWidth = 1.8; c.beginPath(); c.moveTo(hx - 7, hy - 6.5); c.lineTo(hx + 7, hy - 6.5); c.stroke();
    c.fillStyle = shade(ec, .55); c.beginPath(); c.arc(hx - 5 + o.hatSway, hy - 22, 1.6, 0, Math.PI*2); c.fill();
  } else if (role === '수호'){
    c.fillStyle = METAL; c.beginPath(); c.arc(hx, hy - 1, 8.2, Math.PI, 0); c.lineTo(hx + 8.2, hy + 1); c.lineTo(hx - 8.2, hy + 1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = tc; c.beginPath(); c.moveTo(hx - 2, hy - 9); c.quadraticCurveTo(hx - 9, hy - 16, hx - 13, hy - 9); c.quadraticCurveTo(hx - 7, hy - 11, hx - 2, hy - 6); c.fill();
    c.fillStyle = '#e6eaf5'; c.fillRect(hx + 1, hy - 1.5, 7, 1.4);
  } else if (role === '돌격'){
    c.fillStyle = shade(ec, -.3); c.beginPath(); c.arc(hx - 1, hy - 1, 9, Math.PI*1.02, Math.PI*1.98); c.lineTo(hx + 6, hy - 3); c.quadraticCurveTo(hx, hy - 6, hx - 7, hy - 2); c.closePath(); c.fill();
    c.fillStyle = tc; c.fillRect(hx - 6, hy + 5, 12, 2.4);  // 목도리
  } else if (role === '치유'){
    c.strokeStyle = 'rgba(255,240,180,.9)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(hx, hy - 11, 6.5, 1.8, 0, 0, Math.PI*2); c.stroke();
    c.fillStyle = shade(ec, .45); c.beginPath(); c.arc(hx - 1, hy - 1, 9, Math.PI*1.05, Math.PI*1.95); c.quadraticCurveTo(hx, hy - 7, hx - 7.5, hy - 2); c.closePath(); c.fill();
  }
  // 앞팔과 무기
  c.save(); c.translate(4.5, -20); c.rotate(o.armFront);
  if (role === '수호'){
    c.strokeStyle = shade(ec, -.2); c.lineWidth = 4.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 8); c.stroke();
    c.restore();
    // 방패는 팔 대신 몸 앞에 듦
    c.save(); c.translate(8 + (o.thrust || 0) * .5, -13);
    c.fillStyle = shade(ec, -.15); c.strokeStyle = tc; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-5, -8); c.lineTo(5, -8); c.lineTo(5, 2); c.quadraticCurveTo(5, 8, 0, 10); c.quadraticCurveTo(-5, 8, -5, 2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = shade(ec, .5); c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI*2); c.fill();
    c.restore();
  } else {
    c.strokeStyle = shade(ec, -.2); c.lineWidth = 4.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 9); c.stroke();
    c.fillStyle = SKIN; c.beginPath(); c.arc(0, 10, 2.3, 0, Math.PI*2); c.fill();
    if (role === '돌격'){  // 검
      c.translate(0, 10); c.rotate(1.0);  // 칼끝이 앞쪽 위를 향하게
      c.strokeStyle = '#6b5a3a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -2); c.stroke();
      c.strokeStyle = tc; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, -2); c.lineTo(3, -2); c.stroke();
      c.strokeStyle = '#e8edf7'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, -2); c.lineTo(0, -17); c.stroke();
      if (o.glow > 0){ c.globalAlpha *= o.glow; c.strokeStyle = shade(ec, .4); c.lineWidth = 5; c.beginPath(); c.moveTo(0, -3); c.lineTo(0, -17); c.stroke(); }
    } else if (role === '제어'){  // 손 위 떠 있는 구슬
      const orbY = -2 - Math.sin(o.now*3)*1.5;
      const og = c.createRadialGradient(0, orbY, .5, 0, orbY, 6 + o.glow*4);
      og.addColorStop(0, '#ffffff'); og.addColorStop(.35, shade(ec, .4)); og.addColorStop(1, rgba(ec, 0));
      c.fillStyle = og; c.beginPath(); c.arc(0, orbY, 6 + o.glow*4, 0, Math.PI*2); c.fill();
    } else {  // 사격·치유: 지팡이
      c.translate(0, 10); c.rotate(.15);
      c.strokeStyle = '#7a5a36'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -20); c.stroke();
      if (role === '치유'){ c.strokeStyle = '#ffe9a6'; c.lineWidth = 1.8; c.beginPath(); c.arc(0, -23, 3.6, 0, Math.PI*2); c.stroke(); }
      const og = c.createRadialGradient(0, -22, .5, 0, -22, 4 + o.glow*5);
      og.addColorStop(0, '#ffffff'); og.addColorStop(.4, shade(ec, .35)); og.addColorStop(1, rgba(ec, 0));
      c.fillStyle = og; c.beginPath(); c.arc(0, -22, 4 + o.glow*5, 0, Math.PI*2); c.fill();
    }
    c.restore();
  }
  if (o.flash > 0){  // 맞았을 때 하얗게
    c.globalCompositeOperation = 'lighter'; c.globalAlpha *= Math.min(.55, o.flash*5);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, -17, 13, 0, Math.PI*2); c.fill();
  }
  c.restore();
}
// 시뮬레이션 상태로 이번 프레임의 자세를 계산
function charPose(u, idx, now, dtSim, K){
  const [x, y] = P(u.x, u.y);
  // 이동량으로 걷기
  const mv = u._sx == null ? 0 : Math.hypot(x - u._sx, y - u._sy);
  u._sx = x; u._sy = y;
  u._walk = (u._walk || 0) + mv * .32;
  u._speed = (u._speed || 0) * .8 + (dtSim > 0 ? mv / dtSim : 0) * .2;
  const moving = u._speed > 12 && u.stun <= 0;
  // 공격·주문 감지 (타이머가 다시 차면 방금 쓴 것)
  if (u._lastAt != null && u.at > u._lastAt + .05) u._atkT = .3;
  if (u._lastSk != null && u.sk > u._lastSk + .3) u._castT = .55;
  u._lastAt = u.at; u._lastSk = u.sk;
  u._atkT = Math.max(0, (u._atkT || 0) - dtSim); u._castT = Math.max(0, (u._castT || 0) - dtSim);
  // 바라보는 방향: 가장 가까운 적
  let near = null, nd = 1e9;
  for (const f of B.units) if (f.alive && f.team !== u.team){ const [fx, fy] = P(f.x, f.y), d = Math.hypot(fx - x, fy - y); if (d < nd){ nd = d; near = fx; } }
  if (near != null && Math.abs(near - x) > 4) u._face = near > x ? 1 : -1;
  if (u._face == null) u._face = u.team === 0 ? 1 : -1;
  const atkP = u._atkT > 0 ? 1 - u._atkT / .3 : -1, castP = u._castT > 0 ? 1 - u._castT / .55 : -1;
  const melee = u.c.range < 100;
  let armFront = .35 + Math.sin(now*2 + idx)*.06, armBack = -.25, lean = 0, thrust = 0, glow = 0;
  if (moving){ armFront = .2 + Math.sin(u._walk)*.5; armBack = -.2 - Math.sin(u._walk)*.5; lean = 1.2; }
  if (atkP >= 0){
    if (melee){ armFront = -2.1 + atkP*2.9; lean = Math.sin(atkP*Math.PI)*5; glow = 1 - atkP; }
    else { armFront = -1.35 + Math.sin(atkP*Math.PI)*.2; thrust = Math.sin(atkP*Math.PI)*3; glow = 1 - atkP; }
  }
  if (castP >= 0){ armFront = -2.6; armBack = 2.4; glow = 1; lean = -1; }
  const recoil = u.flash > 0 ? u.flash / .12 * 2.5 : 0;
  const stunned = u.stun > 0 && !(u.iceT > 0);
  return {
    x: x - u._face * recoil * K, y: y + 15*K, s: K*1.15, face: u._face, now,
    leg: moving ? Math.sin(u._walk)*3.5 : 0,
    bob: moving ? Math.abs(Math.sin(u._walk))*1.8 : Math.sin(now*2.2 + idx*1.7)*.8 + (castP >= 0 ? 2*Math.sin(castP*Math.PI) : 0),
    sway: moving ? Math.sin(u._walk)*1.2 : Math.sin(now*1.6 + idx)*.5,
    hatSway: Math.sin(now*2 + idx)*1.2 + (moving ? -1.5 : 0),
    armFront, armBack, lean: lean + thrust, thrust, glow,
    tilt: stunned ? Math.sin(now*6)*.12 : 0,
    blink: (now*1000 + idx*733) % 3800 < 120, flash: u.flash, casting: castP, ko: false,
  };
}

function draw(){
  const c = ctx; if (!c) return;
  const {CW, CH, K} = arena();
  const F = (px, fam) => { const m = fam.match(/^bold (.*)$/); return m ? `bold ${Math.round(px*K)}px ${m[1]}` : `${Math.round(px*K)}px ${fam}`; };
  const now = Date.now() / 1000, rdt = Math.min(.1, Math.max(0, now - (B._lastDraw || now))); B._lastDraw = now;
  const TAU = Math.PI*2;
  B._labels = [];  // 이름표끼리 겹치지 않게 그린 위치를 기억
  c.save();
  c.clearRect(0, 0, CW, CH);
  if (B.shake > 0) c.translate(fxRnd(-B.shake, B.shake), fxRnd(-B.shake, B.shake));
  arenaBackground(c, CW, CH);
  // 가운데 룬 마법진 (천천히 회전)
  const [mx, my] = P(W/2, H/2);
  c.save(); c.translate(mx, my);
  c.strokeStyle = 'rgba(227,196,126,.2)'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(0, 0, 112, 0, TAU); c.stroke();
  c.save(); c.rotate(B.t*.06);
  for (let i = 0; i < 36; i++){ const a = i / 36 * TAU, r1 = 112, r2 = i % 3 ? 118 : 124; c.beginPath(); c.moveTo(Math.cos(a)*r1, Math.sin(a)*r1); c.lineTo(Math.cos(a)*r2, Math.sin(a)*r2); c.stroke(); }
  c.beginPath();
  for (const off of [0, Math.PI]){ for (let i = 0; i <= 3; i++){ const a = off - Math.PI/2 + i * TAU/3; const x = Math.cos(a)*92, y = Math.sin(a)*92; i ? c.lineTo(x, y) : c.moveTo(x, y); } }
  c.stroke(); c.restore();
  c.save(); c.rotate(-B.t*.1); c.setLineDash([3, 7]); c.strokeStyle = 'rgba(227,196,126,.16)';
  c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.stroke(); c.setLineDash([]); c.restore();
  c.restore();
  // 떠오르는 빛 입자
  if (!B._motes){ B._motes = [...Array(26)].map(() => ({x:fxRnd(0, W), y:fxRnd(0, H), s:fxRnd(.6, 1.7), v:fxRnd(5, 15), ph:fxRnd(0, 6)})); }
  c.globalCompositeOperation = 'lighter';
  for (const m of B._motes){
    if (!B.paused){ m.y -= m.v * rdt; if (m.y < -4){ m.y = H + 4; m.x = fxRnd(0, W); } }
    const [x, y] = P(m.x + Math.sin(now*.6 + m.ph)*6, m.y);
    c.globalAlpha = .25 + .25*Math.sin(now*2 + m.ph);
    c.fillStyle = '#ffe6a8'; c.beginPath(); c.arc(x, y, m.s*K, 0, TAU); c.fill();
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  drawTerrainLive(c, now, K);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // 주문 사거리 고리 (시전한 자리에서 잠깐 보임)
  for (const f of B.fx){
    if (f.k !== 'reach') continue;
    const p = f.t/f.life, [x, y] = P(f.x, f.y), r = f.r*(.92 + .08*Math.min(1, p*4));
    c.globalAlpha = (1 - p)*.75;
    c.fillStyle = rgba(f.col, .06); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = shade(f.col, .35); c.lineWidth = 1.4; c.setLineDash([5, 6]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 1;
  }
  // 바닥 효과(폭발)
  c.globalCompositeOperation = 'lighter';
  for (const f of B.fx){
    if (f.t < 0 || f.k !== 'burst') continue;
    const p = f.t/f.life, [x, y] = P(f.x, f.y), r = f.r*(.35 + .65*p);
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, rgba(f.col, .55*(1-p))); g.addColorStop(.7, rgba(f.col, .22*(1-p))); g.addColorStop(1, rgba(f.col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.globalAlpha = 1 - p; c.strokeStyle = shade(f.col, .35); c.lineWidth = 2.5*(1-p) + .5; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
    const seed = (f.x*13.7 + f.y*7.3) % TAU;
    c.fillStyle = shade(f.col, .5);
    for (let i = 0; i < 9; i++){ const a = seed + i * TAU/9, d = f.r*(.25 + .95*p); c.beginPath(); c.arc(x + Math.cos(a)*d, y + Math.sin(a)*d, 2.2*(1-p)*K + .3, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }
  c.globalCompositeOperation = 'source-over';
  // 쓰러짐·부활 감지
  const dtSim = Math.max(0, B.t - (B._lastT == null ? B.t : B._lastT)); B._lastT = B.t;
  B._ghosts = B._ghosts || [];
  for (const u of B.units){
    if (u._wasAlive && !u.alive && u._pose) B._ghosts.push({u, pose:{...u._pose, ko:true, flash:0, casting:-1, glow:0}, t:0});
    if (u._wasAlive === false && u.alive) B.fx.push({k:'ring', x:u.x, y:u.y, r:34, col:u.team === 0 ? '#e3c47e' : '#ef8aa2', t:0, life:.5});
    u._wasAlive = u.alive;
  }
  // 부활 대기: 진영 자리에 흐릿한 표식과 남은 시간
  for (const u of B.units){
    if (u.alive){ u._respMax = 0; continue; }
    if (!u._respMax || u.resp > u._respMax) u._respMax = Math.max(u.resp, .5);
    const [x, y] = P(u.hx, u.hy), tc = u.team === 0 ? '#e3c47e' : '#ef8aa2', r = 15*K;
    c.globalAlpha = .55;
    c.strokeStyle = rgba(tc, .3); c.lineWidth = 2.5*K; c.beginPath(); c.ellipse(x, y + 14*K, r, r*.36, 0, 0, TAU); c.stroke();
    c.strokeStyle = tc; c.beginPath(); c.ellipse(x, y + 14*K, r, r*.36, 0, -Math.PI/2, -Math.PI/2 + TAU*(1 - u.resp/u._respMax)); c.stroke();
    c.fillStyle = '#efe9f8'; c.font = F(13, 'bold system-ui'); c.fillText(Math.ceil(u.resp), x, y);
    c.globalAlpha = 1;
  }
  // 쓰러지는 모습과 떠오르는 혼
  for (const gh of B._ghosts){
    gh.t += rdt; const p = Math.min(1, gh.t / .75);
    drawCharacter(c, gh.u, {...gh.pose, tilt: -gh.pose.face * Math.min(1, p*1.6) * 1.3, alpha: 1 - p});
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - p) * .8;
    const wy = gh.pose.y - 30*K - p*40*K, wg = c.createRadialGradient(gh.pose.x, wy, 0, gh.pose.x, wy, 9*K);
    wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = wg; c.beginPath(); c.arc(gh.pose.x, wy, 9*K, 0, TAU); c.fill();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  B._ghosts = B._ghosts.filter(gh => gh.t < .75);
  // 유닛: 화면 아래쪽에 있을수록 앞에 그림
  const order = B.units.map((u, i) => [u, i]).filter(([u]) => u.alive)
    .concat(((B.terrain) || []).filter(z => z.k === 'pillar').map(z => [z, -1, true]))
    .sort((a, b) => P(a[0].x, a[0].y)[1] - P(b[0].x, b[0].y)[1]);
  for (const [u, idx, isPillar] of order){
    if (isPillar){ drawPillar(c, u, K, now); continue; }
    const tc = u.team === 0 ? '#e3c47e' : '#ef8aa2', ec = EL[u.c.e].c;
    const o = charPose(u, idx, now, dtSim, K); u._pose = o;
    const x = o.x, fy = o.y, cy = fy - 23*K;
    // 발밑 고리: 팀 색, 하얀 호는 주문 준비
    const ready = 1 - clamp(u.sk / u.scd, 0, 1), gr = 15*K, gry = gr*.36;
    c.fillStyle = rgba(tc, .16); c.beginPath(); c.ellipse(x, fy, gr, gry, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(tc, .85); c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = ready >= 1 ? `rgba(255,246,210,${.75 + .25*Math.sin(now*6)})` : 'rgba(225,235,255,.75)'; c.lineWidth = 2.2*K;
    c.beginPath(); c.ellipse(x, fy, gr + 3*K, gry + 1.6*K, 0, -Math.PI/2, -Math.PI/2 + TAU*ready); c.stroke();
    // 주문 시전 마법진
    if (o.casting >= 0){
      const p = o.casting;
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - p*.6;
      c.strokeStyle = shade(ec, .35); c.lineWidth = 2;
      c.beginPath(); c.ellipse(x, fy, (20 + p*12)*K, (7 + p*4)*K, 0, 0, TAU); c.stroke();
      c.setLineDash([3, 4]); c.beginPath(); c.ellipse(x, fy, (14 + p*8)*K, (5 + p*3)*K, 0, now*2, now*2 + TAU); c.stroke(); c.setLineDash([]);
      const cg = c.createRadialGradient(x, cy, 0, x, cy, 30*K); cg.addColorStop(0, rgba(ec, .35*(1 - p))); cg.addColorStop(1, rgba(ec, 0));
      c.fillStyle = cg; c.beginPath(); c.arc(x, cy, 30*K, 0, TAU); c.fill();
      c.restore();
    }
    // 각성 오라
    if (u.awk){
      const pulse = .5 + .5*Math.sin(now*3 + idx);
      const ag = c.createRadialGradient(x, cy, 6*K, x, cy, 30*K);
      ag.addColorStop(0, `rgba(255,215,106,${.22 + .14*pulse})`); ag.addColorStop(1, 'rgba(255,215,106,0)');
      c.fillStyle = ag; c.beginPath(); c.arc(x, cy, 30*K, 0, TAU); c.fill();
    }
    if (u.mistT > 0){ c.fillStyle = 'rgba(191,227,255,.15)'; c.beginPath(); c.ellipse(x, cy, 22*K, 27*K, 0, 0, TAU); c.fill(); }
    // 캐릭터
    drawCharacter(c, u, o);
    // 보호막 방울
    if (u.shield > 0){
      const sg = c.createRadialGradient(x - 6*K, cy - 8*K, 4*K, x, cy, 27*K);
      sg.addColorStop(0, 'rgba(255,240,200,.04)'); sg.addColorStop(.8, 'rgba(255,225,160,.13)'); sg.addColorStop(1, 'rgba(255,225,160,.38)');
      c.fillStyle = sg; c.beginPath(); c.ellipse(x, cy, 21*K, 27*K, 0, 0, TAU); c.fill();
      c.strokeStyle = `rgba(255,228,170,${.5 + .25*Math.sin(now*5)})`; c.lineWidth = 1.5; c.stroke();
    }
    // 불타는 중
    if (u.burn > 0){
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++){ const fx2 = x + (i - 1)*7*K, fh = (6 + 3*Math.sin(now*18 + i*2))*K, fyb = fy - 6*K - i%2*8*K;
        c.fillStyle = 'rgba(255,140,60,.55)'; c.beginPath(); c.moveTo(fx2 - 3*K, fyb); c.quadraticCurveTo(fx2, fyb - fh*1.6, fx2 + 3*K, fyb); c.fill(); }
      c.restore();
    }
    // 얼음·기절·약화·도발
    if (u.iceT > 0){
      c.fillStyle = 'rgba(200,232,255,.38)'; c.strokeStyle = '#e6f5ff'; c.lineWidth = 1.5; c.beginPath();
      c.moveTo(x, cy - 30*K); c.lineTo(x + 19*K, cy - 6*K); c.lineTo(x + 14*K, fy); c.lineTo(x - 14*K, fy); c.lineTo(x - 19*K, cy - 6*K); c.closePath(); c.fill(); c.stroke();
    } else if (u.stun > 0){
      c.fillStyle = '#ffe9a0'; c.font = F(12, 'system-ui');
      for (let i = 0; i < 3; i++){ const a = B.t*5 + i*2.1; c.fillText('✦', x + Math.cos(a)*12*K, fy - 62*K + Math.sin(a)*3); }
    }
    if (u.weakT > 0){ c.fillStyle = '#c9a6ff'; c.font = F(12, 'bold system-ui'); c.fillText('▼', x - 18*K, cy); }
    if (u.taunt > 0 && u.taunter && u.taunter.alive){ c.fillStyle = '#ff9a7a'; c.font = F(15, 'bold system-ui'); c.fillText('!', x + 19*K, fy - 50*K); }
    // 체력바와 마법 표식 배지 (머리 위)
    const hp = clamp(u.hp/u.maxHp, 0, 1);
    if (u._ghost == null || u._ghost < hp) u._ghost = hp; else u._ghost = Math.max(hp, u._ghost - rdt*.7);
    const bw = 40*K, bh = 5.5*K, bx = x - bw/2 + 6*K, by = fy - 70*K;
    c.fillStyle = 'rgba(6,8,22,.85)'; rrect(c, bx - 1, by - 1, bw + 2, bh + 2, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(bx, by, bw*u._ghost, bh);
    c.fillStyle = hp < .3 ? '#ff7a7a' : tc; c.fillRect(bx, by, bw*hp, bh);
    c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(bx, by, bw*hp, Math.max(1, bh*.35));
    if (u.shield > 0){ c.fillStyle = '#fff3c4'; c.fillRect(bx, by - 3*K, bw*clamp(u.shield/u.maxHp, 0, 1), 2*K); }
    const gx = bx - 8*K, gy = by + bh/2, gR = 7.5*K;
    c.fillStyle = ec; c.beginPath(); c.arc(gx, gy, gR, 0, TAU); c.fill(); c.strokeStyle = tc; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = EL[u.c.e].fg || '#fff'; c.font = F(10, '"Song Myung", serif'); c.fillText(u.c.g, gx, gy + .5);
    // 이름표 (발 아래)
    c.font = F(12, '"Gowun Dodum", system-ui');
    { const mt = typeof c.measureText === 'function' ? c.measureText(u.st.name) : null;
      const lh = 16*K, w = (mt && mt.width ? mt.width : u.st.name.length*12*K) + 10, rr = {x:x - w/2, y:fy + 5*K, w, h:lh};
      if (!B._labels.some(q => rr.x < q.x + q.w && q.x < rr.x + rr.w && rr.y < q.y + q.h && q.y < rr.y + rr.h)){
        B._labels.push(rr);
        c.fillStyle = 'rgba(10,12,32,.78)'; rrect(c, rr.x, rr.y, rr.w, rr.h, lh/2); c.fill();
        c.strokeStyle = rgba(tc, .45); c.lineWidth = 1; c.stroke();
        c.fillStyle = u.team === 0 ? '#f6e3ad' : '#f8c9d4'; c.fillText(u.st.name, x, rr.y + lh/2 + .5); } }
  }
  // 공중 효과
  c.globalCompositeOperation = 'lighter';
  for (const f of B.fx){
    if (f.t < 0) continue;
    const p = f.t/f.life;
    if (f.k === 'proj'){
      const [x1, y1] = P(f.x1, f.y1), [x2, y2] = P(f.x2, f.y2);
      const x = x1 + (x2 - x1)*p, y = y1 + (y2 - y1)*p, q = Math.max(0, p - .4);
      const tx = x1 + (x2 - x1)*q, ty = y1 + (y2 - y1)*q;
      c.lineCap = 'round';
      c.strokeStyle = rgba(f.col, .35); c.lineWidth = Math.max(4, f.r*1.6)*K; c.beginPath(); c.moveTo(tx, ty); c.lineTo(x, y); c.stroke();
      c.strokeStyle = shade(f.col, .45); c.lineWidth = Math.max(1.5, f.r*.5)*K; c.beginPath(); c.moveTo(tx, ty); c.lineTo(x, y); c.stroke();
      c.lineCap = 'butt';
      const hr = (f.r + 3)*K, g = c.createRadialGradient(x, y, 0, x, y, hr*1.8);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.3, shade(f.col, .4)); g.addColorStop(1, rgba(f.col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, hr*1.8, 0, TAU); c.fill();
    } else if (f.k === 'ring'){
      const [x, y] = P(f.x, f.y), r = f.r*(.4 + .6*p);
      c.globalAlpha = 1 - p;
      c.strokeStyle = rgba(f.col, .35); c.lineWidth = 6*(1-p) + 1; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.strokeStyle = shade(f.col, .3); c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.globalAlpha = 1;
    } else if (f.k === 'trail'){
      const [x1, y1] = P(f.x1, f.y1), [x2, y2] = P(f.x2, f.y2);
      c.lineCap = 'round'; c.globalAlpha = 1 - p;
      c.strokeStyle = rgba(f.col, .3); c.lineWidth = 16*(1-p) + 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = shade(f.col, .5); c.lineWidth = 4*(1-p) + 1; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.globalAlpha = 1; c.lineCap = 'butt';
    } else if (f.k === 'zig'){
      for (const [w, col, al] of [[9, f.col, .3], [3.5, f.col, .9], [1.3, '#ffffff', 1]]){
        c.strokeStyle = col; c.globalAlpha = (1 - p)*al; c.lineWidth = w; c.lineJoin = 'round'; c.beginPath();
        f.pts.forEach(([px, py], i) => { const [x, y] = P(px, py); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      }
      c.globalAlpha = 1; c.lineJoin = 'miter';
    } else if (f.k === 'spark'){
      const [x, y0] = P(f.x, f.y), y = y0 - p*30, s = 4*K*(1 - p*.4);
      c.globalAlpha = 1 - p; c.fillStyle = f.col;
      c.fillRect(x - s, y - s*.28, s*2, s*.56); c.fillRect(x - s*.28, y - s, s*.56, s*2);
      c.globalAlpha = 1;
    }
  }
  c.globalCompositeOperation = 'source-over';
  // 피해·회복 숫자
  for (const f of B.fx){
    if (f.t < 0 || f.k !== 'txt') continue;
    const p = f.t/f.life, [x, y] = P(f.x, f.y), pop = p < .15 ? 1 + (1 - p/.15)*.35 : 1;
    c.globalAlpha = p > .6 ? (1 - p)/.4 : 1;
    c.font = F(14*pop, 'bold system-ui'); c.lineWidth = 3.5; c.strokeStyle = 'rgba(8,8,20,.85)';
    c.strokeText(f.s, x, y - p*22); c.fillStyle = f.col; c.fillText(f.s, x, y - p*22); c.globalAlpha = 1;
  }
  drawTactics(c);
  // 주문 이름 배너
  for (const f of B.fx){
    if (f.k !== 'call') continue;
    const p = f.t/f.life, [x, uy] = P(f.u.x, f.u.y), y = uy - 70*K - p*8;
    c.globalAlpha = p > .7 ? (1 - p)/.3 : Math.min(1, p*8);
    c.font = F(15, 'bold "Gowun Dodum", system-ui');
    const mt = typeof c.measureText === 'function' ? c.measureText(f.s) : null, w = (mt && mt.width ? mt.width : f.s.length*15*K) + 18*K, h = 22*K;
    c.fillStyle = 'rgba(10,12,32,.88)'; rrect(c, x - w/2, y - h/2, w, h, h/2); c.fill();
    c.strokeStyle = f.col; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = shade(f.col, .35); c.fillText(f.s, x, y + .5); c.globalAlpha = 1;
  }
  c.restore();
}
