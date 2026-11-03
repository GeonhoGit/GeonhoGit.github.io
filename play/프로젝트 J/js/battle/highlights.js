// 실제 경기 사건만 기록합니다. 연출은 전투 난수나 진행 속도를 바꾸지 않습니다.
"use strict";

function addHighlight(bt, event){
  const list = bt.highlights || (bt.highlights = []);
  const entry = {...event, t:bt.t, score:[...bt.score]};
  const old = list.findIndex(x => x.type === entry.type && x.team === entry.team && x.sid === entry.sid);
  if (old >= 0){
    if (list[old].priority >= entry.priority) return;
    list.splice(old, 1);
  }
  list.push(entry);
  if (list.length > 40) list.shift();
  if (!bt.spotlight || bt.t - bt.spotlight.t > 3.5 || entry.priority >= bt.spotlight.priority) bt.spotlight = entry;
}
function highlightKill(bt, src, tgt){
  const streaks = bt.highlightStreaks || (bt.highlightStreaks = {});
  streaks[`${tgt.team}:${tgt.st.id}`] = 0;
  if (src.team === tgt.team) return;
  const key = `${src.team}:${src.st.id}`;
  // 사후 지속 피해 처치는 점수에 남지만 생존 중 연속 처치에는 포함하지 않습니다.
  const n = src.alive ? (streaks[key] = (streaks[key] || 0) + 1) : 0;
  if (bt.score[0] + bt.score[1] === 1) addHighlight(bt, {type:'first', team:src.team, sid:src.st.id, priority:40, text:`첫 처치 · ${src.st.name}`});
  if (n >= 2) addHighlight(bt, {type:'streak', team:src.team, sid:src.st.id, priority:60 + Math.min(n, 10), text:`${src.st.name}, 쓰러지지 않고 ${n}연속 처치`});
  const leader = bt.score[0] === bt.score[1] ? null : bt.score[0] > bt.score[1] ? 0 : 1;
  if (leader !== null){
    if (bt.lastHighlightLeader != null && leader !== bt.lastHighlightLeader) addHighlight(bt, {type:'lead', team:leader, priority:100, text:`${leader === 0 ? '우리 팀' : '상대 팀'} 역전! ${bt.score[0]} : ${bt.score[1]}`});
    bt.lastHighlightLeader = leader;
  }
}
function highlightSurvival(bt){
  for (const u of bt.units){
    if (!u.alive){ u.highlightCrisis = null; continue; }
    const ratio = u.hp/u.maxHp, crisis = u.highlightCrisis;
    if (crisis && (crisis.deaths !== u.d || bt.t - crisis.t > 8)) u.highlightCrisis = null;
    if (u.highlightCrisis && ratio >= .35){
      addHighlight(bt, {type:'survive', team:u.team, sid:u.st.id, priority:75, text:`${u.st.name}, 체력 15% 이하의 위기에서 35% 이상으로 회복`});
      u.highlightCrisis = null;
    } else if (!u.highlightCrisis && ratio <= .15) u.highlightCrisis = {t:bt.t, deaths:u.d};
  }
}
function battleHighlights(bt){
  const entries = [...(bt.highlights || [])];
  for (const log of bt.tacticLog || []){
    if (!log.after) continue;
    const scored = log.after[log.team] - log.score[log.team], conceded = log.after[1-log.team] - log.score[1-log.team];
    if (!scored && conceded) continue;
    entries.push({type:'tactic', t:log.t, team:log.team, priority:50 + Math.min(scored, 5),
      text:`${TACTICS[log.k].n} 사용 뒤 ${(log.endT-log.t).toFixed(1)}초 동안 ${scored}득점 · ${conceded}실점`});
  }
  return entries.sort((a,b) => b.priority-a.priority || a.t-b.t).slice(0,3).sort((a,b) => a.t-b.t);
}
function highlightsHtml(bt){
  const rows = battleHighlights(bt);
  return `<section class="panel highlights"><h3>경기의 결정적 장면</h3>
    ${rows.length ? `<ol>${rows.map(x => `<li><span class="num muted">${x.t.toFixed(1)}초</span> <span class="${x.team === 0 ? 'good' : 'bad'}">${x.team === 0 ? '우리' : '상대'}</span> ${esc(x.text)}</li>`).join('')}</ol>` : '<p class="muted">특별한 장면 없이 경기가 끝났습니다.</p>'}
    <p class="muted" style="font-size:.8rem">기록된 장면 중 최대 3개입니다. 작전 이후의 득실점은 같은 시간에 일어난 기록입니다.</p></section>`;
}
function highlightState(){
  const el = document.getElementById('battle-highlight'); if (!el) return;
  const h = B.spotlight, text = h && B.t-h.t <= 3.5 ? `${h.t.toFixed(1)}초 · ${h.text}` : '';
  if (el.textContent !== text) el.textContent = text;
  el.hidden = !text;
}
