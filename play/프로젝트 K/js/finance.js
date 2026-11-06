// ===== 도시 채권: 원금·이자는 정수 센트로 계산하고 월 예산에서 한 번 차감 =====
const FINANCE = {
  amounts: [5000, 10000, 25000],

  _cents(value) {
    const cents = Math.round(value * 100);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents) || Math.abs(value - cents / 100) > 1e-8) {
      throw new Error('채권 금액이 올바르지 않습니다.');
    }
    return cents;
  },

  _payment(principal, rate) {
    const cents = this._cents(principal), monthly = rate / 12;
    return Math.round(cents * monthly / (1 - Math.pow(1 + monthly, -60)));
  },

  _next(loan) {
    const balance = this._cents(loan.remaining), interest = Math.round(balance * loan.rate / 12);
    const payment = loan.months === 1 ? balance + interest : Math.min(this._cents(loan.payment), balance + interest);
    return { payment, principal: payment - interest, interest };
  },

  normalizeLoans(raw) {
    if (raw == null) return [];
    const fail = () => { throw new Error('저장된 채권 데이터가 올바르지 않습니다.'); };
    if (!Array.isArray(raw) || raw.length > 3) fail();
    const ids = new Set();
    let total = 0;
    return raw.map(loan => {
      if (!loan || typeof loan !== 'object' || Array.isArray(loan)
        || !Number.isSafeInteger(loan.id) || loan.id < 1 || loan.id >= Number.MAX_SAFE_INTEGER || ids.has(loan.id)
        || ![.06, .12].includes(loan.rate) || !Number.isInteger(loan.months) || loan.months < 1 || loan.months > 60
        || !Number.isSafeInteger(loan.takenAt) || loan.takenAt < 0) fail();
      const principal = this._cents(loan.principal), remaining = this._cents(loan.remaining);
      const payment = this._payment(loan.principal, loan.rate);
      if (!principal || !remaining || remaining > principal || payment <= 0
        || this._cents(loan.payment) !== payment || (loan.rate === .06 && !this.amounts.includes(loan.principal))) fail();
      let expected = principal;
      for (let month = 60; month > loan.months; month--) {
        const interest = Math.round(expected * loan.rate / 12);
        expected -= Math.min(payment, expected + interest) - interest;
      }
      if (remaining !== expected || !Number.isSafeInteger(total += remaining)) fail();
      ids.add(loan.id);
      return { id: loan.id, principal: principal / 100, rate: loan.rate, months: loan.months,
        remaining: remaining / 100, payment: payment / 100, takenAt: loan.takenAt };
    });
  },

  normalize(raw) {
    const state = { version: 1, crisisMonths: 0, crisisShown: false, lastPaymentMonth: null, lastCrisisMonth: null, nextId: 1 };
    if (raw == null) return state;
    const fail = () => { throw new Error('저장된 재정 데이터가 올바르지 않습니다.'); };
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) fail();
    for (const key of Object.keys(state)) if (raw[key] !== undefined) state[key] = raw[key];
    if (!Number.isInteger(state.crisisMonths) || state.crisisMonths < 0 || state.crisisMonths > 6
      || typeof state.crisisShown !== 'boolean' || (state.crisisShown && state.crisisMonths < 6)
      || !Number.isSafeInteger(state.nextId) || state.nextId < 1 || state.nextId >= Number.MAX_SAFE_INTEGER) fail();
    for (const key of ['lastPaymentMonth', 'lastCrisisMonth']) {
      if (state[key] !== null && (!Number.isSafeInteger(state[key]) || state[key] < 0)) fail();
    }
    return state;
  },

  _month() {
    const month = S.year * 12 + S.month - 1;
    if (!Number.isSafeInteger(month) || month < 0) throw new Error('도시 날짜가 올바르지 않습니다.');
    return month;
  },

  outstanding() { return (S.loans || []).reduce((sum, loan) => sum + this._cents(loan.remaining), 0) / 100; },
  netAssets() { return S.money - this.outstanding(); },
  _limit() { return 5000 + Math.max(0, Number.isFinite(S.stats?.pop) ? S.stats.pop : 0) * 10; },

  _offer(amount, emergency = false) {
    const rate = emergency ? .12 : .06;
    let payment = 0, reason = '';
    try { payment = this._payment(amount, rate) / 100; } catch (_) { reason = '채권 금액이 올바르지 않아요.'; }
    if (!reason && (!amount || (!emergency && !this.amounts.includes(amount)))) reason = '선택할 수 없는 채권 금액입니다.';
    if (!reason && (!Number.isFinite(S.money) || !Number.isFinite(S.money + amount))) reason = '도시 자금이 올바르지 않아요.';
    if (!reason && (S.loans || []).length >= 3) reason = '동시에 보유할 수 있는 채권은 최대 3건입니다.';
    if (!reason && emergency && (!(S.finance?.crisisShown) || S.finance.crisisMonths < 6 || S.money >= -5000)) reason = '현재는 긴급 채권을 발행할 수 없어요.';
    if (!reason && !emergency && this.outstanding() + amount > this._limit()) reason = '인구에 따른 채권 한도를 넘어요.';
    return { amount, rate, payment, allowed: !reason, reason };
  },

  _refresh() { if (typeof UI !== 'undefined' && typeof UI.refresh === 'function') UI.refresh(); },

  _borrow(amount, emergency) {
    try {
      const loans = this.normalizeLoans(S.loans), state = this.normalize(S.finance);
      const offer = this._offer(amount, emergency);
      if (!offer.allowed) return { ok: false, reason: offer.reason };
      const id = Math.max(state.nextId, ...loans.map(loan => loan.id + 1));
      if (!Number.isSafeInteger(id + 1) || id + 1 >= Number.MAX_SAFE_INTEGER) throw new Error('새 채권 번호를 만들 수 없어요.');
      loans.push({ id, principal: amount, rate: offer.rate, months: 60, remaining: amount, payment: offer.payment, takenAt: this._month() });
      this.normalizeLoans(loans); // 합산 원금도 센트 단위의 안전한 정수 범위를 유지한다.
      state.nextId = id + 1;
      S.loans = loans; S.finance = state; S.money += amount;
      this._refresh();
      return { ok: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  },

  borrow(amount) { return this._borrow(amount, false); },
  emergency() { return this._borrow(Math.max(0, Math.ceil((2000 - S.money) * 100) / 100), true); },

  repay(id) {
    try {
      const loans = this.normalizeLoans(S.loans), loan = loans.find(loan => loan.id === id);
      if (!loan) return { ok: false, reason: '상환할 채권을 찾을 수 없어요.' };
      if (!Number.isFinite(S.money)) return { ok: false, reason: '도시 자금이 올바르지 않아요.' };
      if (S.money < loan.remaining) return { ok: false, reason: '남은 원금을 갚을 자금이 부족해요.' };
      S.money -= loan.remaining;
      S.loans = loans.filter(other => other.id !== id);
      this._refresh();
      return { ok: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  },

  onMonth() {
    const state = this.normalize(S.finance), month = this._month();
    const result = { payment: 0, principal: 0, interest: 0, paidOff: [] };
    if (state.lastPaymentMonth !== null && state.lastPaymentMonth >= month) return result;
    const loans = this.normalizeLoans(S.loans), remaining = [];
    for (const loan of loans) {
      const next = this._next(loan);
      result.payment += next.payment; result.principal += next.principal; result.interest += next.interest;
      loan.remaining = (this._cents(loan.remaining) - next.principal) / 100;
      loan.months--;
      if (loan.remaining > 0) remaining.push(loan);
      else result.paidOff.push(loan.id);
    }
    state.lastPaymentMonth = month;
    S.loans = remaining; S.finance = state;
    for (const key of ['payment', 'principal', 'interest']) result[key] /= 100;
    return result;
  },

  checkCrisis() {
    const state = this.normalize(S.finance), month = this._month();
    if (state.lastCrisisMonth !== null && state.lastCrisisMonth >= month) return false;
    state.lastCrisisMonth = month;
    let show = false;
    if (Number.isFinite(S.money) && S.money < -5000) {
      state.crisisMonths = Math.min(6, state.crisisMonths + 1);
      if (state.crisisMonths === 6 && !state.crisisShown) { state.crisisShown = true; show = true; }
    } else { state.crisisMonths = 0; state.crisisShown = false; }
    S.finance = state;
    return show;
  },

  view() {
    const outstanding = this.outstanding(), limit = this._limit();
    const loans = (S.loans || []).map(loan => {
      const next = this._next(loan), canRepay = Number.isFinite(S.money) && S.money >= loan.remaining;
      return { ...loan, payment: next.payment / 100, nextPrincipal: next.principal / 100, nextInterest: next.interest / 100,
        canRepay, reason: canRepay ? '' : '남은 원금을 갚을 자금이 부족해요.' };
    });
    return { limit, remaining: Math.max(0, limit - outstanding), available: Math.max(0, 3 - loans.length), outstanding,
      netAssets: this.netAssets(), monthlyPayment: loans.reduce((sum, loan) => sum + this._cents(loan.payment), 0) / 100,
      loans, offers: this.amounts.map(amount => this._offer(amount)),
      emergency: this._offer(Math.max(0, Math.ceil((2000 - S.money) * 100) / 100), true),
      crisisMonths: S.finance?.crisisMonths || 0, crisisShown: !!S.finance?.crisisShown };
  },
};
