// 전장 지형: 경기마다 바뀌는 좌우 대칭 맵과 지형 효과
"use strict";

/* =========================================================
   지형 맵
   - 모든 맵은 가운데 세로선(x = W/2)을 기준으로 좌우 대칭이다.
   - zones에는 왼쪽 절반과 가운데 지형만 적고, 오른쪽은 mapZones가 거울처럼 만든다.
   ========================================================= */
const TER = { lava:.03, spring:.03, mana:.5, wind:1.3, pillarPad:16 };
const TER_INFO = {
  lava:{n:'용암', d:`안에 있으면 초당 최대 체력의 ${TER.lava*100}%를 잃습니다. 용암만으로는 쓰러지지 않습니다.`, c:'#ff7a3c'},
  spring:{n:'치유의 샘', d:`안에 있으면 초당 최대 체력의 ${TER.spring*100}%를 회복합니다.`, c:'#6fe0b0'},
  mana:{n:'마력진', d:`안에 있으면 주문 재사용 시간이 ${1+TER.mana}배 빠르게 줄어듭니다.`, c:'#b48cff'},
  wind:{n:'바람길', d:`안에서는 이동 속도가 ${Math.round((TER.wind-1)*100)}% 빨라집니다.`, c:'#c9fff0'},
  pillar:{n:'돌기둥', d:'지나갈 수 없어 돌아가야 합니다. 주문과 공격은 막지 않습니다.', c:'#9aa0bf'},
};
const MAPS = {
  plain:{n:'평원 결투장', d:'지형이 없는 기본 경기장입니다.', zones:[]},
  pillars:{n:'돌기둥 회랑', d:'돌기둥 네 개가 길을 막습니다. 돌진하는 마법은 기둥을 돌아가느라 늦게 닿습니다.',
    zones:[{k:'pillar', x:245, y:128, r:24}, {k:'pillar', x:245, y:272, r:24}]},
  lava:{n:'용암 협곡', d:'가운데에 용암이 흐릅니다. 한가운데서 오래 버티는 근접 마법이 손해를 봅니다.',
    zones:[{k:'lava', x:W/2, y:H/2, r:62}]},
  spring:{n:'샘물 정원', d:'양쪽 옆길에 치유의 샘이 있습니다. 샘을 차지한 쪽이 오래 버팁니다.',
    zones:[{k:'spring', x:262, y:72, r:44}, {k:'spring', x:262, y:328, r:44}]},
  wind:{n:'바람 회랑', d:'위아래 옆길에 바람길이 있어 그 위에서는 빨리 움직입니다.',
    zones:[{k:'wind', x:170, y:72, w:W-340, h:62}, {k:'wind', x:170, y:266, w:W-340, h:62}]},
  mana:{n:'마력 샘터', d:'가운데 마력진 위에서는 주문을 훨씬 자주 씁니다. 중앙 싸움이 치열해집니다.',
    zones:[{k:'mana', x:W/2, y:H/2, r:66}]},
  ruins:{n:'고대 유적', d:'가운데 돌기둥 두 개와 양쪽 작은 샘이 있는 유적입니다.',
    zones:[{k:'pillar', x:W/2, y:110, r:22}, {k:'pillar', x:W/2, y:290, r:22}, {k:'spring', x:220, y:200, r:30}]},
};
const MAPK = Object.keys(MAPS);

// 오른쪽 절반을 거울처럼 채운 전체 지형 목록
function mapZones(id){
  const m = MAPS[id] || MAPS.plain, out = [];
  for (const z of m.zones){
    out.push({...z});
    if (z.w){ // 사각형: 왼쪽 위 꼭짓점 기준
      const mx = W - z.x - z.w;
      if (Math.abs(mx - z.x) > .5) out.push({...z, x:mx});
    } else if (Math.abs(z.x - W/2) > .5) out.push({...z, x:W - z.x});
  }
  return out;
}
function pickMap(rng = Math.random){ return MAPK[Math.floor(rng() * MAPK.length) % MAPK.length]; }
function inZone(z, p){
  if (z.w) return p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
  return Math.hypot(p.x - z.x, p.y - z.y) <= z.r;
}

// 한 유닛에 지형 효과 적용 (매 틱). 이동 속도 배율은 u.tsp에 둔다.
function terrainTick(B, u, dt){
  u.tsp = 1; u.zone = null;
  const zs = B.terrain; if (!zs || !zs.length) return;
  for (const z of zs){
    if (z.k === 'pillar' || !inZone(z, u)) continue;
    u.zone = z.k;
    if (z.k === 'lava'){ if (u.hp > 1) u.hp = Math.max(1, u.hp - u.maxHp*TER.lava*dt); }
    else if (z.k === 'spring') u.hp = Math.min(u.maxHp, u.hp + u.maxHp*TER.spring*dt);
    else if (z.k === 'mana') u.sk -= dt*TER.mana;
    else if (z.k === 'wind') u.tsp = TER.wind;
  }
}
// 돌기둥 밖으로 밀어내고, 가던 방향 쪽으로 미끄러지게 해서 돌아가게 한다.
function terrainCollide(B, dt){
  const ps = B.terrain ? B.terrain.filter(z => z.k === 'pillar') : [];
  if (!ps.length) return;
  for (const u of B.units){
    if (!u.alive) continue;
    for (const z of ps){
      const dx = u.x - z.x, dy = u.y - z.y, d = Math.hypot(dx, dy), R = z.r + TER.pillarPad;
      if (d >= R) continue;
      const nx = d > .01 ? dx/d : (u.team === 0 ? -1 : 1), ny = d > .01 ? dy/d : 0;
      u.x = z.x + nx*R; u.y = z.y + ny*R;
      // 접선 방향 두 개 중 이동하려던 방향과 가까운 쪽으로 미끄러진다
      let tx = -ny, ty = nx;
      const mx = u.mvx || 0, my = u.mvy || 0;
      if (tx*mx + ty*my < 0 || (mx === 0 && my === 0 && (u.y < z.y ? ty > 0 : ty < 0))){ tx = -tx; ty = -ty; }
      const s = u.spd*(u.tsp || 1)*dt*.9;
      u.x += tx*s; u.y += ty*s;
    }
  }
}
function mapLine(id){ const m = MAPS[id] || MAPS.plain; return `${m.n}: ${m.d}`; }
function mapZoneKinds(id){ return [...new Set((MAPS[id] || MAPS.plain).zones.map(z => z.k))]; }

// 밴픽·도감에 쓰는 작은 지도
function mapMiniSvg(id, w = 150){
  const zs = mapZones(id), h = Math.round(w*H/W);
  const shape = z => z.w
    ? `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14" fill="${TER_INFO[z.k].c}" fill-opacity=".35" stroke="${TER_INFO[z.k].c}" stroke-opacity=".7" stroke-width="3"/>`
    : z.k === 'pillar'
      ? `<circle cx="${z.x}" cy="${z.y}" r="${z.r}" fill="#6b7092" stroke="#cfd3ea" stroke-width="3"/>`
      : `<circle cx="${z.x}" cy="${z.y}" r="${z.r}" fill="${TER_INFO[z.k].c}" fill-opacity=".38" stroke="${TER_INFO[z.k].c}" stroke-opacity=".75" stroke-width="3"/>`;
  return `<svg class="minimap" viewBox="0 0 ${W} ${H}" width="${w}" height="${h}" role="img" aria-label="${(MAPS[id] || MAPS.plain).n} 지도">
    <rect width="${W}" height="${H}" rx="24" fill="#141a44"/><ellipse cx="${W/2}" cy="${H/2}" rx="${W*.475}" ry="${H*.47}" fill="#2a3274" stroke="#e3c47e" stroke-opacity=".45" stroke-width="3"/>
    <ellipse cx="70" cy="${H/2}" rx="40" ry="110" fill="#e3c47e" fill-opacity=".14"/><ellipse cx="${W-70}" cy="${H/2}" rx="40" ry="110" fill="#ef8aa2" fill-opacity=".14"/>
    ${zs.map(shape).join('')}</svg>`;
}
function mapCardHtml(id, compact = false){
  const m = MAPS[id] || MAPS.plain, ks = mapZoneKinds(id);
  return `<div class="mapcard${compact ? ' compact' : ''}">${mapMiniSvg(id, compact ? 120 : 150)}<div><div class="mapname">전장 <b>${m.n}</b></div>
    <div class="muted" style="font-size:.86rem">${m.d}</div>
    ${ks.length ? `<div class="mapfx">${ks.map(k => `<span class="tchip" style="--tc:${TER_INFO[k].c}" title="${TER_INFO[k].d}">${TER_INFO[k].n}</span>`).join('')}</div>` : ''}</div></div>`;
}
