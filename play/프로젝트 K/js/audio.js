// ===== 사용자 입력 뒤에만 시작하는 Web Audio 효과음과 도시 배경음 =====
const SOUND = {
  _settings: null,
  _key: 'citysim_settings',
  _context: null,
  _registered: false,
  _active: new Set(),
  _lastPlayed: new Map(),
  _targets: new WeakMap(),
  _noiseBuffer: null,
  _background: null,
  _lastUpdate: { paused: true, population: 0, night: 0 },

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
      this._settings = { enabled: true, effectsVolume: .4, ambienceVolume: 0 };
      try {
        const stored = this._readStored().sound;
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          if (typeof stored.enabled === 'boolean') this._settings.enabled = stored.enabled;
          for (const key of ['effectsVolume', 'ambienceVolume']) {
            if (Number.isFinite(stored[key]) && stored[key] >= 0 && stored[key] <= 1) this._settings[key] = stored[key];
          }
        }
      } catch (_) { /* 저장소가 차단돼도 현재 창에서 소리를 설정할 수 있다. */ }
    }
    return { ...this._settings };
  },

  updateSettings(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || !Object.entries(patch).every(([key, value]) => key === 'enabled' ? typeof value === 'boolean'
        : ['effectsVolume', 'ambienceVolume'].includes(key) && Number.isFinite(value) && value >= 0 && value <= 1)) {
      return { ok: false, reason: '소리 설정이 올바르지 않아요.' };
    }
    this._settings = { ...this.settings, ...patch };
    let persisted = true;
    try {
      const stored = this._readStored(), sound = stored.sound;
      const previous = sound && typeof sound === 'object' && !Array.isArray(sound) ? sound : {};
      localStorage.setItem(this._key, JSON.stringify({ ...stored, sound: { ...previous, ...this._settings } }));
    } catch (_) { persisted = false; }
    this.update(this._lastUpdate);
    return persisted ? { ok: true, persisted: true }
      : { ok: true, persisted: false, reason: '설정을 저장하지 못해 이번 창에서만 적용돼요.' };
  },

  toggleMute() { return this.updateSettings({ enabled: !this.settings.enabled }); },

  init() {
    if (this._registered) return true;
    const target = typeof document !== 'undefined' && typeof document.addEventListener === 'function' ? document
      : typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
    if (!target) return false;
    const unlock = event => {
      if (event.isTrusted !== true || !['click', 'keydown'].includes(event.type)) return;
      this._unlock().catch(() => {});
    };
    target.addEventListener('click', unlock, true);
    target.addEventListener('keydown', unlock, true);
    this._registered = true;
    return true;
  },

  async _unlock() {
    try {
      if (!this._context || this._context.state === 'closed') {
        const Context = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext
          : typeof AudioContext !== 'undefined' ? AudioContext : null;
        if (!Context) return false;
        this._context = new Context();
        this._active.clear(); this._lastPlayed.clear(); this._targets = new WeakMap();
        this._noiseBuffer = null; this._background = null;
        this._master = this._context.createGain(); this._master.connect(this._context.destination);
        this._effects = this._context.createGain(); this._effects.connect(this._master);
        this._ambience = this._context.createGain(); this._ambience.connect(this._master);
        this._master.gain.value = 0; this._ambience.gain.value = 0;
      }
      const ctx = this._context;
      if (ctx.state !== 'running') {
        // Escape 등은 trusted 입력이어도 활성화가 거부되고 Promise가 계속 대기할 수 있다.
        // 다음 실제 클릭에서는 이전 요청과 무관하게 다시 활성화를 요청한다.
        await ctx.resume();
      }
      if (ctx.state !== 'running') return false;
      this.update(this._lastUpdate);
      return true;
    } catch (_) { return false; }
  },

  _ramp(param, target, duration) {
    if (this._targets.get(param) === target) return;
    const now = this._context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + duration);
    this._targets.set(param, target);
  },

  _noise() {
    if (!this._noiseBuffer) {
      const ctx = this._context, buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      // 오디오 설정 때문에 성장·화재의 게임 난수 순서가 달라지지 않게 별도 난수를 사용한다.
      let seed = 0x6d2b79f5;
      for (let i = 0; i < data.length; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        data[i] = (seed >>> 0) / 4294967296 * 2 - 1;
      }
      this._noiseBuffer = buffer;
    }
    return this._noiseBuffer;
  },

  _finish(effect) {
    if (effect.finished) return;
    effect.finished = true;
    for (const node of effect.nodes) { try { node.disconnect(); } catch (_) { /* 이미 종료된 노드 */ } }
    this._active.delete(effect);
  },

  _voice(effect, { type = 'sine', frequency = 440, to, duration = .1, offset = 0, volume = .1, noise = false, cutoff = 1000, siren = false }) {
    const ctx = this._context, start = ctx.currentTime + offset, end = start + duration;
    const source = noise ? ctx.createBufferSource() : ctx.createOscillator(), gain = ctx.createGain();
    effect.nodes.push(source, gain);
    if (noise) {
      source.buffer = this._noise();
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff;
      effect.nodes.push(filter); source.connect(filter); filter.connect(gain);
    } else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, start);
      if (siren) {
        source.frequency.linearRampToValueAtTime(1100, start + duration / 3);
        source.frequency.linearRampToValueAtTime(frequency, start + duration * 2 / 3);
      } else if (to !== undefined) source.frequency.linearRampToValueAtTime(to, end);
      source.connect(gain);
    }
    gain.connect(this._effects);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(.012, duration / 4));
    gain.gain.linearRampToValueAtTime(0, end);
    effect.pending++;
    source.onended = () => { if (--effect.pending === 0) this._finish(effect); };
    source.start(start); source.stop(end + .005);
    effect.end = Math.max(effect.end, end + .005);
  },

  play(kind, { count = 1 } = {}) {
    const ctx = this._context, settings = this.settings;
    if (!ctx || ctx.state !== 'running' || !settings.enabled || settings.effectsVolume === 0
      || !['road', 'zone', 'build', 'bulldoze', 'funds', 'reward', 'fire', 'disaster', 'ui'].includes(kind)) return false;
    const now = ctx.currentTime;
    for (const effect of this._active) if (effect.end <= now) this._finish(effect);
    if (this._active.size >= 6 || now - (this._lastPlayed.get(kind) ?? -Infinity) + 1e-9 < .05) return false;
    const effect = { nodes: [], pending: 0, end: now, finished: false };
    this._active.add(effect);
    try {
      const voice = options => this._voice(effect, options);
      if (kind === 'road') voice({ type: 'triangle', frequency: 1400, to: 800, duration: .035 + Math.min(24, Math.max(0, Number.isFinite(count) ? count - 1 : 0)) * .004, volume: .08 });
      else if (kind === 'zone') voice({ frequency: 440, to: 220, duration: .11, volume: .09 });
      else if (kind === 'build') {
        voice({ type: 'triangle', frequency: 160, to: 90, duration: .065 });
        voice({ type: 'triangle', frequency: 180, to: 90, duration: .065, offset: .09 });
      } else if (kind === 'bulldoze') voice({ noise: true, cutoff: 1200, duration: .22, volume: .18 });
      else if (kind === 'funds') voice({ type: 'sawtooth', frequency: 90, duration: .22, volume: .08 });
      else if (kind === 'reward') [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => voice({ frequency, offset: i * .07, duration: .14 }));
      else if (kind === 'fire') voice({ frequency: 650, duration: .6, volume: .09, siren: true });
      else if (kind === 'disaster') {
        voice({ noise: true, cutoff: 150, duration: .8, volume: .18 });
        voice({ frequency: 45, duration: .8, volume: .08 });
      } else voice({ frequency: 880, duration: .025, volume: .025 });
      this._lastPlayed.set(kind, now);
      return true;
    } catch (_) { this._finish(effect); return false; }
  },

  _startBackground() {
    const ctx = this._context, pad = ctx.createGain(), noise = ctx.createBufferSource();
    pad.gain.value = .025; pad.connect(this._ambience);
    const oscillators = [0, 1, 2].map(() => {
      const oscillator = ctx.createOscillator(); oscillator.type = 'sine'; oscillator.connect(pad); oscillator.start(); return oscillator;
    });
    const filter = ctx.createBiquadFilter(), noiseGain = ctx.createGain();
    filter.type = 'lowpass'; filter.frequency.value = 400; noiseGain.gain.value = 0;
    noise.buffer = this._noise(); noise.loop = true;
    noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(this._ambience); noise.start();
    this._background = { oscillators, noiseGain, started: ctx.currentTime, chord: -1 };
  },

  update({ paused = true, population = 0, night = 0 } = {}) {
    this._lastUpdate = { paused: !!paused, population: Number.isFinite(population) ? Math.max(0, population) : 0,
      night: Number.isFinite(night) ? Math.max(0, Math.min(.45, night)) : 0 };
    const ctx = this._context;
    if (!ctx || ctx.state !== 'running') return;
    const settings = this.settings;
    try {
      this._ramp(this._master.gain, settings.enabled ? 1 : 0, .03);
      this._ramp(this._effects.gain, settings.effectsVolume, .03);
      if (settings.enabled && settings.ambienceVolume > 0 && !this._background) this._startBackground();
      this._ramp(this._ambience.gain, settings.enabled && !paused ? settings.ambienceVolume : 0, .5);
      if (!this._background) return;
      const bg = this._background, chords = [[130.81, 164.81, 196], [110, 130.81, 164.81], [87.31, 110, 130.81], [98, 123.47, 146.83]];
      const chord = Math.floor((ctx.currentTime - bg.started) / 8) % chords.length;
      if (chord !== bg.chord) {
        bg.chord = chord;
        bg.oscillators.forEach((oscillator, i) => this._ramp(oscillator.frequency, chords[chord][i], .5));
      }
      this._ramp(bg.noiseGain.gain, .04 * Math.min(1, this._lastUpdate.population / 25000) * (1 - .65 * this._lastUpdate.night / .45), .5);
    } catch (_) { /* 오디오가 중단되거나 지원되지 않아도 시뮬레이션은 계속된다. */ }
  },
};
