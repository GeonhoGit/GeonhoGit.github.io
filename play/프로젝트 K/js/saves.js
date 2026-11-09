// ===== 저장 칸과 브라우저 사이 도시 데이터 이동 =====
const SAVES = {
  _keys: { 1: 'citysim_save_v1', 2: 'citysim_save_slot2', 3: 'citysim_save_slot3', auto: 'citysim_autosave' },
  _preferenceKey: 'citysim_last_slot',
  _lastSlot: 1,
  _preferenceRead: false,
  _cache: new Map(),
  _maxTextLength: 2000000,

  get lastSlot() {
    if (!this._preferenceRead) {
      try {
        const stored = Number(localStorage.getItem(this._preferenceKey));
        if ([1, 2, 3].includes(stored)) this._lastSlot = stored;
        this._preferenceRead = true;
      } catch (_) { /* 저장소를 쓸 수 없으면 기본 수동 칸을 사용한다. */ }
    }
    return this._lastSlot;
  },

  _key(id) {
    if (![1, 2, 3, 'auto'].includes(id)) throw new Error('저장 칸이 올바르지 않습니다.');
    return this._keys[id];
  },

  _remember(id) {
    if (id === 'auto') return;
    this._lastSlot = id; this._preferenceRead = true;
    try { localStorage.setItem(this._preferenceKey, String(id)); } catch (_) { /* 도시 저장 성공은 유지한다. */ }
  },

  list() {
    return [1, 2, 3, 'auto'].map(id => {
      let raw;
      try { raw = localStorage.getItem(this._key(id)); }
      catch (e) { return { id, exists: false, metadata: null, error: '저장 칸을 읽을 수 없어요: ' + e.message }; }
      if (raw === null) { this._cache.delete(id); return { id, exists: false, metadata: null }; }
      const cached = this._cache.get(id);
      if (cached?.raw === raw) return cached.entry;
      let entry;
      try {
        const data = JSON.parse(raw), candidate = parseCity(data);
        const pop = candidate.tiles.reduce((sum, t) => sum + (t.type === 'res' ? ZONE_CAP.res[t.level] : 0), 0);
        entry = { id, exists: true, metadata: { name: candidate.name,
          date: { year: candidate.year, month: candidate.month, day: candidate.day },
          pop, money: candidate.money, savedAt: data.savedAt || 0 } };
      } catch (e) { entry = { id, exists: true, metadata: null, error: '저장 데이터가 손상됐어요: ' + e.message }; }
      // 같은 저장 문자열의 엄격한 지도 검사를 UI 갱신마다 반복하지 않는다.
      this._cache.set(id, { raw, entry });
      return entry;
    });
  },

  save(id = this.lastSlot) {
    try {
      const key = this._key(id), data = { ...serializeCity(), savedAt: Date.now() };
      validateCityRecord(data);
      localStorage.setItem(key, JSON.stringify(data));
      this._cache.delete(id); this._remember(id);
      return { ok: true };
    } catch (e) { return { ok: false, reason: '저장하지 못했어요: ' + e.message }; }
  },

  load(id) {
    try {
      const raw = localStorage.getItem(this._key(id));
      if (raw === null) return { ok: false, reason: '이 칸에는 저장된 도시가 없어요.' };
      parseCity(raw);
      if (!loadCity(raw)) return { ok: false, reason: '도시를 불러오지 못했어요. 현재 도시는 유지됩니다.' };
      this._remember(id);
      return { ok: true };
    } catch (e) { return { ok: false, reason: '불러오지 못했어요: ' + e.message }; }
  },

  remove(id) {
    try {
      localStorage.removeItem(this._key(id));
      this._cache.delete(id);
      return { ok: true };
    } catch (e) { return { ok: false, reason: '저장 칸을 삭제하지 못했어요: ' + e.message }; }
  },

  hasAny() { return this.list().some(entry => entry.exists && !entry.error); },

  loadLatest() {
    const entries = this.list();
    const latest = entries.filter(entry => entry.exists && !entry.error)
      .sort((a, b) => b.metadata.savedAt - a.metadata.savedAt)[0];
    if (!latest) return { ok: false, reason: entries.find(entry => entry.error)?.error || '저장된 도시가 없어요.' };
    return this.load(latest.id);
  },

  exportText() {
    const data = serializeCity();
    parseCity(data);
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const text = 'TILECITY1:' + btoa(binary);
    if (text.length > this._maxTextLength) throw new Error('도시 데이터가 너무 큽니다. 최대 200만 자까지 옮길 수 있어요.');
    return text;
  },

  importText(text) {
    try {
      if (typeof text !== 'string' || !text.trim()) throw new Error('도시 데이터를 붙여넣어 주세요.');
      if (text.length > this._maxTextLength) throw new Error('도시 데이터가 너무 큽니다. 최대 200만 자까지 옮길 수 있어요.');
      let raw = text.trim();
      if (raw.startsWith('TILECITY1:')) {
        const binary = atob(raw.slice(10));
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      }
      parseCity(raw);
      if (!loadCity(raw)) return { ok: false, reason: '도시를 가져오지 못했어요. 현재 도시는 유지됩니다.' };
      return { ok: true };
    } catch (e) { return { ok: false, reason: '가져오지 못했어요: ' + e.message }; }
  },
};
