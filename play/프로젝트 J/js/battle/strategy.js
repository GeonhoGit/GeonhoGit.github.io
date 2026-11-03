// 경기 전체에 적용되는 팀 전술과 학교별 성향
"use strict";

const STRATEGIES = {
  pressure:{n:'압박', d:'먼저 후열과 치유 담당자를 노립니다.', weak:'깊이 추격해 아군과 떨어질 수 있습니다.', scout:'돌격 마법과 초반 집중 공격을 선호합니다. 수호·제어로 후열을 지키세요.'},
  protect:{n:'아군 보호', d:'후열에 파고든 적을 전열이 먼저 끊어 내고, 전열 곁(거리 110 안)에 있는 후열 학생은 받는 피해가 10% 줄어듭니다.', weak:'위협에 대응하느라 도망가는 적을 놓칠 수 있습니다.', scout:'치유·수호 조합과 방어 작전을 선호합니다. 넓은 범위 공격으로 모인 진형을 공략하세요.'},
  kite:{n:'거리 유지', d:'원거리 학생은 가까운 적부터 공격하고, 공격 사이에 거리를 벌립니다.', weak:'추격이 느리고 벽이나 돌진에 몰리면 거리를 확보하기 어렵습니다.', scout:'사격·제어 마법과 주문 폭발을 선호합니다. 돌진과 기절로 거리를 좁히세요.'},
};
const STRATEGY_KEYS = Object.keys(STRATEGIES);
const strategyKey = value => Object.prototype.hasOwnProperty.call(STRATEGIES, value) ? value : 'pressure';
function schoolStrategy(sc){
  if (sc && Object.prototype.hasOwnProperty.call(STRATEGIES, sc.strategy)) return sc.strategy;
  if (sc && sc.player) return strategyKey(S && S.teamStrategy);
  // 승강제로 학교 id가 바뀌어도 동일한 성향을 유지합니다. 난수는 소비하지 않습니다.
  let hash = 0;
  for (const c of String(sc && sc.name || '학교')) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return STRATEGY_KEYS[hash % STRATEGY_KEYS.length];
}
function strategyPickerHtml(selected, compact = false){
  const key = strategyKey(selected), s = STRATEGIES[key];
  if (compact) return `<section class="strat-pick"><div class="row" style="gap:.5rem;align-items:center"><b class="strat-title">팀 전술</b>
    <span class="row" role="group" aria-label="팀 전술" style="gap:.35rem">${STRATEGY_KEYS.map(k => `<button class="btn ghost small" data-a="teamStrategy" data-v="${k}" aria-pressed="${key === k}">${STRATEGIES[k].n}</button>`).join('')}</span></div>
    <p style="margin:.4rem 0 0;font-size:.88rem">${s.d}</p><p class="muted" style="font-size:.8rem;margin:.2rem 0 0">주의: ${s.weak} 작전 지시와 도발은 기본 전술보다 우선합니다.</p></section>`;
  return `<section class="panel" style="margin-bottom:1rem"><h3>팀 전술</h3>
    <div class="row" role="group" aria-label="팀 전술">${STRATEGY_KEYS.map(k => `<button class="btn ghost small" data-a="teamStrategy" data-v="${k}" aria-pressed="${key === k}">${STRATEGIES[k].n}</button>`).join('')}</div>
    <p style="margin-top:.6rem">${s.d}</p><p class="muted" style="font-size:.85rem">주의: ${s.weak} 경기 중 작전 지시와 도발은 기본 전술보다 우선합니다.</p></section>`;
}
function strategyIntelHtml(sc){
  const s = STRATEGIES[schoolStrategy(sc)];
  return `<div class="strategy-intel"><b>학교 전술 · ${s.n}</b><p style="margin:.3rem 0">${s.d}</p><p class="muted" style="font-size:.85rem">${s.scout}</p></div>`;
}
function strategyDraftBonus(key, id){
  const c = CH[id]; if (!c) return 0;
  if (key === 'pressure') return c.role === '돌격' ? 11 : c.role === '사격' ? 3 : 0;
  if (key === 'protect') return c.role === '치유' ? 11 : c.role === '수호' ? 8 : 0;
  if (key === 'kite') return c.role === '사격' ? 10 : c.role === '제어' ? 8 : 0;
  return 0;
}
function strategyAnchor(B, u){
  const back = allies(B, u).filter(a => a !== u && a.range > 100);
  return back.sort((a,b) => (b.c.role === '치유') - (a.c.role === '치유') || a.hp/a.maxHp - b.hp/b.maxHp)[0] || null;
}
function strategyTarget(B, u, fs){
  const key = B.strategies && B.strategies[u.team];
  if (key === 'pressure'){
    const score = f => dist(u,f) + f.hp/f.maxHp*65 - (f.c.role === '치유' ? 90 : f.range > 100 ? 55 : 0);
    return [...fs].sort((a,b) => score(a) - score(b))[0];
  }
  if (key === 'protect' && u.range <= 100){
    // 전열만 후열을 덮친 적을 끊어 냅니다. 너무 먼 적은 쫓지 않아 주문과 집중 공격이 흩어지지 않습니다.
    const anchor = strategyAnchor(B, u);
    if (anchor){
      const threats = fs.filter(f => dist(anchor, f) < 150 && dist(u, f) < 260);
      const score = f => dist(anchor, f) + f.hp/f.maxHp*80;
      if (threats.length) return threats.sort((a,b) => score(a) - score(b))[0];
    }
  }
  if (key === 'kite' && u.range > 100) return [...fs].sort((a,b) => dist(u,a) - dist(u,b))[0];
  return null;
}
// 아군 보호: 살아 있는 전열 곁의 후열 학생은 받는 피해 −10%
const PROTECT_GUARD = {range:110, mult:.9};
function strategyDamageTaken(B, tgt){
  if (!B.strategies || B.strategies[tgt.team] !== 'protect' || tgt.range <= 100) return 1;
  return B.units.some(a => a !== tgt && a.alive && a.team === tgt.team && a.range <= 100 && dist(a, tgt) < PROTECT_GUARD.range) ? PROTECT_GUARD.mult : 1;
}
// true면 이 틱의 기본 이동만 대체합니다. 사거리 안의 기본 공격은 계속 실행합니다.
function strategyMove(B, u, target, dt){
  if (u.taunt > 0 || tacOn(B, u.team, 'focus')) return false;
  const key = B.strategies && B.strategies[u.team];
  if (key === 'protect' && u.range <= 100){
    const anchor = strategyAnchor(B, u);
    // 후열 가까이 적이 파고들었고, 지금 공격하는 대상이 사거리 밖일 때만 돌아갑니다.
    if (anchor && dist(u, anchor) > 170 && dist(u, target) > u.range && foes(B,u).some(f => dist(anchor,f) < 120)){
      // 위협과 보호 대상 사이로 복귀하되, 두 학교가 모두 방어형이어도 교전은 시작합니다.
      const dx = target.x-anchor.x, dy = target.y-anchor.y, len = Math.hypot(dx,dy) || 1;
      moveTo(u, anchor.x+dx/len*65, anchor.y+dy/len*65, u.spd*u.tsp*dt);
      return true;
    }
  }
  if (key === 'kite' && u.range > 100 && u.at > .2){
    const nearest = [...foes(B,u)].sort((a,b) => dist(u,a) - dist(u,b))[0];
    if (nearest && dist(u,nearest) < Math.min(115, u.range*.68)){
      const dx = u.x-nearest.x, dy = u.y-nearest.y, len = Math.hypot(dx,dy);
      const x = len > .01 ? u.x+dx/len*60 : u.x+(u.team === 0 ? -60 : 60);
      const y = len > .01 ? u.y+dy/len*60 : u.y;
      moveTo(u, clamp(x,20,W-20), clamp(y,20,H-20), u.spd*u.tsp*.65*dt);
      return true;
    }
  }
  return false;
}
