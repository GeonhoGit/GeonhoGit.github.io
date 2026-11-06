// ===== 월간 도시 소식: 즉시 사건 토스트와 분리된 기록 =====
const NEWS = {
  kinds: ['disaster', 'fire', 'power', 'water', 'powerMargin', 'waterMargin', 'deficit', 'garbage', 'landfill', 'landfill70',
    'traffic', 'pollution', 'crime', 'unemployment', 'workerShortage', 'resDemand', 'comDemand', 'indDemand',
    'milestone', 'proposal', 'loanPaid'],
  flavors: [
    '아침 산책길에 느긋한 발걸음 이어져', '골목 풍경 담는 주민 사진 늘어', '주말 나들이 앞두고 동네 길에 관심',
    '창가 화분 가꾸는 작은 즐거움', '이웃 인사로 시작하는 새로운 한 달', '도시의 다음 모습을 그리는 시민들',
    '노을 아래 익숙한 거리가 새롭게 보여', '지역 소식 나누는 주민 대화 활발', '비 오는 날을 기다리는 작은 우산들',
    '맑은 하늘 아래 동네 한 바퀴', '오래 머물고 싶은 쉼터에 관심', '출근길 창밖으로 계절 변화 느껴',
    '도시 이름에 담긴 이야기 다시 화제', '주말 계획 세우는 가족들의 웃음', '작은 가게를 찾는 발걸음 이어져',
    '거리의 나무가 전하는 계절 인사', '지도 속 새로운 동네 찾는 재미', '익숙한 골목에서 발견한 작은 변화',
    '주민들이 꿈꾸는 더 편리한 생활', '밤하늘 아래 차분한 도시 풍경', '새로운 취미로 이웃 만나는 시민들',
    '동네 이야기를 모으는 작은 기록', '느린 산책으로 다시 보는 우리 도시', '다음 달을 준비하는 거리의 일상',
  ],

  _kind(kind) { return typeof kind === 'string' && (this.kinds.includes(kind) || this.flavors.some((_, i) => kind === 'flavor_' + i)); },

  normalize(raw) {
    const state = { version: 1, lastMonth: null, nextId: 1, items: [], lastKinds: {}, flavorIndex: 0,
      pendingMilestone: 0, pendingOffer: 0, pendingLoanPaid: 0 };
    if (raw == null) return state;
    const fail = () => { throw new Error('저장된 뉴스 데이터가 올바르지 않습니다.'); };
    const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER - 2) => Number.isSafeInteger(n) && n >= min && n <= max;
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail();
    for (const key of ['lastMonth', 'nextId', 'flavorIndex', 'pendingMilestone', 'pendingOffer', 'pendingLoanPaid']) {
      if (raw[key] !== undefined) state[key] = raw[key];
    }
    if (state.lastMonth !== null && !integer(state.lastMonth) || !integer(state.nextId, 1)
      || !integer(state.flavorIndex, 0, this.flavors.length - 1)
      || !integer(state.pendingMilestone, 0, MILESTONES.length) || !integer(state.pendingOffer)
      || !integer(state.pendingLoanPaid, 0, 30)) fail();
    if (raw.lastKinds !== undefined) {
      if (!raw.lastKinds || typeof raw.lastKinds !== 'object' || Array.isArray(raw.lastKinds)) fail();
      for (const [kind, month] of Object.entries(raw.lastKinds)) {
        if (!this._kind(kind) || !integer(month)) fail();
        state.lastKinds[kind] = month;
      }
    }
    if (raw.items !== undefined) {
      if (!Array.isArray(raw.items) || raw.items.length > 30) fail();
      const ids = new Set();
      let previousMonth = Infinity, previousId = Infinity;
      state.items = raw.items.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item) || !integer(item.id, 1) || item.id >= state.nextId || ids.has(item.id)
          || !this._kind(item.kind) || !integer(item.year, 1) || !integer(item.month, 1, 12)
          || typeof item.title !== 'string' || !item.title.length || item.title.length > 160
          || typeof item.advice !== 'string' || !item.advice.length || item.advice.length > 240
          || typeof item.read !== 'boolean' || !['info', 'good', 'warn', 'bad'].includes(item.level)) fail();
        const month = item.year * 12 + item.month - 1;
        if (!integer(month) || state.lastMonth === null || month > state.lastMonth || month > previousMonth
          || month === previousMonth && item.id >= previousId) fail();
        if (!(item.x === null && item.y === null)
          && !(integer(item.x, 0, MAP_W - 1) && integer(item.y, 0, MAP_H - 1))) fail();
        ids.add(item.id); previousMonth = month; previousId = item.id;
        return { id: item.id, kind: item.kind, year: item.year, month: item.month, title: item.title,
          advice: item.advice, x: item.x, y: item.y, read: item.read, level: item.level };
      });
    }
    return state;
  },

  _position(i) { return Number.isInteger(i) && i >= 0 && i < MAP_W * MAP_H ? { x: i % MAP_W, y: Math.floor(i / MAP_W) } : { x: null, y: null }; },

  _problems() {
    const st = S.stats || {}, candidates = [];
    const add = (kind, priority, title, advice, i, level = 'warn') => candidates.push({ kind, priority, title, advice, ...this._position(i), level });
    const fire = S.tiles.findIndex(t => t.fire > 0);
    if (fire >= 0) add('fire', 99, '화재 현장 대응 이어져', '현장을 살펴보고 도로와 소방서의 대응 범위를 확인하세요.', fire, 'bad');
    const disaster = S.disasters?.lastEvent;
    if (disaster && disaster.year === S.year && disaster.month === S.month) {
      add('disaster', 100, String(disaster.title || '재난 피해 복구 시작').slice(0, 70), '피해 지역의 도로와 전기·수도를 확인하고 복구하세요.',
        inMap(disaster.x, disaster.y) ? idx(disaster.x, disaster.y) : undefined, 'bad');
    }
    for (const [key, label, net, cap, use, priority] of [
      ['power', '전력', st.powerNet, st.powerCap, st.powerUse, 98], ['water', '수도', st.waterNet, st.waterCap, st.waterUse, 97],
    ]) {
      const supply = net?.linkedCap ?? cap ?? 0, demand = net?.demand ?? use ?? 0;
      if ((net?.short || 0) + (net?.cut || 0) > 0 || demand > 0 && supply === 0) {
        add(key, priority, `${label} 공급 문제에 주민 불편`, '문제 지점의 도로 연결과 같은 공급망의 시설 용량을 확인하세요.', net?.targets?.[0] ?? net?.firstCut, 'bad');
      } else if (supply > 0 && demand > supply * .92) {
        add(key + 'Margin', priority - 20, `${label} 공급 여유 줄어`, '공급이 끊기기 전에 같은 도로망에 공급 시설을 보강하세요.');
      }
    }
    if (S.money < 0 || S.budget && S.budget.expense > S.budget.income) add('deficit', 85, '재정 적자에 예산 점검 필요', '예산에서 큰 지출과 실제 고용을 확인하고 세율·시설 지출을 조정하세요.');
    const waste = S.waste?.last;
    if ((waste?.generated ?? waste?.total) > 0 && (waste.currentRate ?? waste.rate) < .8)
      add('garbage', 84, '쓰레기 수거 대책 요구 커져', '이번 달 발생한 쓰레기를 수거할 수 있도록 같은 도로망에 처리 시설을 연결하세요.', this._worst('garbage'));
    const landfillAt = ratio => S.tiles.findIndex((t, i) => t.type === 'landfill' && t.root === i
      && t.landfillStored >= DEFS.landfill.wasteCapacity * ratio);
    const landfill = landfillAt(.9);
    if (landfill >= 0) add('landfill', 83, '매립지 용량 90% 넘어, 포화 대비 시급', '재활용·소각 처리량을 늘리거나 새 매립지를 준비하세요.', landfill);
    else {
      const preparing = landfillAt(.7);
      if (preparing >= 0) add('landfill70', 82, '매립지 용량 70% 넘어, 다음 수거 대책 준비', '같은 도로망에 재활용·소각 시설이나 새 매립지를 미리 준비하세요.', preparing);
    }
    if ((S.traffic?.avgCongestion || 0) >= 60 || (S.traffic?.congestedRoads || 0) > 10) add('traffic', 76, '출근길 혼잡 개선 목소리', '큰길·우회 도로·대중교통으로 출근길 통행을 분산하세요.', S.traffic?.worstRoad);
    const homes = S.tiles.filter(t => t.type === 'res' && t.level > 0);
    if (homes.length && homes.reduce((sum, t) => sum + t.poll, 0) / homes.length >= 30) add('pollution', 74, '공장 매연 민원 증가', '오염 시설을 주거지에서 떨어뜨리거나 공원을 지어 보세요.', this._worst('poll', true));
    if (homes.length && homes.reduce((sum, t) => sum + t.crime, 0) / homes.length >= 40) add('crime', 73, '생활 안전 대책에 관심', '경찰서의 전력·도로 연결과 주거지 대응 범위를 확인하세요.', this._worst('crime', true));
    if ((st.workers || 0) > 0 && st.unemployment >= .1) add('unemployment', 65, '시민 일자리 연결 과제', '일자리를 늘리고 주거지에서 출근할 수 있는 도로망인지 확인하세요.');
    if ((st.comJobs || 0) + (st.indJobs || 0) > (st.workers || 0)) add('workerShortage', 64, '상점·공장 인력 확보 필요', '주거지가 성장해야 실제 고용과 사업장 수입이 늘어납니다.');
    for (const [key, label, priority] of [['res', '주거', 53], ['com', '상업', 52], ['ind', '공업', 51]]) {
      if ((st.demand?.[key] || 0) >= .6) add(key + 'Demand', priority, `${label} 지역 확장 수요 높아`, '예산과 기반 시설의 여유를 확인한 뒤 수요에 맞춰 구역을 늘려 보세요.');
    }
    return candidates;
  },

  _worst(key, residential = false) {
    let best = -1, amount = 0;
    for (let i = 0; i < S.tiles.length; i++) {
      const t = S.tiles[i];
      if (residential && (t.type !== 'res' || t.level <= 0)) continue;
      if ((t[key] || 0) > amount) { amount = t[key]; best = i; }
    }
    return best;
  },

  onMonth(before = {}) {
    const state = this.normalize(S.news), month = S.year * 12 + S.month - 1;
    if (!Number.isSafeInteger(month) || month < 0) throw new Error('뉴스 날짜가 올바르지 않습니다.');
    if (state.lastMonth !== null && state.lastMonth >= month) return [];
    if (S.milestone > (before.milestone ?? S.milestone)) state.pendingMilestone = S.milestone;
    const counter = S.civic?.eventCounter || 0, offer = S.civic?.event;
    if (counter > (before.offerCounter ?? counter)) state.pendingOffer = counter;
    if (!offer || offer.choiceId !== null || state.pendingOffer !== counter) state.pendingOffer = 0;
    state.pendingLoanPaid = Math.min(30, state.pendingLoanPaid + (S.budget?.loanPaidOff?.length || 0));
    const events = [];
    const event = (kind, priority, title, advice) => events.push({ kind, priority, title, advice, x: null, y: null, level: 'good' });
    if (state.pendingMilestone) event('milestone', 90, `'${MILESTONES[state.pendingMilestone - 1].title}' 성장 단계 달성`, '보상과 새로 열린 시설을 살펴보고 다음 성장 계획을 세워 보세요.');
    if (state.pendingLoanPaid) event('loanPaid', 89, `도시 채권 ${state.pendingLoanPaid}건 상환 완료`, '줄어든 월 상환 부담을 확인하고 예산의 여유를 점검하세요.');
    if (state.pendingOffer) event('proposal', 88, '새 도시 제안 도착', '도시 운영 창에서 제안의 비용과 기간을 확인하세요. 선택하지 않아도 불이익은 없어요.');
    const eligible = list => list.filter(c => state.lastKinds[c.kind] === undefined || month - state.lastKinds[c.kind] >= 6)
      .sort((a, b) => b.priority - a.priority);
    const problems = eligible(this._problems()), notices = eligible(events);
    let selected = notices.length ? [notices[0], ...problems.slice(0, 1)] : problems.slice(0, 2);
    if (!selected.length) {
      const index = state.flavorIndex;
      selected = [{ kind: 'flavor_' + index, priority: 0, title: this.flavors[index],
        advice: '도시를 천천히 둘러보며 다음 계획을 세워 보세요.', x: null, y: null, level: 'info' }];
      state.flavorIndex = (index + 1) % this.flavors.length;
    }
    selected.sort((a, b) => b.priority - a.priority);
    const city = String(S.name || '우리 도시').slice(0, 60);
    const added = selected.map((c, index) => ({ id: state.nextId + selected.length - index - 1, kind: c.kind,
      year: S.year, month: S.month, title: `${city} ${c.title}`, advice: c.advice, x: c.x, y: c.y, read: false, level: c.level }));
    for (const c of selected) {
      state.lastKinds[c.kind] = month;
      if (c.kind === 'milestone') state.pendingMilestone = 0;
      if (c.kind === 'proposal') state.pendingOffer = 0;
      if (c.kind === 'loanPaid') state.pendingLoanPaid = 0;
    }
    state.nextId += added.length; state.lastMonth = month;
    state.items = [...added, ...state.items].slice(0, 30);
    S.news = state;
    return added.map(item => ({ ...item }));
  },

  view() {
    const items = (typeof S !== 'undefined' && S?.news?.items || []).map(item => ({ ...item }));
    return { items, latest: items[0] || null, unread: items.filter(item => !item.read).length };
  },

  markRead(id) {
    if (typeof S === 'undefined' || !S?.news) return { ok: false, reason: '읽을 뉴스가 없어요.' };
    const items = S.news.items.filter(item => id === undefined || item.id === id);
    for (const item of items) item.read = true;
    return { ok: id === undefined || items.length > 0 };
  },
};
