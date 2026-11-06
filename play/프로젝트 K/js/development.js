// ===== 도시 특화 · 시설 개선 · 도전 도시 =====
Object.assign(DEFS, {
  hotel: { name:'호텔', icon:'🏨', cost:4500, upkeep:80, size:2, cat:'special', specialization:'tourism', unlock:600, powerUse:35, waterUse:30, comJobs:40, monthlyIncome:220, serviceKey:'park', radius:7, desc:'관광객을 맞아 월 ₩220 수입과 일자리 40개를 만듭니다. 도로·전기·물이 필요합니다.' },
  observation: { name:'전망대', icon:'🗼', cost:6500, upkeep:60, size:2, cat:'special', specialization:'tourism', unlock:1500, powerUse:25, waterUse:15, comJobs:25, monthlyIncome:180, serviceKey:'stadium', radius:10, desc:'관광 명소로 월 ₩180 수입과 일자리 25개, 주변 행복 혜택을 제공합니다. 도로·전기·물이 필요합니다.' },
  university: { name:'대학', icon:'🎓', cost:8500, upkeep:160, size:3, cat:'special', specialization:'education', unlock:3000, powerUse:70, waterUse:50, comJobs:100, monthlyIncome:260, serviceKey:'school', radius:20, desc:'넓은 교육 혜택과 일자리 100개, 월 ₩260 수입을 제공합니다. 도로·전기·물이 필요합니다.' },
  research: { name:'연구소', icon:'🔬', cost:12000, upkeep:220, size:2, cat:'special', specialization:'education', unlock:8000, powerUse:100, waterUse:60, comJobs:180, monthlyIncome:480, serviceKey:'school', radius:16, desc:'연구 일자리 180개와 교육 혜택, 월 ₩480 수입을 제공합니다. 도로·전기·물이 필요합니다.' },
  logistics: { name:'물류센터', icon:'📦', cost:9000, upkeep:180, size:3, cat:'special', specialization:'industry', unlock:5000, powerUse:70, waterUse:35, indJobs:220, monthlyIncome:400, pollution:15, desc:'일자리 220개와 월 ₩400 수입을 만듭니다. 소량의 오염을 배출하며 도로·전기·물이 필요합니다.' },
  advancedFactory: { name:'첨단공장', icon:'⚙️', cost:16000, upkeep:300, size:3, cat:'special', specialization:'industry', unlock:12000, powerUse:140, waterUse:90, indJobs:380, monthlyIncome:700, pollution:22, desc:'산업 일자리 380개와 월 ₩700 수입을 만듭니다. 도로·전기·물이 필요합니다.' },
});

const DEVELOPMENT = {
  specializations: [
    { id:'tourism', name:'관광 도시', description:'행복도 +6 · 도시 수입 +8% · 상업 수요 +0.1.' },
    { id:'education', name:'교육 도시', description:'행복도 +4 · 주거 수요 +0.12 · 상업 수요 +0.08.' },
    { id:'industry', name:'산업 도시', description:'도시 수입 +12% · 공업 수요 +0.15 · 행복도 −2.' },
  ],
  scenarios: [
    { id:'recovery', name:'적자 도시 재건', limit:36, description:'36개월 안에 인구 1,200명, 순자산 ₩5,000, 월 흑자 ₩100을 달성하세요. 순자산 = 자금 − 남은 채권.', startingConditions:'인구 720명 · 자금 ₩900 · 과잉 공공시설로 매달 적자. 불필요한 시설을 줄이고 세율을 조절하세요.' },
    { id:'island', name:'섬 도시', limit:48, description:'48개월 안에 인구 1,500명과 순자산 ₩3,000을 달성하세요. 순자산 = 자금 − 남은 채권.', startingConditions:'자금 ₩20,000 · 바다로 둘러싸인 약 1,240칸의 섬. 한정된 땅에 도로와 구역을 계획하세요.' },
    { id:'pollution', name:'오염 도시 복구', limit:24, description:'24개월 안에 인구 720명을 유지하며 주거 평균 오염 18 이하, 행복도 60을 달성하세요.', startingConditions:'인구 720명 · 자금 ₩10,000 · 주거지 옆 화력발전소와 공업지대. 시설 개선과 공원, 이전으로 환경을 회복하세요.' },
  ],

  normalize(raw) {
    if (raw == null) return { version:1, specialization:null, changedMonth:null, scenario:null };
    const fail = () => { throw new Error('도시 개발 저장 데이터가 올바르지 않습니다.'); };
    if (typeof raw !== 'object' || Array.isArray(raw) || (raw.version !== undefined && raw.version !== 1)) fail();
    const specialization = raw.specialization === undefined ? null : raw.specialization;
    if (specialization !== null && !this.specializations.some(s => s.id === specialization)) fail();
    const changedMonth = raw.changedMonth === undefined ? null : raw.changedMonth;
    if (changedMonth !== null && (!Number.isSafeInteger(changedMonth) || changedMonth < 0)) fail();
    let scenario = null;
    if (raw.scenario != null) {
      const s = raw.scenario;
      if (typeof s !== 'object' || Array.isArray(s) || !this.scenarios.some(d => d.id === s.id)
        || !Number.isSafeInteger(s.months) || s.months < 0
        || !['active','success','failed'].includes(s.status)) fail();
      scenario = { id:s.id, months:s.months, status:s.status };
    }
    return { version:1, specialization, changedMonth, scenario };
  },

  definition(t, i) {
    const base = t && DEFS[t.type];
    if (!base) return base;
    const d = { ...base };
    const root = t.root >= 0 && S ? S.tiles[t.root] : t;
    const level = Math.max(0, Math.min(2, root.upgrade || 0));
    if (!level || base.zone || base.cat === 'tool' || t.type === 'road') return d;
    d.upkeep = Math.round(base.upkeep * (1 + level * 0.3) * 10) / 10;
    for (const key of ['powerCap','waterCap']) if (base[key]) d[key] = Math.round(base[key] * (1 + level * 0.5));
    if (base.radius) d.radius = base.radius + level * 2;
    if (base.pollution) d.pollution = base.pollution * (1 - level * 0.25);
    for (const key of ['comJobs','indJobs','monthlyIncome']) if (base[key]) d[key] = Math.round(base[key] * (1 + level * 0.25));
    for (const key of ['powerUse','waterUse']) if (base[key]) d[key] = Math.round(base[key] * (1 + level * 0.15));
    return d;
  },

  canUnlock(key) {
    const d = DEFS[key];
    if (!d || !S) return false;
    // 특화는 도시 보너스만 결정하며, 시설은 인구·해금 기록·허가로 개방한다.
    return !d.unlock || S.stats.pop >= d.unlock || S.unlockedSeen[key] === true || S.civic?.permits?.includes(key) === true;
  },
  lockReason(key) {
    const d = DEFS[key];
    if (!d) return '알 수 없는 시설';
    if (!S) return '먼저 도시를 시작하세요';
    return this.canUnlock(key) ? '' : `인구 ${d.unlock.toLocaleString('ko-KR')}명 필요`;
  },
  specializationOption(id) {
    const selected = S?.development?.specialization === id;
    const cost = S?.development?.specialization ? 5000 : 0;
    const elapsed = S ? S.year * 12 + S.month - 1 - (S.development?.changedMonth ?? -100) : 0;
    let reason = '';
    if (!S) reason = '먼저 도시를 시작하세요';
    else if (!selected && S.development?.specialization && elapsed < 6) reason = `${6 - elapsed}개월 뒤 변경 가능`;
    else if (!selected && cost > 0 && S.money < cost) reason = `변경 비용 ₩${cost.toLocaleString('ko-KR')} 필요`;
    return { selected, cost:selected ? 0 : cost, available:!reason, reason };
  },
  chooseSpecialization(id) {
    if (!this.specializations.some(s => s.id === id)) return { ok:false, reason:'알 수 없는 특화' };
    const option = this.specializationOption(id);
    if (!option.available) return { ok:false, reason:option.reason };
    if (option.selected) return { ok:true };
    S.development ||= this.normalize();
    S.money -= option.cost;
    S.development.specialization = id;
    S.development.changedMonth = S.year * 12 + S.month - 1;
    recomputeAll();
    return { ok:true };
  },
  modifiers() {
    const result = { happiness:0, income:1, resDemand:0, comDemand:0, indDemand:0 };
    const id = S?.development?.specialization;
    if (id === 'tourism') Object.assign(result, { happiness:6, income:1.08, comDemand:0.1 });
    if (id === 'education') Object.assign(result, { happiness:4, resDemand:0.12, comDemand:0.08 });
    if (id === 'industry') Object.assign(result, { happiness:-2, income:1.12, indDemand:0.15 });
    return result;
  },

  upgradeInfo(i) {
    if (!S || !Number.isInteger(i) || i < 0 || i >= S.tiles.length) return null;
    const root = rootOf(i), t = S.tiles[root], d = DEFS[t.type];
    if (!d || d.zone || d.cat === 'tool' || t.type === 'road' || d.noUpgrade) return null;
    const level = t.upgrade || 0;
    // 수익 시설은 단계마다 기본 수입의 25%만 늘어나므로 증설 투자도 그에 맞춘다.
    const costRatio = d.monthlyIncome ? 0.2 + level * 0.05 : 0.6 + level * 0.4;
    const cost = Math.round(d.cost * costRatio);
    const current = this.definition(t, root);
    const effects = [];
    if (d.powerCap) effects.push(`전력 용량 +${Math.round(d.powerCap * 0.5)}`);
    if (d.waterCap) effects.push(`수도 용량 +${Math.round(d.waterCap * 0.5)}`);
    if (d.radius) effects.push('서비스 반경 +2칸');
    if (d.pollution) effects.push(`오염 −${d.pollution * 0.25}`);
    if (d.monthlyIncome) effects.push('기본 수입·일자리의 25% 추가');
    const modifiers = typeof simulationModifiers === 'function' ? simulationModifiers() : { powerUse:1, waterUse:1 };
    const consumption = value => value.toLocaleString('ko-KR', { maximumFractionDigits:2 });
    for (const [key, label] of [['powerUse','전력 소비'],['waterUse','수도 소비']]) {
      if (d[key]) {
        const next = Math.round(d[key] * (1 + (level + 1) * 0.15));
        effects.push(`${label} ${consumption(current[key] * modifiers[key])} → ${consumption(next * modifiers[key])}`);
      }
    }
    effects.push(`월 유지비 ₩${current.upkeep.toLocaleString('ko-KR')} → ₩${(Math.round(d.upkeep * (1 + (level + 1) * 0.3) * 10) / 10).toLocaleString('ko-KR')}`);
    let reason = '';
    if (level >= 2) reason = '최고 단계입니다';
    else if (S.tiles.some(tile => tile.root === root && tile.fire > 0)) reason = '화재를 진압한 뒤 개선할 수 있어요';
    else if (S.money < cost) reason = '개선 비용이 부족합니다';
    return { root, name:d.name, level, maxLevel:2, cost, available:!reason, reason, effects, effectText:effects.join(' · ') };
  },
  upgrade(i) {
    const info = this.upgradeInfo(i);
    if (!info) return { ok:false, reason:'개선할 공공·기반·발전 시설을 선택하세요' };
    if (!info.available) {
      if (info.reason === '개선 비용이 부족합니다' && typeof SOUND !== 'undefined') SOUND.play('funds');
      return { ok:false, reason:info.reason };
    }
    const undoBefore = typeof UNDO !== 'undefined' ? UNDO.begin() : null;
    S.money -= info.cost;
    S.tiles[info.root].upgrade = info.level + 1;
    S.netDirty = true;
    recomputeAll();
    if (typeof UNDO !== 'undefined') UNDO.commit(undoBefore, '시설 증설');
    if (typeof SOUND !== 'undefined') SOUND.play('build');
    return { ok:true, cost:info.cost };
  },

  initScenario(id) {
    if (id == null || id === '' || id === 'free') return;
    if (!this.scenarios.some(s => s.id === id)) throw new Error('알 수 없는 도전 도시입니다.');
    if (typeof UNDO !== 'undefined') UNDO.clear();
    S.development ||= this.normalize();
    S.development.scenario = { id, months:0, status:'active' };
    S.tiles = Array.from({ length:MAP_W * MAP_H }, (_, i) => {
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      const water = id === 'island' && ((x - 40) / 22) ** 2 + ((y - 40) / 18) ** 2 > 1;
      return newTile(water ? TERRAIN.WATER : TERRAIN.GRASS);
    });
    // 지형이 바뀌므로 물가·서비스 파생 배열도 새 지형에 맞춥니다.
    initDerived();
    if (id === 'island') { S.money = 20000; return; }
    S.money = 1000000;
    const put = (key, x, y) => {
      if (DEFS[key].unlock) S.unlockedSeen[key] = true;
      const result = placeAt(key, x, y);
      if (!result.ok) throw new Error(`도전 도시 배치 실패: ${key} (${x}, ${y}) ${result.reason}`);
    };
    for (let x = 26; x <= 54; x++) put('road', x, 40);
    for (let y = 30; y <= 50; y++) if (y !== 40) put('road', 40, y);
    put('power', id === 'pollution' ? 38 : 28, id === 'pollution' ? 38 : 41);
    put('watertower', 30, 41);
    for (const y of [38,39,41,42]) for (let x = 32; x <= 37; x++) { put('res', x, y); S.tiles[idx(x,y)].level = 2; }
    for (const y of [38,39]) for (let x = 41; x <= 44; x++) { put('com', x, y); S.tiles[idx(x,y)].level = 2; }
    for (const y of [41,42]) for (let x = 43; x <= 48; x++) { put('ind', x, y); S.tiles[idx(x,y)].level = 2; }
    put('fire', 39, 41); put('police', 39, 42);
    if (id === 'recovery') {
      for (const x of [26,30,34]) put('stadium', x, 32);
      for (const x of [26,29,32]) put('hospital', x, 46);
      put('school', 35, 46);
      S.money = 900;
    } else {
      for (let x = 32; x <= 37; x++) { put('ind', x, 37); S.tiles[idx(x,37)].level = 3; }
      S.money = 10000;
    }
    recomputeAll();
    S.milestone = MILESTONES.filter(m => S.stats.pop >= m.pop).length;
    const incRes = S.stats.pop * S.taxes.res / 100 * TAX_BASE.res;
    const incCom = S.stats.employedCom * S.taxes.com / 100 * TAX_BASE.com;
    const incInd = S.stats.employedInd * S.taxes.ind / 100 * TAX_BASE.ind;
    const exp = {};
    S.tiles.forEach((t, i) => {
      if (t.type === 'road' || t.root === i) exp[t.type] = (exp[t.type] || 0) + this.definition(t, i).upkeep;
    });
    exp.admin = adminCost(S.stats.pop);
    if (typeof operatingCosts === 'function') { const ops = operatingCosts(); exp.fuel = ops.fuel; exp.waterOps = ops.water; exp.wasteOps = ops.waste; exp.services = ops.services; }
    const income = incRes + incCom + incInd, expense = Object.values(exp).reduce((a,b) => a+b, 0);
    S.budget = { incRes, incCom, incInd, exp, income, expense };
    S.stats.income = income; S.stats.expense = expense;
  },

  scenarioView() {
    const state = S?.development?.scenario;
    if (!state) return null;
    const definition = this.scenarios.find(s => s.id === state.id);
    const goal = (id, label, current, target, below = false) => ({ id, label, current, target, complete:below ? current <= target : current >= target });
    let goals;
    const netAssets = typeof FINANCE !== 'undefined' ? FINANCE.netAssets() : S.money;
    if (state.id === 'recovery') goals = [goal('population','인구',S.stats.pop,1200), goal('money','도시 순자산',Math.floor(netAssets),5000), goal('surplus','월 수지',Math.floor((S.budget?.income || 0) - (S.budget?.expense || 0)),100)];
    else if (state.id === 'island') goals = [goal('population','인구',S.stats.pop,1500), goal('money','도시 순자산',Math.floor(netAssets),3000)];
    else {
      const homes = S.tiles.filter(t => t.type === 'res' && t.level > 0);
      const pollution = homes.length ? homes.reduce((sum,t) => sum+t.poll,0) / homes.length : 100;
      goals = [goal('population','인구',S.stats.pop,720), goal('pollution','주거 평균 오염 (이하)',Math.round(pollution * 10) / 10,18,true), goal('happiness','행복도',Math.floor(S.stats.happiness),60)];
    }
    return { ...definition, ...state, goals };
  },
  onMonth() {
    const state = S?.development?.scenario;
    if (!state || state.status !== 'active') return;
    state.months++;
    const view = this.scenarioView();
    if (view.goals.every(g => g.complete)) state.status = 'success';
    else if (state.months >= view.limit) state.status = 'failed';
    if (state.status !== 'active') notify(state.status === 'success' ? '🏆 도전 도시 목표 달성! 계속 도시를 키워 보세요.' : '도전 기간이 끝났어요. 이 도시는 계속 운영할 수 있습니다.', state.status === 'success' ? 'good' : 'warn');
  },
  view() {
    const selected = typeof R !== 'undefined' && R.selected;
    return {
      specialization:S?.development?.specialization || null,
      specializations:this.specializations.map(s => ({ ...s, ...this.specializationOption(s.id) })),
      facilities:Object.entries(DEFS).filter(([,d]) => d.specialization).map(([key,d]) => ({ key, name:d.name, specialization:d.specialization, unlock:d.unlock, unlocked:this.canUnlock(key), reason:this.lockReason(key) })),
      scenarios:this.scenarios.map(s => ({ ...s })), scenario:this.scenarioView(),
      upgrade:selected && inMap(selected.x, selected.y) ? this.upgradeInfo(idx(selected.x,selected.y)) : null,
    };
  },
};
