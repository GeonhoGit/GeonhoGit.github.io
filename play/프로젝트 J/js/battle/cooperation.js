// 고유 학생 쌍의 호흡으로 경기당 한 번 발동하는 협동기입니다.
"use strict";

const COOP_MIN = 15;
const COOP = {
  guard:{n:'위기의 손길',d:'두 학생이 180 거리 안에 있고 한 명의 체력이 25% 이하일 때, 그 학생에게 최대 체력 20%의 보호막을 4초간 부여합니다.'},
  follow:{n:'틈새 연격',d:'한 명이 주문으로 적을 기절시키고 다른 학생의 주문 사거리 안에 있으면, 동료가 공격력 120%의 추가 타격을 가합니다.'},
};
function cooperationPair(sids){
  const enrolled = new Set(S && me() ? me().students.map(st => st.id) : []);
  const ids = [...new Set(sids)].filter(id => enrolled.has(id)).sort();
  let best = null;
  for (let i=0; i<ids.length; i++) for (let j=i+1; j<ids.length; j++){
    const points = chemPts(ids[i],ids[j]);
    if (points >= COOP_MIN && (!best || points > best.points)) best = {ids:[ids[i],ids[j]],points};
  }
  return best;
}
function cooperationKind(roles){ return roles.some(role => role === '치유' || role === '수호') ? 'guard' : 'follow'; }
function setupCooperation(battle){
  battle.cooperation = [0,1].map(team => {
    const units = battle.units.filter(u => u.team === team);
    const pair = cooperationPair(units.map(u => u.st.id));
    if (!pair) return null;
    const partners = pair.ids.map(id => units.find(u => u.st.id === id));
    return {...pair, team, kind:cooperationKind(partners.map(u => u.c.role)), used:false};
  });
  return battle.cooperation;
}
function cooperationSkill(battle, unit, cast){
  const coop = battle.cooperation && battle.cooperation[unit.team];
  const tracks = coop && !coop.used && coop.kind === 'follow' && coop.ids.includes(unit.st.id) && unit.alive && !battle.over && !battle.paused;
  const before = foes(battle,unit).map(target => ({target,stun:target.stun}));
  const casted = cast();
  if (casted) for (const {target,stun} of before){
    if (target.alive && target.stun > stun){
      target.coopStunnedBy = tracks ? unit.st.id : null;
      target.coopStunUntil = tracks ? battle.t + target.stun : 0;
    }
  }
  return casted;
}
function cooperationTick(battle){
  if (battle.over || battle.paused) return;
  for (const coop of battle.cooperation || []){
    if (!coop || coop.used) continue;
    const partners = coop.ids.map(id => battle.units.find(u => u.team === coop.team && u.st.id === id));
    if (partners.some(u => !u || !u.alive || u.hp <= 0)) continue;
    let actor, target;
    if (coop.kind === 'guard'){
      if (dist(partners[0],partners[1]) > 180) continue;
      target = partners.filter(u => u.hp/u.maxHp <= .25 && u.shield < u.maxHp*.2).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp)[0];
      if (!target) continue;
      actor = partners.find(u => u !== target);
      coop.used = true;
      target.shield = Math.max(target.shield,target.maxHp*.2);
      target.shT = Math.max(target.shT,4);
      fxRing(battle,target.x,target.y,32,'#bfe3ff',.6);
    } else {
      target = battle.units.find(u => {
        if (u.team === coop.team || !u.alive || u.stun <= 0 || battle.t >= u.coopStunUntil || !coop.ids.includes(u.coopStunnedBy)) return false;
        const partner = partners.find(p => p.st.id !== u.coopStunnedBy);
        return partner && partner.stun <= 0 && dist(partner,u) <= (partner.c.sr || partner.range);
      });
      if (!target) continue;
      actor = partners.find(u => u.st.id !== target.coopStunnedBy);
      coop.used = true;
      fxLine(battle,actor,target,'#f1d58e',.3);
      damage(battle,actor,target,actor.atk*1.2,true);
    }
    coop.at = battle.t;
    fxTxt(battle,target.x,target.y-40,COOP[coop.kind].n,'#f1d58e');
    addHighlight(battle,{type:'cooperation',team:coop.team,sid:actor.st.id,priority:75,text:`협동 · ${partners.map(u => u.st.name).join(' & ')}의 ${COOP[coop.kind].n}`});
  }
}
function cooperationHtml(sids, picks = []){
  const pair = cooperationPair(sids);
  if (!pair) return '<div class="muted" style="font-size:.85rem;margin-top:.5rem">협동기 잠김 · 출전 학생 두 명의 호흡이 15(환상의 짝)에 도달하면 경기당 한 번 발동합니다.</div>';
  const names = pair.ids.map(id => esc(findSt(me(),id).name)).join(' &amp; ');
  const roles = pair.ids.map(id => picks.find(p => p.sid === id)).filter(Boolean).map(p => CH[p.champ].role);
  const kind = roles.length === 2 ? cooperationKind(roles) : null;
  return `<div class="notice" style="margin-top:.6rem"><strong>협동기 · ${names}</strong><p style="font-size:.85rem;margin:.35rem 0">호흡 ${pair.points} · 팀당 한 쌍, 경기당 한 번. ${kind ? `${COOP[kind].n}: ${COOP[kind].d}` : '둘 중 치유·수호 역할이 있으면 위기의 손길, 그 외에는 틈새 연격을 사용합니다.'}</p></div>`;
}
function cooperationStateHtml(battle){
  const coop = (battle.cooperation || []).find(entry => entry);
  if (!coop) return '';
  const names = coop.ids.map(id => battle.units.find(u => u.team === coop.team && u.st.id === id)).filter(Boolean).map(u => esc(u.st.name)).join(' &amp; ');
  return `<div class="muted" style="font-size:.85rem;margin-top:.4rem" title="${COOP[coop.kind].d}">협동 · ${names} · ${COOP[coop.kind].n} <strong>${coop.used ? '사용 완료' : '발동 대기'}</strong></div>`;
}
