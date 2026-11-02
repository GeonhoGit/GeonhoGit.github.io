// 버튼·키보드 입력 처리와 시작
"use strict";

/* =========================================================
   입력
   ========================================================= */
const ACT = {
  startElem(v){ V.startElem = v; const n = document.getElementById('sname').value; render(); document.getElementById('sname').value = n; },
  newGame(){
    let hasSave = true;
    try { hasSave = localStorage.getItem(SAVE_KEY) !== null; } catch(e){ saveWarning(true); }
    if (hasSave && !V.confirmNew){
      // 브라우저 확인창 대신 화면 안에서 한 번 더 누르게 함 (웹 링크에서도 동작)
      V.confirmNew = true;
      const btn = document.querySelector('[data-a="newGame"]');
      if (btn) btn.textContent = '기존 저장을 덮어씁니다. 한 번 더 누르세요';
      setTimeout(() => { V.confirmNew = false; const b2 = document.querySelector('[data-a="newGame"]'); if (b2) b2.textContent = '새 학교 세우기'; }, 4000);
      return;
    }
    V.confirmNew = false;
    const n = (document.getElementById('sname').value || '').trim() || '은하수 마법학교'; newGame(n, V.startElem, V.startDiff || 'normal'); V.view = 'hub'; render();
  },
  continue(){ S = loadSave(); if (!S) return; migrate(S); applyExpansion(); unlockExpansion(); save(); V.view = S.phase === 'graduation' ? 'graduation' : 'hub'; render(); },
  reset(){ if (V.confirmReset){ if (!clearSave()) return; S = null; V = {view:'start', startElem:'water'}; render(); } else { V.confirmReset = true; const b = document.querySelector('[data-a="reset"]'); if (b){ b.textContent = '정말 새로? 한 번 더'; } setTimeout(() => V.confirmReset = false, 3000); } },
  go(v){ V.view = v; V.importErr = null; V.confirmImport = false; render(); window.scrollTo(0,0); },
  startImport(){ V.startImport = !V.startImport; V.importErr = null; render(); },
  importStart(){ const t = document.getElementById('importText'); loadBackup(t ? t.value : ''); },
  importSave(){ const t = document.getElementById('importText'); const v = t ? t.value : '';
    if (!V.confirmImport){ try { parseSave(v); } catch(e){ V.importErr = '저장 코드나 파일을 읽을 수 없습니다. 내보낸 내용을 빠짐없이 붙여 넣었는지 확인하세요.'; render(); return; }
      V.confirmImport = true; V.importErr = null; const keep = v; render(); const t2 = document.getElementById('importText'); if (t2) t2.value = keep; return; }
    V.confirmImport = false; loadBackup(v); },
  makeCode(){ V.saveCode = saveCode(); V.backupNote = null; render(); },
  copyCode(){ copyCode(); },
  downloadSave(){ downloadSave(); },
  startDiff(v){ if (!DIFF[v]) return; V.startDiff = v; const n = document.getElementById('sname').value; render(); document.getElementById('sname').value = n; },
  setDiff(v){ if (!DIFF[v] || S.phase !== 'graduation' || S.diff === v) return; S.diff = v; addNews(`다음 시즌부터 난이도를 ${DIFF[v].n}(으)로 바꿨습니다.`); save(); render(); },
  recruitTab(v){ V.recruitTab = v === 'market' ? 'market' : 'new'; render(); },
  buyTransfer(id){ if (S.phase !== 'graduation') return; buyTransfer(id); save(); render(); },
  sellStudent(id, b){
    if (S.phase !== 'graduation') return;
    if (V.confirmSell !== id){ V.confirmSell = id; if (b) b.textContent = '한 번 더 누르면 보냅니다'; setTimeout(() => { if (V.confirmSell === id) V.confirmSell = null; }, 3500); return; }
    V.confirmSell = null; sellStudent(id); save(); render();
  },
  renew(id){ if (S.phase !== 'graduation') return; renewContract(id); save(); render(); },
  release(id){ const st = findSt(me(), id); if (!st || !st.contract || !st.contract.expiring) return; releaseStudent(st); save(); render(); },
  buyGear(k){ const sh = shopState(), g = GEAR[k]; if (!g || !sh.offers.includes(k) || S.gold < g.cost || (S.items || []).length >= ITEM_MAX) return; S.gold -= g.cost; addItem(k); sh.offers = sh.offers.filter(x => x !== k); addNews(`마법 도구 ${g.n}을(를) 샀습니다.`); sfx('pick'); save(); render(); },
  sellGear(id){ const it = (S.items || []).find(x => x.id === id); if (!it) return; me().students.forEach(st => { if (st.gear === id) st.gear = null; }); S.items = S.items.filter(x => x !== it); S.gold += R(GEAR[it.k].cost/2); addNews(`${GEAR[it.k].n}을(를) 팔았습니다.`); save(); render(); },
  startDraft(){ startDraft(); },
  sound(){ setSound(!soundOn()); render(); sfx('pick'); },
  music(){ setMusic(!musicOn()); render(); },
  tipOk(k){ S.tips = S.tips || {}; S.tips[k] = true; save(); render(); },
  tipsOff(){ S.tips = S.tips || {}; S.tips._off = true; save(); render(); },
  tipsReset(){ S.tips = {}; save(); render(); },
  helpJump(id){
    const box = document.getElementById('helpSearch'); if (box && box.value){ box.value = ''; filterHelp(''); }
    const el = document.getElementById('help-' + id); if (el && el.scrollIntoView) el.scrollIntoView({behavior: RM ? 'auto' : 'smooth', block:'start'});
  },
  camp(){ const cost = campCost(); if (S.campSeason === S.season || !canInvest() || S.gold < cost) return; S.gold -= cost; S.campSeason = S.season;
    me().students.forEach(st => { st.cond = 100; const p = planOf(st), k = p && p !== 'rest' ? p : ['atk','def','int'].sort((a,b) => st[a] - st[b])[0]; st[k] = clamp(st[k] + 1.2, 10, STAT_MAX); });
    addNews('전지훈련으로 학생 전원이 컨디션을 회복하고 한 단계 성장했습니다.'); save(); render(); },
  hireCoach(i){ const h = coachCandidates()[+i]; if (!h || coachActive() || !canInvest() || S.gold < COACH_COST) return; S.gold -= COACH_COST; S.myCoach = {name:h.name, season:S.season}; addNews(`졸업생 ${h.name}이(가) 이번 시즌 코치로 돌아왔습니다.`); unlockAch('mentor'); save(); render(); },
  scholar(id){ const st = findSt(me(), id); if (!st || st.pot >= 5 || st.year >= 4 || st.scholar === S.season || !canInvest() || S.gold < scholarCost(st)) return; S.gold -= scholarCost(st); st.pot++; st.scholar = S.season; addNews(`${st.name}에게 장학금을 줘서 잠재력이 ${st.pot}이 됐습니다.`); S.scholarCount = (S.scholarCount || 0) + 1; if (S.scholarCount >= 3) unlockAch('patron'); save(); render(); },
  eventChoose(k){ chooseEvent(k); render(); },
  tactic(k){ if (B && V.view === 'battle' && !B.autoTac[0] && useTactic(B, 0, k)){ tacticState(); hud(); } },
  pause(){ if (!B || B.over || V.view !== 'battle') return; B.paused = !B.paused; lastFrame = null; accumulator = 0; battleControlState(); tacticState(); },
  autoTactic(){ if (!B || B.over || V.view !== 'battle') return; B.autoTac[0] = !B.autoTac[0]; S.autoTacticPref = B.autoTac[0]; save(); battleControlState(); tacticState(); refreshTutorial(); },
  dismissTutorial(){ if (S && S.tutorial){ S.tutorial.dismissed = true; save(); refreshTutorial(); } },
  advBan(id){ const t = curTurn(); if (t && t.team === 0 && t.kind === 'ban') doDraft(0, id, null); },
  advPick(v){ const [id, sid] = v.split(':'); const t = curTurn(); if (t && t.team === 0 && t.kind === 'pick') doDraft(0, id, sid); },
  toggleAdvice(){ V.hideAdvice = !V.hideAdvice; render(); },
  swapFormation(v){
    if (!D || V.view !== 'draft' || curTurn()) return;
    const ids = v.split(':').map(Number), [a,b] = ids;
    if (ids.length !== 2 || ![a,b].every(i => Number.isInteger(i) && i >= 0 && i < 3) || a === b) return;
    D.formation = [...formationOf()]; [D.formation[a],D.formation[b]] = [D.formation[b],D.formation[a]];
    D.pred = null; render(); schedulePrediction();
  },
  upgrade(k){ const lv = facLevel(k), cost = FAC_COST[lv]; if (lv >= FAC_MAX || S.gold < cost) return; S.gold -= cost; S.fac[k] = lv + 1; gsOf().fac++; addNews(`${FAC[k].n}을(를) ${lv+1}단계로 올렸습니다.`); if (S.fac[k] >= FAC_MAX) unlockAch('facMax'); save(); render(); },
  setTrain(v){ const [id, k] = v.split(':'); if (!findSt(me(), id)) return; V.trainDraft = V.trainDraft || {}; V.trainDraft[id] = k; render(); },
  restTired(){ V.trainDraft = V.trainDraft || {}; me().students.forEach(st => { if (st.cond < 60) V.trainDraft[st.id] = 'rest'; }); render(); },
  trainWeak(){ V.trainDraft = V.trainDraft || {}; me().students.forEach(st => { V.trainDraft[st.id] = ['atk','def','int'].sort((a,b) => st[a] - st[b])[0]; }); render(); },
  trainReset(){ V.trainDraft = {}; render(); },
  trainConfirm(){ me().students.forEach(st => { st.train = planOf(st); }); V.trainDraft = {}; S.trainSet = true; markTutorial('train'); save(); render(); },
  selChamp(id){ D.sel = id; render(); if (window.innerWidth < 860){ const d = document.querySelector('.detail'); if (d) d.scrollIntoView({behavior: RM ? 'auto' : 'smooth', block:'start'}); } },
  banIt(){ const t = curTurn(); if (t && t.team === 0 && t.kind === 'ban' && D.sel) doDraft(0, D.sel, null); },
  pickWith(sid){ const t = curTurn(); if (t && t.team === 0 && t.kind === 'pick' && D.sel) doDraft(0, D.sel, sid); },
  startBattle(){ startBattle(); },
  speed(v){ if (!SPEEDS.includes(+v)) return; speed = +v; S.speedPref = speed; save(); document.querySelectorAll('.speed button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === String(v))); },
  skip(){ stopLoop(); B.autoTac[0] = true; runHeadless(B); B.headless = false; draw(); hud(); toResult(); },
  toResult(){ toResult(); },
  afterResult(){ V.view = 'hub'; render(); window.scrollTo(0,0); },
  doGraduation(){ endSeason(); V.view = 'graduation'; render(); },
  recruit(id){ const p = S.prospects.find(x => x.id === id); if (!p || S.gold < p.cost || me().students.length >= ROSTER_MAX) return; S.gold -= p.cost; delete p.cost; S.prospects = S.prospects.filter(x => x !== p); joinTeam(p); save(); render(); },
  compareRecruit(id){ if (!(S.prospects || []).some(p => p.id === id)) return; V.compareRecruit = id; renderRecruitComparison(); },
  compareStudent(id){ if (!findSt(me(), id)) return; V.compareStudent = id; renderRecruitComparison(); },
  freeRecruit(){ joinTeam(genStudent(1, me().elem, 34)); save(); render(); },
  nextSeason(){ if (me().students.length - expiring().length < 3) return; expiring().forEach(releaseStudent); startNextSeason(); V.view = 'hub'; render(); window.scrollTo(0,0); },
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const f = ACT[b.dataset.a]; if (f) f(b.dataset.v, b);
});
document.addEventListener('pointerdown', () => { if (musicOn()) musicStart(); });
document.addEventListener('keydown', () => { if (musicOn()) musicStart(); });
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'importFile'){ const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => { const t = document.getElementById('importText'); if (t) t.value = String(rd.result || ''); }; rd.readAsText(f); return; }
  const g = e.target.closest('[data-gear]');
  if (g){ const st = findSt(me(), g.dataset.gear); if (st){ const v = g.value || null; if (v) me().students.forEach(o => { if (o.gear === v) o.gear = null; }); st.gear = v; save(); render(); } return; }
});
document.addEventListener('keydown', e => {
  if (V.view !== 'battle' || e.ctrlKey || e.metaKey || e.altKey) return;
  const i = ['1','2','3','4','5'].indexOf(e.key);
  if (i >= 0) ACT.speed(String(SPEEDS[i]));
  const k = TACK.find(x => TACTICS[x].key === e.key.toUpperCase());
  if (k) ACT.tactic(k);
});
window.addEventListener('resize', () => { if (V.view === 'battle' && B && !B.over && narrow() !== !!B.portrait) render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) lastFrame = null; });
window.addEventListener('beforeunload', e => {
  if (saveFailed || V.view === 'draft' || V.view === 'battle') { e.preventDefault(); e.returnValue = ''; }
});

// 시작
(function init(){
  loadSave();  // 저장을 읽을 수 없으면 여기서 경고가 뜸
  render();
})();
