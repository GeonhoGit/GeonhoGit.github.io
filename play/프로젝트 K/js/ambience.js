// ===== 게임 날짜의 낮·밤과 계절, 도시 저장과 분리된 화면 설정 =====
const AMBIENCE = {
  _settings: null,
  _key: 'citysim_settings',

  _readStored() {
    const text = localStorage.getItem(this._key);
    if (!text) return {};
    try {
      const value = JSON.parse(text);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  },

  get settings() {
    if (!this._settings) {
      let reduced = false;
      try { reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { /* 지원하지 않는 환경은 기본 표시 */ }
      this._settings = { dayNight: !reduced, seasons: true };
      try {
        const stored = this._readStored();
        for (const key of ['dayNight', 'seasons']) if (typeof stored[key] === 'boolean') this._settings[key] = stored[key];
      } catch (_) { /* 저장소 없이도 현재 창에서 설정을 사용할 수 있다. */ }
    }
    return { ...this._settings };
  },

  updateSettings(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || !Object.entries(patch).every(([key, value]) => ['dayNight', 'seasons'].includes(key) && typeof value === 'boolean')) {
      return { ok: false, reason: '화면 설정이 올바르지 않아요.' };
    }
    const previous = this.settings, next = { ...previous, ...patch };
    this._settings = next;
    let persisted = true;
    try {
      // 소리 등 다른 설정이 뒤에서 갱신됐어도 현재 저장값을 다시 읽어 보존한다.
      localStorage.setItem(this._key, JSON.stringify({ ...this._readStored(), ...next }));
    } catch (_) { persisted = false; }
    const changed = previous.dayNight !== next.dayNight || previous.seasons !== next.seasons;
    if (changed) {
      if (previous.seasons !== next.seasons && typeof S !== 'undefined' && S && typeof recomputeAll === 'function') recomputeAll();
      if (typeof drawMinimap === 'function' && (typeof R === 'undefined' || R.mini && R.miniCtx)) drawMinimap();
      if (typeof UI !== 'undefined' && typeof UI.refresh === 'function') UI.refresh();
    }
    return persisted ? { ok: true, persisted: true }
      : { ok: true, persisted: false, reason: '설정을 저장하지 못해 이번 창에서만 적용돼요.' };
  },

  phase(dayFraction = 0) {
    const day = typeof S !== 'undefined' && Number.isFinite(S?.day) ? S.day : 1;
    const fraction = Number.isFinite(dayFraction) ? Math.max(0, Math.min(1, dayFraction)) : 0;
    return (((day - 1 + fraction) / 30) % 1 + 1) % 1;
  },

  nightStrength(phase) {
    const p = Number.isFinite(phase) ? Math.max(0, Math.min(1, phase)) : 0;
    const smooth = t => t * t * (3 - 2 * t);
    if (p <= .4) return 0;
    if (p < .55) return .45 * smooth((p - .4) / .15);
    if (p <= .85) return .45;
    return .45 * (1 - smooth((p - .85) / .15));
  },

  season(month = typeof S !== 'undefined' && S ? S.month : 3) {
    if (!Number.isInteger(month) || month < 1 || month > 12) return 'spring';
    if (month === 12 || month <= 2) return 'winter';
    if (month <= 5) return 'spring';
    if (month <= 8) return 'summer';
    return 'autumn';
  },

  modifiers() {
    if (!this.settings.seasons) return { powerUse: 1, waterUse: 1 };
    const season = this.season();
    return { powerUse: season === 'winter' ? 1.1 : 1, waterUse: season === 'summer' ? 1.1 : 1 };
  },
};
