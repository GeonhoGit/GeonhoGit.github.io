// ===== 업적: 도시마다 저장되고, 이 브라우저에서 한 번이라도 달성한 업적도 따로 기억 =====
const ACHIEVEMENTS = {
  STORAGE_KEY: 'citysim_achievements_v1',
  list: [
    { id: 'first_road', icon: '🛣️', title: '첫 길', description: '도시에 첫 도로 놓기' },
    { id: 'first_home', icon: '🏠', title: '첫 이웃', description: '첫 주민 맞이하기' },
    { id: 'pop_1k', icon: '🏘️', title: '북적이는 동네', description: '인구 1,000명' },
    { id: 'pop_5k', icon: '🏙️', title: '번화한 도시', description: '인구 5,000명' },
    { id: 'pop_10k', icon: '🌆', title: '메트로폴리스', description: '인구 10,000명' },
    { id: 'pop_25k', icon: '🌃', title: '메가시티', description: '인구 25,000명' },
    { id: 'surplus_year', icon: '📈', title: '흑자 경영', description: '인구 300명 이상에서 12개월 연속 월 흑자' },
    { id: 'rich', icon: '💰', title: '든든한 금고', description: '순자산(자금 − 남은 채권) ₩100,000' },
    { id: 'debt_free', icon: '🧾', title: '빚 없는 도시', description: '빌린 도시 채권을 모두 갚기' },
    { id: 'happy', icon: '😊', title: '행복한 시민들', description: '인구 1,000명 이상에서 행복도 75%' },
    { id: 'green_power', icon: '🔆', title: '맑은 전기', description: '인구 1,000명 이상, 화력 발전소 없이 전기를 모두 공급' },
    { id: 'clean_streets', icon: '♻️', title: '깨끗한 거리', description: '인구 2,000명 이상에서 그달 생긴 쓰레기를 모두 처리' },
    { id: 'smooth_traffic', icon: '🚦', title: '막힘 없는 도로', description: '인구 3,000명 이상에서 평균 혼잡 40% 미만' },
    { id: 'transit_city', icon: '🚇', title: '대중교통 도시', description: '인구 2,000명 이상, 주민 절반 이상이 대중교통 범위 안' },
    { id: 'all_quests', icon: '📋', title: '시민의 친구', description: '시민 의뢰 보상을 모두 받기' },
    { id: 'specialized', icon: '🎯', title: '우리 도시만의 색', description: '도시 특화 고르기' },
    { id: 'scenario_win', icon: '🏆', title: '도전 성공', description: '도전 도시의 목표를 기간 안에 달성' },
    { id: 'disaster_survivor', icon: '🌪️', title: '다시 일어선 도시', description: '재난 6개월 뒤 인구를 재난 직전보다 많게 회복' },
    { id: 'decade', icon: '📅', title: '10년 시장', description: '도시를 10년(120개월) 운영' },
    { id: 'hard_5k', icon: '🔥', title: '역경을 딛고', description: '‘도전적으로’ 난이도에서 인구 5,000명' },
  ],

  normalize(raw) {
    const state = { version: 1, unlocked: {}, streak: 0, recover: null };
    if (raw == null) return state;
    const fail = () => { throw new Error('저장된 업적 데이터가 올바르지 않습니다.'); };
    const month = v => Number.isSafeInteger(v) && v >= 0;
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail();
    if (raw.unlocked !== undefined) {
      if (!raw.unlocked || typeof raw.unlocked !== 'object' || Array.isArray(raw.unlocked)) fail();
      for (const [id, at] of Object.entries(raw.unlocked)) {
        if (!month(at)) fail();
        if (this.list.some(a => a.id === id)) state.unlocked[id] = at; // 모르는 업적은 무시(다른 버전 호환)
      }
    }
    if (raw.streak !== undefined) { if (!month(raw.streak)) fail(); state.streak = raw.streak; }
    if (raw.recover != null) {
      const r = raw.recover;
      if (typeof r !== 'object' || Array.isArray(r) || !month(r.at) || !month(r.pop) || typeof r.key !== 'string') fail();
      state.recover = { at: r.at, pop: r.pop, key: r.key };
    }
    return state;
  },

  monthIndex() { return S.year * 12 + S.month - 1; },

  // 이 브라우저에서 한 번이라도 달성한 업적 (저장 공간이 막혀 있어도 게임은 계속)
  readGlobal() {
    try {
      const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch { return {}; }
  },
  writeGlobal(ids) {
    try {
      const data = this.readGlobal();
      for (const id of ids) if (!data[id]) data[id] = true;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch { /* 저장 공간을 쓸 수 없는 환경 */ }
  },

  transitShare() {
    let total = 0, covered = 0;
    for (const t of S.tiles) {
      if (t.type !== 'res' || !t.level) continue;
      const p = ZONE_CAP.res[t.level];
      total += p; if (t.transitCovered) covered += p;
    }
    return total ? covered / total : 0;
  },

  // 각 업적의 달성 조건. 월말 정산 직후의 도시 상태로 판단한다.
  checks(state) {
    const st = S.stats || {}, pop = st.pop || 0;
    const net = typeof FINANCE !== 'undefined' ? FINANCE.netAssets() : S.money;
    const civic = S.civic;
    const months = S.startedAt != null ? this.monthIndex() - S.startedAt : 0;
    const powerNet = st.powerNet;
    return {
      first_road: () => S.tiles.some(t => t.type === 'road'),
      first_home: () => pop > 0,
      pop_1k: () => pop >= 1000,
      pop_5k: () => pop >= 5000,
      pop_10k: () => pop >= 10000,
      pop_25k: () => pop >= 25000,
      surplus_year: () => state.streak >= 12,
      rich: () => net >= 100000,
      debt_free: () => (S.budget?.loanPaidOff?.length || 0) > 0 && !(S.loans || []).length,
      happy: () => pop >= 1000 && st.happiness >= 75,
      green_power: () => pop >= 1000 && (st.powerCap || 0) > 0 && !(powerNet?.short > 0)
        && !S.tiles.some(t => t.type === 'power'),
      clean_streets: () => pop >= 2000 && (S.waste?.last?.generated || 0) > 0 && S.waste.last.currentRate >= 0.999,
      smooth_traffic: () => pop >= 3000 && !!S.traffic && (S.traffic.avgCongestion ?? 100) < 40,
      transit_city: () => pop >= 2000 && this.transitShare() >= 0.5,
      all_quests: () => typeof CIVIC !== 'undefined' && !!civic && civic.claimed.length >= CIVIC.quests.length,
      specialized: () => !!S.development?.specialization,
      scenario_win: () => S.development?.scenario?.status === 'success',
      disaster_survivor: () => !!state.recover && this.monthIndex() >= state.recover.at + 6 && pop > 0 && pop > state.recover.pop,
      decade: () => months >= 120,
      hard_5k: () => S.difficulty === 'hard' && pop >= 5000,
    };
  },

  // 월말에 한 번: 연속 흑자·재난 회복 기록을 갱신하고 새 업적을 알린다.
  onMonth() {
    if (!S) return [];
    const state = this.normalize(S.achievements);
    const pop = S.stats?.pop || 0;
    const surplus = (S.budget?.income || 0) - (S.budget?.expense || 0);
    state.streak = pop >= 300 && surplus > 0 ? state.streak + 1 : 0;
    const event = S.disasters?.lastEvent;
    if (event) {
      const key = `${event.kind}@${event.year}.${event.month}`;
      if (state.recover?.key !== key) {
        // 재난 직전 인구: 월별 기록에서 재난 달 직전 값을 찾는다.
        const before = [...(S.history || [])].reverse().find(h => h.y * 12 + h.m - 1 < event.year * 12 + event.month - 1);
        state.recover = { key, at: event.year * 12 + event.month - 1, pop: Math.max(0, Math.round(before?.pop ?? pop)) };
      }
    }
    const checks = this.checks(state), now = this.monthIndex(), fresh = [];
    for (const a of this.list) {
      if (state.unlocked[a.id] !== undefined) continue;
      let ok = false;
      try { ok = !!checks[a.id](); } catch { ok = false; }
      if (ok) { state.unlocked[a.id] = now; fresh.push(a); }
    }
    if (state.recover && state.unlocked.disaster_survivor !== undefined) state.recover = null;
    S.achievements = state;
    if (fresh.length) {
      this.writeGlobal(fresh.map(a => a.id));
      const msg = fresh.length === 1 ? `🏅 업적 달성: ${fresh[0].icon} ${fresh[0].title}`
        : `🏅 업적 ${fresh.length}개 달성: ${fresh.map(a => a.title).join(', ')}`;
      if (typeof notify === 'function') notify(msg, 'good');
      if (typeof SOUND !== 'undefined') SOUND.play('reward');
    }
    return fresh;
  },

  view() {
    const state = this.normalize(S?.achievements), global = this.readGlobal();
    const items = this.list.map(a => {
      const at = state.unlocked[a.id];
      return { ...a, unlocked: at !== undefined, at, year: at !== undefined ? Math.floor(at / 12) : null,
        month: at !== undefined ? at % 12 + 1 : null, everywhere: at !== undefined || !!global[a.id] };
    });
    return { items, city: items.filter(i => i.unlocked).length, ever: items.filter(i => i.everywhere).length, total: items.length, streak: state.streak };
  },
};
