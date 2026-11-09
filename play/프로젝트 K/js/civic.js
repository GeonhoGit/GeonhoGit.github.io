// ===== 시민 의뢰 · 도시 정책 · 기간 제안 =====
const CIVIC = {
  quests: [
    { id: 'first_neighbors', title: '첫 이웃들', description: '인구 100명을 모으세요.', target: 100, unit: '명', reward: 1000, population: true },
    { id: 'working_city', title: '일하는 도시', description: '인구 200명 이상, 실업률 12% 이하를 3개월 연속 유지하세요.', target: 3, unit: '개월', reward: 1200,
      check: st => st.pop >= 200 && st.unemployment <= 0.12 },
    { id: 'balanced_budget', title: '안정적인 살림', description: '인구 300명 이상에서 월 수지 0 이상을 3개월 연속 유지하세요.', target: 3, unit: '개월', reward: 1500,
      check: st => st.pop >= 300 && S.budget && S.budget.income >= S.budget.expense },
    { id: 'reliable_utilities', title: '끊김 없는 생활', description: '인구 400명 이상, 주민 95% 이상에게 전기와 물을 3개월 연속 공급하세요.', target: 3, unit: '개월', reward: 2000,
      check: (st, m) => st.pop >= 400 && m.powered >= 0.95 && m.watered >= 0.95 },
    { id: 'happy_neighborhoods', title: '살기 좋은 동네', description: '인구 600명 이상, 행복도 60% 이상을 3개월 연속 유지하세요.', target: 3, unit: '개월', reward: 2500,
      check: st => st.pop >= 600 && st.happiness >= 60 },
    { id: 'clean_neighborhoods', title: '맑은 주거지', description: '인구 800명 이상, 주민 가중 평균 오염 20 이하를 3개월 연속 유지하세요.', target: 3, unit: '개월', reward: 3000,
      check: (st, m) => st.pop >= 800 && m.pollution <= 20 },
    { id: 'welcoming_city', title: '다시 찾고 싶은 도시', description: '인구 400명·행복도 65% 이상, 주민 절반 이상 공원 혜택을 3개월 연속 달성하세요.', target: 3, unit: '개월', reward: 3500,
      permit: 'hotel', permitText: '호텔 조기 건설 허가',
      check: (st, m) => st.pop >= 400 && st.happiness >= 65 && m.park >= 0.5 },
    { id: 'learning_city', title: '배움이 이어지는 도시', description: '인구 4,000명·행복도 60% 이상, 주민 65% 이상 교육 혜택을 6개월 연속 달성하세요.', target: 6, unit: '개월', reward: 6000,
      permit: 'research', permitText: '연구소 조기 건설 허가',
      check: (st, m) => st.pop >= 4000 && st.happiness >= 60 && m.school >= 0.65 },
  ],

  policies: [
    { id: 'housing_grants', title: '주거 정착 지원', description: '새 주민의 정착을 꾸준히 지원합니다.', unlock: 100, activationCost: 60, monthlyCost: 25,
      effectText: '행복도 +2 · 주거 수요 +0.12', effects: { happiness: 2, resDemand: 0.12 } },
    { id: 'clean_industry', title: '친환경 산업 기준', description: '배출 기준을 강화하고 시설 개선을 지원합니다.', unlock: 300, activationCost: 80, monthlyCost: 35,
      effectText: '오염 발생 −20% · 세입 −4%', effects: { pollution: 0.8, income: 0.96 } },
    { id: 'learning_support', title: '교육 운영 지원', description: '학교의 교육 서비스를 강화합니다.', unlock: 500, activationCost: 120, monthlyCost: 45,
      effectText: '교육 서비스 +20% · 행복도 +2', effects: { school: 1.2, happiness: 2 } },
    { id: 'fire_prevention', title: '화재 예방 강화', description: '소방 시설의 점검과 대응 훈련을 지원합니다.', unlock: 300, activationCost: 100, monthlyCost: 30,
      effectText: '소방 서비스 +25%', effects: { fire: 1.25 } },
  ],

  events: [
    { id: 'festival', title: '지역 축제 제안', description: '주민과 상인이 함께할 행사를 골라 보세요. 응답하지 않아도 불이익은 없습니다.', choices: [
      { id: 'street_festival', title: '거리 축제', description: '조명과 공연으로 도시를 활기차게 만듭니다.', cost: 300, monthlyCost: 0, duration: 3,
        effectText: '행복도 +5 · 상업 수요 +0.15 · 전력 소비 +5%', effects: { happiness: 5, comDemand: 0.15, powerUse: 1.05 } },
      { id: 'local_market', title: '주민 장터', description: '규모를 줄여 지역 상점의 매출을 돕습니다.', cost: 150, monthlyCost: 0, duration: 3,
        effectText: '행복도 +2 · 상업 수요 +0.08 · 세입 +4%', effects: { happiness: 2, comDemand: 0.08, income: 1.04 } },
    ] },
    { id: 'factory_order', title: '제조업 수주 제안', description: '새 주문을 받을 생산 방식을 정하세요. 제안을 건너뛰어도 됩니다.', choices: [
      { id: 'expand_production', title: '생산 확대', description: '더 많은 주문을 받는 대신 환경 부담도 늘어납니다.', cost: 220, monthlyCost: 0, duration: 3,
        effectText: '공업 수요 +0.18 · 세입 +8% · 오염 +15% · 전력 소비 +10%', effects: { indDemand: 0.18, income: 1.08, pollution: 1.15, powerUse: 1.1 } },
      { id: 'quality_contract', title: '소규모 고품질 계약', description: '설비 부담을 줄이고 안정적인 주문을 받습니다.', cost: 120, monthlyCost: 0, duration: 3,
        effectText: '공업 수요 +0.08 · 세입 +4% · 전력 소비 +3%', effects: { indDemand: 0.08, income: 1.04, powerUse: 1.03 } },
    ] },
    { id: 'education_exchange', title: '교육 교류 제안', description: '외부 강사와 지역 기술인의 도움을 받을 수 있습니다.', choices: [
      { id: 'host_classes', title: '교류 수업 개최', description: '학교의 교육 프로그램을 3개월 확장합니다.', cost: 240, monthlyCost: 20, duration: 3,
        effectText: '교육 서비스 +30% · 행복도 +3', effects: { school: 1.3, happiness: 3 } },
      { id: 'skills_training', title: '기술인 특강', description: '적은 비용으로 교육과 지역 산업을 돕습니다.', cost: 100, monthlyCost: 10, duration: 3,
        effectText: '교육 서비스 +15% · 공업 수요 +0.05', effects: { school: 1.15, indDemand: 0.05 } },
    ] },
    { id: 'green_campaign', title: '녹색도시 캠페인', description: '기간을 정해 오염 저감 활동을 펼쳐 보세요.', choices: [
      { id: 'green_week', title: '도시 공동 실천', description: '생산 활동 일부를 조정하고 환경 개선에 집중합니다.', cost: 180, monthlyCost: 0, duration: 3,
        effectText: '오염 발생 −20% · 행복도 +3 · 세입 −2%', effects: { pollution: 0.8, happiness: 3, income: 0.98 } },
      { id: 'cleanup_campaign', title: '생활 환경 정비', description: '짧은 기간 주민 참여 활동을 지원합니다.', cost: 100, monthlyCost: 0, duration: 2,
        effectText: '오염 발생 −10% · 행복도 +1', effects: { pollution: 0.9, happiness: 1 } },
    ] },
    { id: 'safety_drill', title: '안전 점검 지원', description: '소방 시설의 훈련과 예방 활동을 지원할 기회입니다.', choices: [
      { id: 'city_drill', title: '도시 합동 훈련', description: '집중 훈련 동안 일부 영업 시간이 줄어듭니다.', cost: 160, monthlyCost: 10, duration: 3,
        effectText: '소방 서비스 +35% · 세입 −1%', effects: { fire: 1.35, income: 0.99 } },
      { id: 'local_training', title: '지역 예방 교육', description: '소규모 교육으로 대응 능력을 높입니다.', cost: 80, monthlyCost: 0, duration: 2,
        effectText: '소방 서비스 +15%', effects: { fire: 1.15 } },
    ] },
    { id: 'water_agreement', title: '물 절약 협약', description: '급수 효율을 높일 방법을 선택하세요.', choices: [
      { id: 'water_retrofit', title: '절수 설비 지원', description: '설비를 운영하는 전력이 조금 더 필요합니다.', cost: 200, monthlyCost: 15, duration: 4,
        effectText: '물 소비 −20% · 전력 소비 +3%', effects: { waterUse: 0.8, powerUse: 1.03 } },
      { id: 'saving_advice', title: '생활 절수 안내', description: '주민이 참여하는 생활 속 절약을 지원합니다.', cost: 80, monthlyCost: 0, duration: 3,
        effectText: '물 소비 −8% · 행복도 +1', effects: { waterUse: 0.92, happiness: 1 } },
    ] },
  ],

  normalize(raw) {
    const defaults = {
      version: 1, month: 0, completed: [], claimed: [], policies: [], permits: [],
      progress: Object.fromEntries(this.quests.map(q => [q.id, 0])), event: null, eventCounter: 0,
      eventAccruedCost: 0, eventIncomeAccrued: 0,
    };
    if (raw == null) return defaults;
    const invalid = () => { throw new Error('도시 운영 저장 데이터가 올바르지 않습니다.'); };
    const natural = n => Number.isSafeInteger(n) && n >= 0;
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 || !natural(raw.month) || !natural(raw.eventCounter)) invalid();
    const eventAccruedCost = raw.eventAccruedCost === undefined ? 0 : raw.eventAccruedCost;
    const eventIncomeAccrued = raw.eventIncomeAccrued === undefined ? 0 : raw.eventIncomeAccrued;
    if (!Number.isFinite(eventAccruedCost) || eventAccruedCost < 0 || !Number.isFinite(eventIncomeAccrued)) invalid();
    const readList = (value, allowed) => {
      if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !allowed.includes(id))) invalid();
      return [...new Set(value)];
    };
    const questIds = this.quests.map(q => q.id);
    const completed = readList(raw.completed, questIds);
    const claimed = readList(raw.claimed, questIds);
    if (claimed.some(id => !completed.includes(id))) invalid();
    if (!raw.progress || typeof raw.progress !== 'object' || Array.isArray(raw.progress)) invalid();
    const progress = {};
    for (const q of this.quests) {
      const value = raw.progress[q.id];
      if (!natural(value) || value > q.target || (completed.includes(q.id) && value !== q.target)) invalid();
      progress[q.id] = value;
    }
    let event = null;
    if (raw.event !== null) {
      const saved = raw.event;
      const def = saved && this.events.find(e => e.id === saved.id);
      if (!def || !natural(saved.remaining) || saved.remaining === 0) invalid();
      const choice = def.choices.find(c => c.id === saved.choiceId);
      if (saved.choiceId !== null && !choice) invalid();
      if (saved.remaining > (choice ? choice.duration : 3)) invalid();
      event = { id: def.id, choiceId: saved.choiceId, remaining: saved.remaining };
      if (choice) {
        // 구버전 저장은 남은 개월 수만 있으므로 해당 기간 전체를 보장합니다.
        const days = saved.remainingDays === undefined ? saved.remaining * 30 : saved.remainingDays;
        if (!natural(days) || days === 0 || days > choice.duration * 30 || Math.ceil(days / 30) !== saved.remaining) invalid();
        event.remainingDays = days;
      } else if (saved.remainingDays !== undefined) invalid();
    }
    return {
      version: 1, month: raw.month, eventCounter: raw.eventCounter, completed, claimed, progress, event,
      eventAccruedCost, eventIncomeAccrued,
      policies: readList(raw.policies, this.policies.map(p => p.id)),
      permits: readList(raw.permits, ['hotel', 'research']),
    };
  },

  // 정책·이벤트 비용은 인구 500명까지 기본값, 그 뒤로 인구에 비례해 늘어난다
  costScale() {
    const pop = typeof S !== 'undefined' && S?.stats ? S.stats.pop : 0;
    return Math.max(1, pop / 500);
  },
  scaled(base) {
    if (!base) return 0;
    const scale = this.costScale();
    return scale === 1 ? base : Math.round(base * scale / 5) * 5;
  },

  state() {
    if (typeof S === 'undefined' || !S) return null;
    if (!S.civic) S.civic = this.normalize();
    return S.civic;
  },
  activeChoice() {
    const current = this.state()?.event;
    if (!current || current.choiceId === null) return null;
    return this.events.find(e => e.id === current.id)?.choices.find(c => c.id === current.choiceId) || null;
  },
  modifiers() {
    const result = { happiness: 0, pollution: 1, waterUse: 1, powerUse: 1, school: 1, fire: 1, income: 1, resDemand: 0, comDemand: 0, indDemand: 0 };
    const state = this.state();
    if (!state) return result;
    const effects = this.policies.filter(p => state.policies.includes(p.id)).map(p => p.effects);
    const choice = this.activeChoice();
    if (choice) effects.push(choice.effects);
    for (const effect of effects) for (const [key, value] of Object.entries(effect)) {
      if (['happiness', 'resDemand', 'comDemand', 'indDemand'].includes(key)) result[key] += value;
      else result[key] *= value;
    }
    return result;
  },
  monthlyCost() {
    const state = this.state();
    if (!state) return 0;
    return this.policies.filter(p => state.policies.includes(p.id)).reduce((sum, p) => sum + this.scaled(p.monthlyCost), 0)
      + this.scaled(this.activeChoice()?.monthlyCost || 0);
  },
  monthSettlementCost() {
    const state = this.state();
    if (!state) return 0;
    return this.policies.filter(p => state.policies.includes(p.id)).reduce((sum, p) => sum + this.scaled(p.monthlyCost), 0)
      + state.eventAccruedCost;
  },
  incomeMultiplierForMonth() {
    const state = this.state();
    if (!state) return 1;
    const policies = this.policies.filter(p => state.policies.includes(p.id));
    return policies.reduce((product, p) => product * (p.effects.income || 1), 1)
      * (1 + state.eventIncomeAccrued / 30);
  },
  settleMonth() {
    const state = this.state();
    if (!state) return;
    state.eventAccruedCost = 0;
    state.eventIncomeAccrued = 0;
  },
  // 하루의 성장·서비스 계산이 끝난 뒤, 월말 재정 계산 전에 한 번 호출합니다.
  onDay() {
    const state = this.state();
    const choice = this.activeChoice();
    if (!choice) return;
    state.eventAccruedCost += this.scaled(choice.monthlyCost) / 30;
    state.eventIncomeAccrued += (choice.effects.income || 1) - 1;
    state.event.remainingDays--;
    state.event.remaining = Math.ceil(state.event.remainingDays / 30);
    if (state.event.remainingDays === 0) {
      const title = this.events.find(e => e.id === state.event.id).title;
      state.event = null;
      notify(`도시 운영 '${title}' 효과가 종료되었습니다.`, 'info');
      recomputeAll();
    }
  },
  residentialMetrics() {
    let population = 0, powered = 0, watered = 0, pollution = 0, park = 0, school = 0;
    for (let i = 0; i < S.tiles.length; i++) {
      const tile = S.tiles[i];
      if (tile.type !== 'res' || tile.level === 0) continue;
      const people = ZONE_CAP.res[tile.level];
      population += people;
      powered += tile.powered ? people : 0;
      watered += tile.watered ? people : 0;
      pollution += tile.poll * people;
      park += S.cov.park[i] >= 0.25 ? people : 0;
      school += S.cov.school[i] >= 0.25 ? people : 0;
    }
    const divisor = population || 1;
    return { powered: powered / divisor, watered: watered / divisor, pollution: pollution / divisor, park: park / divisor, school: school / divisor };
  },
  onMonth() {
    const state = this.state();
    if (!state || !S.stats) return;
    state.month++;
    const metrics = this.residentialMetrics();
    for (const q of this.quests) {
      if (state.completed.includes(q.id)) continue;
      state.progress[q.id] = q.population ? Math.min(q.target, S.stats.pop)
        : q.check(S.stats, metrics) ? Math.min(q.target, state.progress[q.id] + 1) : 0;
      if (state.progress[q.id] >= q.target) {
        state.completed.push(q.id);
        notify(`📋 시민 의뢰 '${q.title}' 달성! 도시 운영에서 보상을 받으세요.`, 'good');
      }
    }
    if (state.event && state.event.choiceId === null) {
      state.event.remaining--;
      if (state.event.remaining <= 0) {
        const title = this.events.find(e => e.id === state.event.id).title;
        state.event = null;
        notify(`'${title}' 제안이 불이익 없이 만료되었습니다.`, 'info');
      }
    }
    if (!state.event && state.month % 6 === 0 && S.stats.pop >= 100) {
      const next = this.events[state.eventCounter % this.events.length];
      state.eventCounter++;
      state.event = { id: next.id, choiceId: null, remaining: 3 };
      if (typeof NEWS === 'undefined') notify(`📨 ${next.title} · 3개월 안에 선택할 수 있습니다.`, 'info');
    }
  },
  claimQuest(id) {
    const state = this.state();
    const quest = this.quests.find(q => q.id === id);
    if (!state || !quest) return { ok: false, reason: '시민 의뢰를 찾을 수 없습니다.' };
    if (state.claimed.includes(id)) return { ok: false, reason: '이미 받은 보상입니다.' };
    if (!state.completed.includes(id)) return { ok: false, reason: '아직 의뢰 조건을 달성하지 못했습니다.' };
    state.claimed.push(id);
    const reward = typeof difficultyReward === 'function' ? difficultyReward(quest.reward) : quest.reward;
    S.money += reward;
    if (quest.permit && !state.permits.includes(quest.permit)) state.permits.push(quest.permit);
    // 현금·건설 허가만 바뀌므로 도로 경로와 수거망을 다시 계산하지 않는다.
    notify(`📋 ${quest.title} 보상 ₩${reward.toLocaleString()}${quest.permitText ? ' · ' + quest.permitText : ''}`, 'good');
    if (typeof SOUND !== 'undefined') SOUND.play('reward');
    return { ok: true };
  },
  togglePolicy(id) {
    const state = this.state();
    const policy = this.policies.find(p => p.id === id);
    if (!state || !policy) return { ok: false, reason: '도시 정책을 찾을 수 없습니다.' };
    const index = state.policies.indexOf(id);
    if (index >= 0) state.policies.splice(index, 1);
    else {
      if (S.stats.pop < policy.unlock) return { ok: false, reason: `인구 ${policy.unlock.toLocaleString()}명부터 도입할 수 있습니다.` };
      const cost = this.scaled(policy.activationCost);
      if (S.money < cost) return { ok: false, reason: `도입비 ₩${cost.toLocaleString()}이 필요합니다.` };
      S.money -= cost;
      state.policies.push(id);
    }
    recomputeAll();
    return { ok: true };
  },
  chooseEvent(choiceId) {
    const state = this.state();
    if (!state?.event || state.event.choiceId !== null) return { ok: false, reason: '선택할 수 있는 제안이 없습니다.' };
    const event = this.events.find(e => e.id === state.event.id);
    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) return { ok: false, reason: '이 제안에 해당하는 선택지가 아닙니다.' };
    const cost = this.scaled(choice.cost);
    if (S.money < cost) return { ok: false, reason: `실행비 ₩${cost.toLocaleString()}이 필요합니다.` };
    S.money -= cost;
    state.event = { id: event.id, choiceId, remaining: choice.duration, remainingDays: choice.duration * 30 };
    recomputeAll();
    notify(`📨 ${choice.title} 시작 · ${choice.duration}개월 동안 적용됩니다.`, 'good');
    return { ok: true };
  },
  view() {
    const state = this.state() || this.normalize();
    const money = typeof S !== 'undefined' && S ? S.money : 0;
    const population = typeof S !== 'undefined' && S?.stats ? S.stats.pop : 0;
    const policies = this.policies.map(p => ({
      id: p.id, title: p.title, description: p.description, unlock: p.unlock,
      activationCost: this.scaled(p.activationCost), monthlyCost: this.scaled(p.monthlyCost), effectText: p.effectText,
      active: state.policies.includes(p.id), locked: !state.policies.includes(p.id) && population < p.unlock,
      affordable: state.policies.includes(p.id) || money >= this.scaled(p.activationCost),
    }));
    let event = null;
    if (state.event) {
      const def = this.events.find(e => e.id === state.event.id);
      const active = def.choices.find(c => c.id === state.event.choiceId);
      event = {
        id: def.id, title: def.title, description: def.description,
        phase: active ? 'active' : 'offer', remaining: state.event.remaining,
        remainingDays: active ? state.event.remainingDays : null,
        choiceId: state.event.choiceId, choiceTitle: active?.title || '',
        monthlyCost: this.scaled(active?.monthlyCost || 0), effectText: active?.effectText || '',
        choices: def.choices.map(c => ({
          id: c.id, title: c.title, description: c.description, cost: this.scaled(c.cost),
          monthlyCost: this.scaled(c.monthlyCost), duration: c.duration, effectText: c.effectText, affordable: money >= this.scaled(c.cost),
        })),
      };
    }
    const policyCost = policies.filter(p => p.active).reduce((sum, p) => sum + p.monthlyCost, 0);
    const eventCost = event?.monthlyCost || 0;
    return {
      quests: this.quests.map(q => ({
        id: q.id, title: q.title, description: q.description, target: q.target, unit: q.unit,
        progress: state.progress[q.id], ready: state.completed.includes(q.id) && !state.claimed.includes(q.id),
        claimed: state.claimed.includes(q.id), reward: typeof difficultyReward === 'function' ? difficultyReward(q.reward) : q.reward, permit: q.permit || null, permitText: q.permitText || '',
      })),
      policies, event, effects: this.modifiers(), monthlyCost: policyCost + eventCost, policyCost, eventCost,
    };
  },
};
