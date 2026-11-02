// 밴픽 화면과 코치 조언
"use strict";

/* ---------- 드래프트 (출전 명단 포함) ---------- */
function startDraft(){
  const my = me(), oid = opponentId(), op = school(oid);
  const playerFirst = (S.week + S.season + (S.phase === 'final' && S.final ? S.final.games.length : 0) + (S.phase === 'cup' && S.cup ? S.cup.round + 1 : 0)) % 2 === 0;
  const A = playerFirst ? 0 : 1, Bt = 1 - A;
  const order = [[A,'ban'],[Bt,'ban'],[A,'pick'],[Bt,'pick'],[Bt,'pick'],[A,'pick'],[A,'pick'],[Bt,'pick']].map(([team,kind]) => ({team, kind}));
  const stById = {};
  my.students.concat(op.students).forEach(s => stById[s.id] = s);
  D = { opp:oid, order, step:0, bans:[[],[]], picks:[[],[]], roster:[my.students.map(s => s.id), op.students.map(s => s.id)], stById, formation:[0,1,2], sel:null, aiTimer:null, lastAi:null, map:pickMap() };
  V.view = 'draft'; render(); window.scrollTo(0,0);
}
function curTurn(){ return D.step < D.order.length ? D.order[D.step] : null; }
function doDraft(team, champ, sid){
  const t = curTurn(); if (!t || t.team !== team || !available().includes(champ)) return;
  if (t.kind === 'ban') D.bans[team].push(champ);
  else D.picks[team].push({champ, sid});
  D.step++; D.sel = null; D.lastAi = team === 1 ? champ : null;
  sfx(t.kind === 'ban' ? 'ban' : 'pick');
  if (!curTurn()) markTutorial('draft');
  render();
  if (!curTurn()) schedulePrediction();
}
function schedulePrediction(){
  const d = D;
  setTimeout(() => { if (D === d && V.view === 'draft' && !curTurn() && !D.pred){ predictDraft(); render(); } }, 30);
}
function formationOf(){
  const f = D.formation;
  return Array.isArray(f) && f.length === 3 && new Set(f).size === 3 && f.every(s => [0,1,2].includes(s)) ? f : [0,1,2];
}
function formationHtml(){
  if (curTurn()) return '';
  const f = formationOf();
  return `<section class="panel" style="margin:1rem 0"><h3>출전 배치</h3><p class="muted" style="font-size:.85rem">학생을 위·중앙·아래 자리로 옮길 수 있습니다. 수호·돌격은 전열, 나머지는 후열에서 시작합니다. 배치를 바꾸면 모의전 전망을 다시 계산합니다.</p>
    ${[0,1,2].map(slot => { const i = f.indexOf(slot), p = D.picks[0][i], st = D.stById[p.sid]; return `<div class="spread" style="gap:.6rem;padding:.6rem 0;border-bottom:1px solid var(--line)"><span><span class="muted">${['위','중앙','아래'][slot]}</span> ${esc(st.name)} · ${CH[p.champ].n}</span><div class="row"><button class="btn ghost small" aria-label="${esc(st.name)} 위로 이동" data-a="swapFormation" data-v="${i}:${f.indexOf(slot-1)}" ${slot === 0 ? 'disabled' : ''}>↑</button><button class="btn ghost small" aria-label="${esc(st.name)} 아래로 이동" data-a="swapFormation" data-v="${i}:${f.indexOf(slot+1)}" ${slot === 2 ? 'disabled' : ''}>↓</button></div></div>`; }).join('')}</section>`;
}
function maybeAi(){
  const t = curTurn();
  if (!t || t.team !== 1 || D.aiTimer) return;
  D.aiTimer = setTimeout(() => {
    D.aiTimer = null;
    if (V.view !== 'draft') return;
    const c = aiChoose(1, t.kind);
    doDraft(1, c, t.kind === 'pick' ? aiAssign(1, c) : null);
  }, 550);
}
function slotHtml(team, i){
  const p = D.picks[team][i];
  if (!p) return `<div class="slot"><span class="glyph empty">?</span><span class="muted">선택 대기</span></div>`;
  const st = D.stById[p.sid], c = CH[p.champ], tg = tagsFor(st, p.champ);
  return `<div class="slot ${team === 1 && D.lastAi === p.champ ? 'flash' : ''}"><span class="glyph" style="background:${EL[c.e].c};color:${EL[c.e].fg || '#fff'}">${c.g}</span>
    <span><span>${c.n}</span> <span class="muted" style="font-size:.85rem">${esc(st.name)}</span>
    <small>전투력 <span class="num">${R(fitScore(st, p.champ))}</span>${tg.length ? ', ' + tg.join(', ') : ''}</small></span></div>`;
}
function trackHtml(){
  return `<ol class="track" aria-label="밴픽 순서">${D.order.map((o,i) => `<li class="${o.team === 0 ? 'mine' : 'theirs'} ${i < D.step ? 'done' : ''} ${i === D.step ? 'now' : ''}">${o.team === 0 ? '우리' : '상대'} ${o.kind === 'ban' ? '금지' : '선택'}</li>`).join('')}</ol>`;
}
function viewDraft(){
  const t = curTurn(), op = school(D.opp), av = new Set(available()), mine = !!(t && t.team === 0);
  const rec = mine && t.kind === 'pick' ? recommended() : [];
  const banRec = mine && t.kind === 'ban' ? advice('ban').map(a => a.id) : [];
  let banner;
  if (!t) banner = `<div class="big">밴픽 완료</div>${predHtml()}<button class="btn" style="margin-top:.5rem" data-a="startBattle">대항전 시작</button>`;
  else if (mine) banner = `<div class="big">${t.kind === 'ban' ? '금지할 마법을 누르세요' : '마법을 누르고 맡을 학생을 고르세요'}</div>`;
  else banner = `<div class="big" style="color:var(--rose)">${esc(op.name)}이(가) ${t.kind === 'ban' ? '금지' : '선택'}하는 중</div>`;
  const owner = {};
  D.picks[0].forEach(p => owner[p.champ] = '우리'); D.picks[1].forEach(p => owner[p.champ] = '상대');
  const oppEls = teamEls(1);
  const sel = D.sel ? CH[D.sel] : null;
  let panel;
  if (sel){
    const p = patchOf(D.sel);
    let act = '';
    if (!av.has(D.sel)) act = `<p class="muted">이미 금지됐거나 선택된 마법입니다.</p>`;
    else if (mine && t.kind === 'ban'){
      const users = freeStudents(1).filter(st => tagsFor(st, D.sel).length);
      act = `<p style="font-size:.88rem">${users.length ? `상대 ${users.map(st => `${esc(st.name)}(${tagsFor(st, D.sel).join(', ')})`).join(', ')}에게 잘 맞는 마법입니다.` : '<span class="muted">상대 학생 중 이 마법이 특히 잘 맞는 학생은 없습니다.</span>'}</p>
        <button class="btn" data-a="banIt">${sel.n} 금지하기</button>`;
    } else if (mine){
      const list = freeStudents(0).sort((a,b) => fitScore(b, D.sel) - fitScore(a, D.sel));
      act = `<h3 style="margin-top:.9rem">누가 맡을까요?</h3><div class="who-list">${list.map(st => { const tg = tagsFor(st, D.sel); return `<button class="who-btn" data-a="pickWith" data-v="${st.id}">
          <span class="who-name">${esc(st.name)} <span class="muted" style="font-size:.85rem">${st.year}학년</span> ${elChip(st.elem)}</span>
          <span class="who-meta">${tg.map(x => `<span class="good">${x}</span>`).join(' ')}${condBar(st.cond)}${traitChips(st)}${gearOf(st) ? gearChip(gearOf(st).k) : ''}${moraleOf(st) < 35 ? `<span class="chem bad">사기 ${R(moraleOf(st))}</span>` : ''}${AWKK.filter(k => awkLv(st, k)).map(k => `<span class="awk">${AWK[k].n}</span>`).join('')}${D.picks[0].map(p => { const lv = chemOf(st.id, p.sid); return lv.v ? `<span class="chem ${lv.cls}">${esc(D.stById[p.sid].name)}와 ${lv.n}</span>` : ''; }).join('')}</span>
          <span class="who-pow num">${R(fitScore(st, D.sel))}</span></button>`; }).join('')}</div>
        <p class="muted" style="font-size:.8rem;margin-top:.4rem">오른쪽 숫자는 이 마법을 맡았을 때 예상 전투력입니다. 컨디션이 낮으면 떨어집니다.</p>`;
    }
    panel = `<div class="hdr"><span class="cg" style="background:${EL[sel.e].c};color:${EL[sel.e].fg || '#fff'}">${sel.g}</span><div><h3 style="margin:0">${sel.n}</h3>${elChip(sel.e)} <span class="muted">${sel.role}</span></div></div>
      <dl class="kv"><dt>체력</dt><dd class="num">${R(sel.hp*p.hp)}</dd><dt>공격력</dt><dd class="num">${R(sel.atk*p.atk)}</dd><dt>방어</dt><dd class="num">${sel.def}</dd><dt>공격 사거리</dt><dd class="num">${sel.range}</dd><dt>주문 사거리</dt><dd>${skillReachHtml(D.sel)}</dd></dl>
      <div class="skill"><b>${sel.sk}</b> <span class="muted num">${(sel.cd*p.cd).toFixed(1)}초</span><br>${sel.sd}</div>
      <p style="font-size:.88rem">${matchupText(sel.e)}</p>
      ${opinionHtml(D.sel, t)}${act}`;
  } else {
    panel = `<h3>마법을 눌러 보세요</h3>
      <p class="muted" style="font-size:.9rem">마법을 고를 때 맡을 학생도 함께 정합니다. 고른 셋이 그대로 출전 명단이 됩니다.</p>
      <h3 style="margin-top:.9rem">원소 조합</h3>
      <div class="syns">${ELK.map(e => `<div>${elChip(e)} 2개: ${SYN[e].n} <span class="muted">${SYN[e].d(2)}</span></div>`).join('')}
      <div><span class="el" style="color:var(--brass)">조화</span> 셋 다 다름: 삼원 조화 <span class="muted">주문 재사용 −12%</span></div></div>
      <h3 style="margin-top:.9rem">상대 성향</h3>${intelHtml(D.opp, true)}
      <h3 style="margin-top:.9rem">${esc(op.name)} 학생</h3>
      <div style="font-size:.86rem">${D.roster[1].map(id => D.stById[id]).map(st => `<div class="spread" style="gap:.4rem"><span>${esc(st.name)} ${elChip(st.elem)}</span><span class="muted">주력 ${st.fav.map(f => CH[f].n).join(', ')}</span></div>`).join('')}</div>`;
  }
  return `${trackHtml()}
    ${mapCardHtml(D.map, true)}
    <div class="draft-head">
      <div class="side"><div class="muted" style="font-size:.85rem">${esc(me().name)}</div>${[0,1,2].map(i => slotHtml(0,i)).join('')}
        ${synHtml(teamEls(0))}${chemTeamHtml(D.picks[0].map(p => p.sid))}
        <div class="bans">${D.bans[0].map(b => `<span class="banchip">${CH[b].n}</span>`).join('')}</div></div>
      <div class="turn panel">${banner}</div>
      <div class="side enemy"><div class="muted" style="font-size:.85rem;text-align:right">${esc(op.name)}${op.coach ? `, 코치 ${esc(op.coach.name)} (+4%)` : ''}</div>${[0,1,2].map(i => slotHtml(1,i)).join('')}
        ${synHtml(teamEls(1), true)}
        <div class="bans" style="justify-content:flex-end">${D.bans[1].map(b => `<span class="banchip">${CH[b].n}</span>`).join('')}</div></div>
    </div>
    ${mine ? adviceHtml(t) : ''}
    ${formationHtml()}
    <div class="draft-body">
      <div class="cgrid">${CHK.map(id => { const c = CH[id], gone = !av.has(id), banned = D.bans[0].includes(id) || D.bans[1].includes(id);
        const counters = oppEls.some(e => EL[c.e].beats === e);
        const syn = mine && t.kind === 'pick' && teamEls(0).includes(c.e);
        return `<button class="ccard ${gone ? 'gone' : ''} ${D.lastAi === id ? 'flash' : ''}" style="--c:${EL[c.e].c};--fg:${EL[c.e].fg || '#fff'}" data-a="selChamp" data-v="${id}" aria-pressed="${D.sel === id}">
          <span class="cg">${c.g}</span><span><span class="cn">${c.n}</span><br><span class="cr">${EL[c.e].n}, ${c.role}</span>
          ${!gone && (rec.includes(id) || banRec.includes(id) || counters || syn) ? `<br><span class="cr">${[rec.includes(id) ? '<span class="rec">추천</span>' : '', banRec.includes(id) ? '<span class="bad">금지 추천</span>' : '', counters ? '<span class="good">상성 우위</span>' : '', syn ? '<span class="good">조합</span>' : ''].filter(Boolean).join(' ')}</span>` : ''}</span>
          ${patchTag(id)}${gone ? `<span class="who">${banned ? '금지' : owner[id]}</span>` : ''}</button>`; }).join('')}</div>
      <aside class="panel detail">${panel}</aside>
    </div>`;
}

/* ---------- 밴픽 코치 조언 ---------- */
// team 입장에서 이 마법을 가져갈 때의 근거
function champReasons(team, id){
  const c = CH[id], out = [], they = team === 1, other = 1 - team;
  const pre = they ? '상대 ' : '';
  const free = freeStudents(team);
  const best = free.slice().sort((a,b) => fitScore(b, id) - fitScore(a, id))[0];
  if (best){
    const tg = tagsFor(best, id);
    if (tg.length) out.push({good:true, t:`${pre}${best.name}: ${tg.join(', ')}`});
    const tr = (best.traits || []).filter(k => ['prodigy','iron','focus','comeback','clutch','vanguard'].includes(k) && (k !== 'prodigy' || best.elem === c.e));
    if (tr.length) out.push({good:true, t:`${pre}${best.name}의 특성 ${tr.map(k => TRAITS[k].n).join(', ')}`});
  }
  const strong = D.picks[other].filter(p => EL[c.e].beats === CH[p.champ].e).map(p => CH[p.champ].n);
  if (strong.length) out.push({good:true, t:`${they ? '우리' : '상대'} ${strong.join(', ')}에게 상성 우위`});
  const weak = D.picks[other].filter(p => EL[CH[p.champ].e].beats === c.e).map(p => CH[p.champ].n);
  if (weak.length) out.push({good:false, t:`${they ? '우리' : '상대'} ${weak.join(', ')}에게 상성 열세`});
  const els = teamEls(team);
  if (els.includes(c.e)) out.push({good:true, t:`${pre}${SYN[c.e].n} 조합 완성`});
  else if (els.length === 2 && new Set([...els, c.e]).size === 3) out.push({good:true, t:`${pre}삼원 조화 완성`});
  const roles = D.picks[team].map(p => CH[p.champ].role);
  if (c.role === '수호' && !roles.includes('수호')) out.push({good:true, t:`${pre}앞에서 버틸 수호가 아직 없음`});
  if (c.role === '치유' && !roles.includes('치유') && roles.length) out.push({good:true, t:`${pre}치유 역할이 아직 없음`});
  if (roles.includes(c.role)) out.push({good:false, t:`${pre}${c.role} 역할이 겹침`});
  const ir = intelOf(D.opp);
  if (they && ir.games && ir.picks[id]) out.push({good:true, t:`상대가 자주 고르는 마법 (${ir.games}경기 중 ${ir.picks[id]}번)`});
  const pn = S.patchNotes.find(p => p.id === id);
  if (pn) out.push({good:pn.buff, t:`이번 시즌 ${pn.buff ? '상향' : '하향'} (${pn.text.replace(c.n + ' ', '')})`});
  return {best, reasons:out};
}
function advice(kind){
  const av = available();
  if (kind === 'ban'){
    return av.map(id => ({id, s:draftScore(1, id) + intelBanBonus(id)})).sort((a,b) => b.s - a.s).slice(0, 3)
      .map(x => ({...x, ...champReasons(1, x.id)}));
  }
  const threat = new Set(av.map(id => [id, draftScore(1, id)]).sort((a,b) => b[1] - a[1]).slice(0, 3).map(x => x[0]));
  return av.map(id => ({id, s:draftScore(0, id)})).sort((a,b) => b.s - a.s).slice(0, 3)
    .map(x => { const r = champReasons(0, x.id); if (threat.has(x.id)) r.reasons.push({good:true, t:'상대도 노리는 마법이라 먼저 가져오면 좋음'}); return {...x, ...r}; });
}
function reasonList(rs, max = 4){
  if (!rs.length) return '<li class="muted">기본 성능이 무난합니다</li>';
  return rs.slice(0, max).map(r => `<li class="${r.good ? 'good' : 'bad'}">${r.good ? '+' : '−'} ${esc(r.t)}</li>`).join('');
}
function adviceHtml(t){
  if (V.hideAdvice) return `<div class="adv-off"><button class="btn ghost small" data-a="toggleAdvice">코치 조언 보기</button></div>`;
  const kind = t.kind, list = advice(kind);
  return `<section class="panel advice">
    <div class="spread"><div><h3 style="margin:0">코치 조언: ${kind === 'ban' ? '금지 추천' : '선택 추천'}</h3>
      <p class="muted" style="font-size:.85rem">${kind === 'ban' ? '상대가 가져가면 가장 위험한 마법입니다.' : '지금 우리 학생과 조합에 가장 잘 맞는 마법입니다.'}</p></div>
      <button class="btn ghost small" data-a="toggleAdvice">숨기기</button></div>
    <ol class="adv-list">${list.map((a, i) => { const c = CH[a.id];
      return `<li class="adv">
        <div class="adv-head"><span class="adv-rank">${i + 1}</span><span class="cg" style="background:${EL[c.e].c};color:${EL[c.e].fg || '#fff'}">${c.g}</span><span><b>${c.n}</b><br><span class="muted" style="font-size:.8rem">${EL[c.e].n}, ${c.role}</span></span></div>
        <ul class="why">${reasonList(a.reasons)}</ul>
        <div class="row" style="gap:.4rem;margin-top:auto">
          ${kind === 'ban' ? `<button class="btn small" data-a="advBan" data-v="${a.id}">금지하기</button>`
            : `<button class="btn small" data-a="advPick" data-v="${a.id}:${a.best.id}">${esc(a.best.name)}에게 맡기기</button>`}
          <button class="btn ghost small" data-a="selChamp" data-v="${a.id}">자세히</button>
        </div></li>`; }).join('')}</ol>
  </section>`;
}
// 선택한 마법에 대한 코치 한마디
function opinionHtml(id, t){
  if (!t || t.team !== 0 || !available().includes(id)) return '';
  const kind = t.kind, r = champReasons(kind === 'ban' ? 1 : 0, id);
  const rank = advice(kind).findIndex(a => a.id === id);
  const head = kind === 'ban'
    ? (rank >= 0 ? `금지 추천 ${rank + 1}순위입니다.` : '상대에게 아주 위협적인 마법은 아닙니다.')
    : (rank >= 0 ? `선택 추천 ${rank + 1}순위입니다.` : '추천 3순위 밖입니다. 이유를 확인해 보세요.');
  return `<div class="opinion"><b>코치 의견</b> ${head}<ul class="why">${reasonList(r.reasons, 5)}</ul></div>`;
}
// 밴픽이 끝난 뒤 예상 승률(같은 조합으로 모의전 여러 번)
function predictDraft(){
  const my = me(), op = school(D.opp), n = 16;
  const team = (ti, sc) => D.picks[ti].map((p,i) => ({champ:p.champ, st:D.stById[p.sid], slot:ti === 0 ? formationOf()[i] : i, bonus: teamBonus(sc, true) + (ti === 0 ? chemBonus(p.sid, D.picks[0].map(q => q.sid)) : 0)}));
  let w = 0;
  for (let i = 0; i < n; i++){ const b = newBattle([team(0, my), team(1, op)], D.map); runHeadless(b); if (b.winner === 0) w++; }
  const pow = ti => D.picks[ti].reduce((s, p) => s + fitScore(D.stById[p.sid], p.champ), 0) / 3;
  const adv = ti => D.picks[ti].reduce((s, p) => s + D.picks[1-ti].filter(q => EL[CH[p.champ].e].beats === CH[q.champ].e).length, 0);
  D.pred = {n, w, autoTactic:true, pow:[pow(0), pow(1)], adv:[adv(0), adv(1)], syn:[synergies(teamEls(0)).length, synergies(teamEls(1)).length]};
}
function predHtml(){
  if (!D.pred) return `<p class="muted" style="margin-top:.4rem">모의전 전망 계산 중…</p>`;
  const p = D.pred, ratio = p.w/p.n, tone = ratio >= .6 ? 'good' : ratio <= .4 ? 'bad' : '';
  const word = ratio >= .6 ? '우세' : ratio <= .4 ? '열세' : '접전';
  return `<p style="margin-top:.4rem">모의전 전망 <b class="${tone}" style="font-size:1.3rem;font-weight:400">${word}</b> <span class="muted num" style="font-size:.85rem">${p.n}회 중 ${p.w}승</span></p>
    <p class="muted" style="font-size:.8rem;line-height:1.45">전투력 ${R(p.pow[0])} 대 ${R(p.pow[1])}, 상성 ${p.adv[0]} 대 ${p.adv[1]}, 조합 ${p.syn[0]} 대 ${p.syn[1]}</p>
    <p class="muted" style="font-size:.78rem;line-height:1.45">양 팀 자동 작전 기준 모의전이라 실제 결과와 다를 수 있습니다.</p>`;
}
