// 전투 시뮬레이션: 유닛, 피해·회복, 주문, 한 틱 진행
"use strict";

/* =========================================================
   전투 시뮬레이션
   ========================================================= */
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);

function mkUnit(team, champ, st, bonus, idx){
  const c = CH[champ], p = patchOf(champ);
  let m = condMult(st.cond) * (1 + bonus) * moraleMult(st);
  if (st.elem === c.e) m *= hasT(st, 'prodigy') ? 1.2 : 1.10;
  if (st.fav.includes(champ)) m *= 1.08;
  m *= mastMult(st, champ);
  const sa = 0.6 + st.atk/100*0.8, sd = 0.6 + st.def/100*0.8;  // 능력치가 전투력에 더 크게 반영
  const maxHp = c.hp * sd * m * p.hp * (hasT(st, 'iron') ? 1.12 : 1);
  const front = c.role === '수호' || c.role === '돌격';
  const hx = team === 0 ? (front ? 140 : 70) : (front ? W-140 : W-70);
  const hy = H/2 + (idx-1)*95;
  return { team, champ, c, st, x:hx, y:hy, hx, hy, hp:maxHp, maxHp,
    atk: c.atk*sa*m*p.atk*1.15, def: c.def*sd*m, range:c.range, spd:c.spd, acd:c.acd,
    scd: c.cd*Math.max(.62, 1.15 - st.int/100*0.3)*p.cd*(hasT(st, 'focus') ? .9 : 1), at:.4+Math.random()*.4, sk:c.cd*.45,
    stun:0, shield:0, shT:0, taunt:0, taunter:null, burn:0, burnDps:0, burnSrc:null, hot:0, hotPs:0, hotSrc:null,
    tsp:1, alive:true, resp:0, k:0, d:0, dmg:0, heal:0, flash:0 };
}
function newBattle(teams, mapId = 'plain', strategies = []){ // teams: [[{champ, st, bonus}...], [...]], mapId: MAPS 키
  const units = [], els = teams.map(tm => tm.map(m => CH[m.champ].e));
  teams.forEach((tm, ti) => tm.forEach((m, i) => { const u = mkUnit(ti, m.champ, m.st, m.bonus, Number.isInteger(m.slot) && m.slot >= 0 && m.slot < 3 ? m.slot : i); applyGear(u); applyAwake(u); applySyn(u, els[ti]); applyGearAfter(u); applySpecialization(u); units.push(u); }));
  units.forEach(u => { if (hasT(u.st, 'mood')) units.forEach(o => { if (o !== u && o.team === u.team) o.atk *= 1.06; }); });
  const map = MAPS[mapId] ? mapId : 'plain';
  const battle = { units, els, map, strategies:[0,1].map(t => Object.prototype.hasOwnProperty.call(STRATEGIES, strategies[t]) ? strategies[t] : null), terrain:mapZones(map), t:0, dur:MATCH_SEC, score:[0,0], fx:[], feed:[], over:false, winner:-1, shake:0,
    timeline:[{t:0, score:[0,0]}], deaths:[], tacticLog:[], paused:false,
    tac:[0,1].map(() => ({left:TAC_USES, used:[], active:{}, next:0})), autoTac:[true, true] };
  setupCooperation(battle);
  return battle;
}
function recordBattle(B, final = false){
  highlightSurvival(B);
  const last = B.timeline[B.timeline.length - 1];
  if (final || B.t + 1e-9 >= last.t + 15){
    if (Math.abs(B.t - last.t) < 1e-6 || (final && B.t-last.t <= 1/60 + 1e-6)){ last.t = B.t; last.score = [...B.score]; }
    else B.timeline.push({t:B.t, score:[...B.score]});
  }
  B.tacticLog.forEach(log => {
    if (!log.after && (final || B.t + 1e-9 >= log.t + 6)){ log.after = [...B.score]; log.endT = B.t; }
  });
}
function battleAnalysisHtml(battle){
  const time = t => `${t.toFixed(1)}초`;
  const checkpoints = battle.timeline.map(p => `<tr><td class="num">${time(p.t)}</td><td class="num">${p.score[0]} : ${p.score[1]}</td></tr>`).join('');
  const deaths = battle.units.map(u => {
    const records = battle.deaths.filter(d => d.team === u.team && d.sid === u.st.id);
    return `<tr><td style="white-space:nowrap">${u.team === 0 ? '우리' : '상대'} ${esc(u.st.name)}</td><td class="num">${records.length}</td><td class="num">${records.length ? records.map(d => time(d.t)).join(', ') : '없음'}</td></tr>`;
  }).join('');
  const tactics = battle.tacticLog.map(log => {
    const end = log.after || battle.score, team = log.team, other = 1-team;
    return `<tr><td>${team === 0 ? '우리' : '상대'}</td><td>${TACTICS[log.k].n}</td><td class="num">${time(log.t)}</td><td class="num">${time(log.endT ?? battle.t)}까지 ${end[team]-log.score[team]}득점 / ${end[other]-log.score[other]}실점</td></tr>`;
  }).join('');
  return `<section class="panel" style="margin-bottom:1rem"><h3>경기 기록 분석</h3>
    <div class="grid2"><div><h4>시간대별 점수</h4><table><thead><tr><th>시점</th><th>우리 : 상대</th></tr></thead><tbody>${checkpoints}</tbody></table></div>
    <div><h4>학생별 사망 시점</h4><div style="overflow-x:auto"><table><thead><tr><th>학생</th><th>횟수</th><th>시점</th></tr></thead><tbody>${deaths}</tbody></table></div></div></div>
    <h4 style="margin-top:1rem">작전 이후 기록</h4><p class="muted" style="font-size:.85rem">사용 후 최대 6초 동안의 득실점입니다. 같은 시간에 일어난 전투를 함께 기록하며 작전의 효과를 단정하지 않습니다.</p>
    <div style="overflow-x:auto"><table><thead><tr><th>팀</th><th>작전</th><th>사용 시점</th><th>이후 기록</th></tr></thead><tbody>${tactics || '<tr><td colspan="4" class="muted">사용한 작전이 없습니다.</td></tr>'}</tbody></table></div></section>`;
}
const foes = (B,u) => B.units.filter(o => o.alive && o.team !== u.team);
const allies = (B,u) => B.units.filter(o => o.alive && o.team === u.team);
const foesNear = (B,u,x,y,r) => foes(B,u).filter(o => Math.hypot(o.x-x, o.y-y) <= r);

function fxTxt(B, x, y, s, col){ if (B.headless) return; B.fx.push({k:'txt', x:x+fxRnd(-8,8), y, s, col, t:0, life:.8}); }
function fxProj(B, a, b, col, r=3, life=.18){ if (B.headless) return; B.fx.push({k:'proj', x1:a.x, y1:a.y, x2:b.x, y2:b.y, col, r, t:0, life}); }
const fxLine = (B, a, b, col, life) => fxProj(B, a, b, col, 3, life);
function fxBurst(B, x, y, r, col, life=.45, delay=0){ if (B.headless) return; B.fx.push({k:'burst', x, y, r, col, t:delay, life}); }
function fxTrail(B, x1, y1, x2, y2, col){ if (B.headless) return; B.fx.push({k:'trail', x1, y1, x2, y2, col, t:0, life:.35}); }
function fxZig(B, a, b, col){
  if (B.headless) return; const pts = [], n = 6;
  for (let i=0;i<=n;i++){ const p = i/n, j = i && i < n ? 9 : 0; pts.push([a.x+(b.x-a.x)*p+fxRnd(-j,j), a.y+(b.y-a.y)*p+fxRnd(-j,j)]); }
  B.fx.push({k:'zig', pts, col, t:0, life:.25});
}
function fxSpark(B, x, y, col){ if (B.headless) return; for (let i=0;i<6;i++) B.fx.push({k:'spark', x:x+fxRnd(-14,14), y:y+fxRnd(-6,10), col, t:-fxRnd(0,.15), life:.7}); }
function fxCall(B, u){ if (B.headless) return; B.fx.push({k:'call', u, s:u.c.sk, col:EL[u.c.e].c, t:0, life:1.1}); sfx('skill', u.c.e); }
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function shake(B, a){ if (!B.headless && !RM) B.shake = Math.max(B.shake || 0, a); }
function fxReach(B, x, y, r, col){ if (B.headless) return; B.fx.push({k:'reach', x, y, r, col, t:0, life:.7}); }
function fxRing(B, x, y, r, col, life=.45){ if (B.headless) return; B.fx.push({k:'ring', x, y, r, col, t:0, life}); }

function damage(B, src, tgt, raw, quiet){
  if (!tgt.alive || B.over) return 0;
  let d = raw * traitAtk(B, src) * (src.weakT > 0 ? .7 : 1) * (tacOn(B, src.team, 'focus') ? 1.15 : 1) * (tacOn(B, tgt.team, 'guard') ? .7 : 1) * elemMult(src.c.e, tgt.c.e) * awkDmg(src, tgt) * specializationDamage(B, src, tgt) * strategyDamageTaken(B, tgt) * gearDamageMult(src) * (tgt.mistT > 0 ? .75 : 1) * (100 / (100 + tgt.def*2.2)) * (quiet ? 1 : rnd(.92, 1.08));
  if (tgt.shield > 0){ const ab = Math.min(tgt.shield, d); tgt.shield -= ab; d -= ab; }
  tgt.hp -= d; src.dmg += d; tgt.flash = .12;
  if (src.lifesteal && src.alive && d > 0){ const h = Math.min(d*src.lifesteal, src.maxHp - src.hp); src.hp += h; src.heal += h; }
  if (!quiet && d >= 1) fxTxt(B, tgt.x, tgt.y-22, R(d), '#f4ecd6');
  if (tgt.hp <= 0 && !awkSave(B, tgt)) kill(B, src, tgt);
  gearCrisis(B,tgt);
  return d;
}
function heal(B, src, tgt, amt, quiet){
  if (!tgt.alive) return;
  amt = gearHealingAmount(src,tgt,amt);
  for (const part of specializationHealing(B, src, tgt, amt)){
    const h = Math.max(0, Math.min(part.amount, part.target.maxHp - part.target.hp));
    part.target.hp += h; src.heal += h;
    if (!quiet && h >= 1) fxTxt(B, part.target.x, part.target.y-22, '+' + R(h), '#9ff0bf');
  }
}
function kill(B, src, tgt){
  B.deaths.push({t:B.t, sid:tgt.st.id, team:tgt.team});
  tgt.alive = false; tgt.hp = 0; tgt.d++; tgt.resp = (3 + B.t/20) * (hasT(tgt.st, 'phoenix') ? .7 : 1) * (1 - (tgt.gearResp || 0));
  tgt.burn = 0; tgt.hot = 0; tgt.shield = 0;
  if (src.team !== tgt.team){ src.k++; B.score[src.team]++; }
  highlightKill(B, src, tgt);
  B.feed.unshift({team:src.team, text:`${src.st.name}(${src.c.n}) → ${tgt.st.name}(${tgt.c.n})`});
  if (!B.headless) sfx('kill', src.team);
  B.feed = B.feed.slice(0, 4);
  fxRing(B, tgt.x, tgt.y, 30, src.team === 0 ? '#dcb96e' : '#ef8aa2', .6);
}
function target(B,u){
  if (u.taunt > 0 && u.taunter && u.taunter.alive) return u.taunter;
  if (tacOn(B, u.team, 'focus')){ const fs = foes(B,u); if (fs.length) return fs.sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp)[0]; }
  const fs = foes(B,u); if (!fs.length) return null;
  const chosen = strategyTarget(B, u, fs); if (chosen) return chosen;
  let best = null, bs = 1e9;
  if (u.c.assassin){
    for (const f of fs){ const s = dist(u,f)*.5 + (f.hp/f.maxHp)*120 - (f.c.range > 100 ? 70 : 0); if (s < bs){ bs = s; best = f; } }
    return best;
  }
  const w = u.st.int/100*90;
  for (const f of fs){ const s = dist(u,f) + (f.hp/f.maxHp)*w; if (s < bs){ bs = s; best = f; } }
  return best;
}
function moveTo(u, x, y, d){
  const dx = x-u.x, dy = y-u.y, l = Math.hypot(dx,dy) || 1;
  u.mvx = dx/l; u.mvy = dy/l;
  u.x += dx/l*Math.min(d, l); u.y += dy/l*Math.min(d, l);
}
function behind(u, f){ u.x = clamp(f.x + (f.team === 1 ? 24 : -24), 20, W-20); u.y = clamp(f.y + rnd(-10,10), 20, H-20); }

function useSkill(B,u){
  const a = u.atk, col = EL[u.c.e].c, R = u.c.sr || u.range, A = u.c.ar || 0;
  switch (u.champ){
    case 'ember': {
      const t = target(B,u); if (!t || dist(u,t) > R) return false;
      fxProj(B,u,t,'#ffb070',7,.2); fxBurst(B,t.x,t.y,A,col,.5,-.18); shake(B,3);
      foesNear(B,u,t.x,t.y,A).forEach(f => damage(B,u,f,a*2.0));
      return true; }
    case 'blaze': {
      const fs = foes(B,u).filter(f => dist(u,f) < R); if (!fs.length) return false;
      const back = fs.filter(f => f.c.range > 100);
      const f = (back.length ? back : fs).sort((p,q) => p.hp/p.maxHp - q.hp/q.maxHp)[0];
      const ox = u.x, oy = u.y; behind(u,f); fxTrail(B,ox,oy,u.x,u.y,col); fxBurst(B,f.x,f.y,32,'#ffb070',.4);
      damage(B,u,f,a*1.4); if (f.alive){ f.burn = 3; f.burnDps = a*.2; f.burnSrc = u; }
      return true; }
    case 'golem': {
      const fs = foesNear(B,u,u.x,u.y,A); if (!fs.length) return false;
      u.shield = u.maxHp*.2; u.shT = 4; fxRing(B,u.x,u.y,A,col,.6); fxBurst(B,u.x,u.y,44,col,.4);
      fs.forEach(f => { f.taunt = 2.5; f.taunter = u; });
      return true; }
    case 'gale': {
      const fs = foes(B,u).filter(f => dist(u,f) < R); if (!fs.length) return false;
      const f = fs.sort((p,q) => p.hp/p.maxHp - q.hp/q.maxHp)[0];
      const ox = u.x, oy = u.y; behind(u,f); fxTrail(B,ox,oy,u.x,u.y,'#c9fff0'); fxBurst(B,f.x,f.y,26,'#c9fff0',.3);
      damage(B,u,f,a*2.2);
      return true; }
    case 'storm': {
      const fs = foes(B,u).filter(f => dist(u,f) <= R).sort((p,q) => dist(u,p) - dist(u,q)).slice(0,3);
      if (!fs.length) return false;
      fs.forEach(f => { fxProj(B,u,f,'#c9fff0',3,.2); damage(B,u,f,a*1.0); });
      return true; }
    case 'bolt': {
      let t = target(B,u); if (!t || dist(u,t) > R) return false;
      const hit = [t]; const mult = [1.8,1.0,.7]; let prev = u;
      for (let i=0;i<3 && t;i++){
        fxZig(B,prev,t,'#fff6a8'); damage(B,u,t,a*mult[i]); prev = t;
        t = foes(B,u).filter(f => !hit.includes(f) && dist(prev,f) < A).sort((p,q) => dist(prev,p)-dist(prev,q))[0];
        if (t) hit.push(t);
      }
      return true; }
    case 'warden': {
      const fs = foesNear(B,u,u.x,u.y,A); if (!fs.length) return false;
      fxBurst(B,u.x,u.y,A,col,.55); fxRing(B,u.x,u.y,A,col,.6); shake(B,7);
      fs.forEach(f => { stunU(f, 1.4); damage(B,u,f,a*1.3); });
      return true; }
    case 'vine': {
      const al = allies(B,u).filter(o => dist(u,o) < R && o.hp/o.maxHp < .75).sort((p,q) => p.hp/p.maxHp - q.hp/q.maxHp);
      if (!al.length) return false;
      const t = al[0]; fxProj(B,u,t,'#9ff0bf',5,.25); fxSpark(B,t.x,t.y,'#9ff0bf');
      heal(B,u,t,a*3.4); t.hot = 4; t.hotPs = a*.7; t.hotSrc = u;
      return true; }
    case 'stone': {
      const t = target(B,u); if (!t || dist(u,t) > R) return false;
      fxProj(B,u,t,col,8,.22); fxBurst(B,t.x,t.y,34,col,.4,-.2); shake(B,4);
      damage(B,u,t,a*2.0); if (t.alive) stunU(t, .8);
      return true; }
    case 'frost': {
      const fs = foes(B,u).filter(f => dist(u,f) <= R); if (!fs.length) return false;
      const t = fs.sort((p,q) => q.atk - p.atk)[0];
      fxProj(B,u,t,'#bfe3ff',6,.22); fxBurst(B,t.x,t.y,30,'#bfe3ff',.4,-.2);
      damage(B,u,t,a*1.7); if (t.alive){ stunU(t, 1.8); t.iceT = t.stun; }
      return true; }
    case 'tide': {
      const fs = foesNear(B,u,u.x,u.y,A); if (!fs.length) return false;
      fxBurst(B,u.x,u.y,A,col,.5); fxRing(B,u.x,u.y,A,'#bfe3ff',.5); shake(B,4);
      let tot = 0;
      fs.forEach(f => { tot += damage(B,u,f,a*1.5); const dx=f.x-u.x, dy=f.y-u.y, l=Math.hypot(dx,dy)||1; f.x = clamp(f.x+dx/l*45,20,W-20); f.y = clamp(f.y+dy/l*45,20,H-20); });
      heal(B,u,u,tot*.4);
      return true; }
    case 'spring': {
      const al = allies(B,u).filter(o => dist(u,o) <= R); if (!al.some(o => o.hp/o.maxHp < .7)) return false;
      al.forEach(o => { fxSpark(B,o.x,o.y,'#9ff0bf'); heal(B,u,o,a*5.4); });
      return true; }
    case 'sun': {
      if (!foesNear(B,u,u.x,u.y,R+30).length) return false;
      allies(B,u).filter(o => dist(u,o) < R).forEach(o => { o.shield = Math.max(o.shield, o.maxHp*.15); o.shT = Math.max(o.shT, 4); fxRing(B,o.x,o.y,26,'#fff3c4',.5); });
      fxBurst(B,u.x,u.y,R,'#efe2a8',.5);
      return true; }
    case 'prism': {
      const t = target(B,u); if (!t || dist(u,t) > R) return false;
      const ex = {x: u.x + (t.x-u.x)*1.6, y: u.y + (t.y-u.y)*1.6};
      fxTrail(B,u.x,u.y,ex.x,ex.y,'#fff3c4');
      foes(B,u).filter(f => segDist(f,u,t) < A).forEach(f => damage(B,u,f,a*2.0));
      return true; }
    case 'saint': {
      const al = allies(B,u).filter(o => dist(u,o) <= R), dead = B.units.filter(o => o.team === u.team && !o.alive && o.resp > 2);
      if (!al.some(o => o.hp/o.maxHp < .7) && !dead.length) return false;
      al.forEach(o => { fxSpark(B,o.x,o.y,'#fff3c4'); heal(B,u,o,a*4.5); });
      dead.forEach(o => o.resp = Math.max(.5, o.resp - 3));
      return true; }
    case 'shade': {
      const fs = foes(B,u).filter(f => dist(u,f) < R); if (!fs.length) return false;
      const f = fs.sort((p,q) => p.hp/p.maxHp - q.hp/q.maxHp)[0];
      const low = f.hp/f.maxHp <= .4, ox = u.x, oy = u.y; behind(u,f);
      fxTrail(B,ox,oy,u.x,u.y,'#b48cff'); fxBurst(B,f.x,f.y,low ? 40 : 26,'#b48cff',.35);
      damage(B,u,f,a*(low ? 2.6 : 1.5));
      return true; }
    case 'curse': {
      const t = target(B,u); if (!t || dist(u,t) > R) return false;
      fxProj(B,u,t,'#b48cff',6,.22); fxBurst(B,t.x,t.y,A-5,'#8b5fc7',.5,-.2);
      foesNear(B,u,t.x,t.y,A).forEach(f => { damage(B,u,f,a*1.6); f.weakT = 4; });
      return true; }
    case 'wraith': {
      const fs = foesNear(B,u,u.x,u.y,A); if (!fs.length) return false;
      fxBurst(B,u.x,u.y,A,'#8b5fc7',.5); let tot = 0;
      fs.forEach(f => { tot += damage(B,u,f,a*1.4); });
      heal(B,u,u,tot*.7);
      return true; }
    case 'volcano': {
      const fs = foes(B,u).filter(f => dist(u,f) <= R); if (!fs.length) return false;
      const t = fs.map(f => ({f, n:foes(B,u).filter(o => dist(o,f) < A).length})).sort((p,q) => q.n - p.n)[0].f;
      fxProj(B,u,t,'#ffb070',9,.3); fxBurst(B,t.x,t.y,A,col,.6,-.2); fxRing(B,t.x,t.y,A,'#ffb070',.6); shake(B,6);
      foesNear(B,u,t.x,t.y,A).forEach(f => damage(B,u,f,a*2.7));
      return true; }
    case 'gust': {
      const fs = foes(B,u).filter(f => dist(u,f) <= R).sort((p,q) => dist(u,p) - dist(u,q)).slice(0,2); if (!fs.length) return false;
      fxBurst(B,u.x,u.y,60,'#c9fff0',.35);
      fs.forEach(f => { fxLine(B,u,f,'#c9fff0',.25); damage(B,u,f,a*1.9);
        if (f.alive){ const dx=f.x-u.x, dy=f.y-u.y, l=Math.hypot(dx,dy)||1; f.x = clamp(f.x+dx/l*50,20,W-20); f.y = clamp(f.y+dy/l*50,20,H-20); stunU(f, 1.3); } });
      return true; }
    case 'rush': {
      const fs = foes(B,u).filter(f => dist(u,f) < R); if (!fs.length) return false;
      const back = fs.filter(f => f.c.range > 100), t = (back.length ? back : fs).sort((p,q) => dist(u,q) - dist(u,p))[0];
      const s0 = {x:u.x, y:u.y}, hit = foes(B,u).filter(f => segDist(f, s0, t) < 36);
      behind(u,t); fxTrail(B,s0.x,s0.y,u.x,u.y,col); fxBurst(B,t.x,t.y,36,col,.4); shake(B,5);
      hit.forEach(f => damage(B,u,f,a*1.45)); if (t.alive) stunU(t, .8);
      return true; }
    case 'mist': {
      const al = allies(B,u).filter(o => dist(u,o) <= R); if (!foesNear(B,u,u.x,u.y,R+20).length && !al.some(o => o.hp/o.maxHp < .7)) return false;
      al.forEach(o => { o.mistT = 3; heal(B,u,o,a*2.85); fxRing(B,o.x,o.y,28,'#bfe3ff',.6); });
      fxBurst(B,u.x,u.y,120,'#bfe3ff',.5);
      return true; }
  }
  return false;
}
function basic(B,u,t){
  if (u.range > 100) fxLine(B,u,t,EL[u.c.e].c,.16);
  damage(B,u,t,u.atk);
}
function step(B, dt){
  if (B.over || B.paused) return;
  B.t += dt;
  tacticTick(B, dt);
  for (const u of B.units){
    if (!u.alive){
      u.resp -= dt;
      if (u.resp <= 0){ u.alive = true; u.hp = u.maxHp; u.x = u.hx; u.y = u.hy; u.stun = 0; u.iceT = 0; u.weakT = 0; u.taunt = 0; u.sk = Math.min(u.sk, u.scd*.5); if (u.spawnShield){ u.shield = u.maxHp*u.spawnShield; u.shT = 8; } }
      continue;
    }
    u.at -= dt; u.sk -= dt; u.flash = Math.max(0, u.flash-dt);
    if (u.shT > 0){ u.shT -= dt; if (u.shT <= 0) u.shield = 0; }
    if (u.taunt > 0) u.taunt -= dt;
    if (u.burn > 0){ u.burn -= dt; damage(B, u.burnSrc, u, u.burnDps*dt, true); if (!u.alive) continue; }
    if (u.hot > 0){ u.hot -= dt; heal(B, u.hotSrc, u, u.hotPs*dt, true); }
    if (u.regen) heal(B, u, u, u.maxHp*u.regen*dt, true);
    if (u.iceT > 0) u.iceT -= dt;
    if (u.weakT > 0) u.weakT -= dt;
    if (u.mistT > 0) u.mistT -= dt;
    u.mvx = u.mvy = 0;
    terrainTick(B, u, dt);
    gearCrisis(B,u);
    if (u.stun > 0){ u.stun -= dt; continue; }
    if (u.retreat > 0){ u.retreat -= dt; moveTo(u, u.hx, u.hy, u.spd*u.tsp*1.3*dt); heal(B, u, u, u.maxHp*.1*dt, true); continue; }
    if (u.sk <= 0){
      const ox = u.x, oy = u.y;
      gearBeginSkill(u);
      const casted = cooperationSkill(B,u,() => useSkill(B,u));
      gearEndSkill(u,casted);
      if (casted){ u.sk = u.scd * awkCd(u); fxCall(B,u); fxReach(B, ox, oy, u.c.sr || u.c.ar || u.range, EL[u.c.e].c); }
    }
    if (!u.alive) continue;
    const t = target(B,u); if (!t) continue;
    const d = dist(u,t);
    const moved = strategyMove(B, u, t, dt);
    if (d > u.range){ if (!moved) moveTo(u, t.x, t.y, u.spd*u.tsp*dt); }
    else {
      if (!moved && u.range > 100){
        const fs = foes(B,u); let n = null, nd = 1e9;
        for (const f of fs){ const q = dist(u,f); if (q < nd){ nd = q; n = f; } }
        if (n && nd < 55 && u.at > .25){
          const dx = u.x-n.x, dy = u.y-n.y, l = Math.hypot(dx,dy)||1;
          u.x += dx/l*u.spd*u.tsp*.75*dt; u.y += dy/l*u.spd*u.tsp*.75*dt;
        }
      }
      if (u.at <= 0){ u.at = u.acd; basic(B,u,t); }
    }
  }
  // 겹침 방지
  const al = B.units.filter(u => u.alive);
  for (let i=0;i<al.length;i++) for (let j=i+1;j<al.length;j++){
    const a = al[i], b = al[j], dx = b.x-a.x, dy = b.y-a.y, d = Math.hypot(dx,dy);
    if (d < 34 && d > .01){ const p = (34-d)/2; a.x -= dx/d*p; a.y -= dy/d*p; b.x += dx/d*p; b.y += dy/d*p; }
  }
  terrainCollide(B, dt);
  cooperationTick(B);
  for (const u of B.units){ u.x = clamp(u.x, 20, W-20); u.y = clamp(u.y, 20, H-20); }
  if (!B.headless){ B.fx = B.fx.filter(f => (f.t += dt) < f.life); if (B.shake > 0) B.shake = Math.max(0, B.shake - dt*22); }
  recordBattle(B);
  if (B.t >= B.dur){
    if (B.score[0] !== B.score[1] || B.t >= B.dur + 20) finishBattle(B);
    else B.overtime = true;
  }
}
function finishBattle(B){
  recordBattle(B, true);
  B.over = true;
  if (B.score[0] !== B.score[1]) B.winner = B.score[0] > B.score[1] ? 0 : 1;
  else {
    const dm = [0,1].map(t => B.units.filter(u => u.team === t).reduce((s,u) => s+u.dmg, 0));
    B.winner = dm[0] >= dm[1] ? 0 : 1; B.tiebreak = true;
  }
}
function runHeadless(B){ B.headless = true; B.paused = false; B.fx = []; while (!B.over) step(B, 1/60); }
