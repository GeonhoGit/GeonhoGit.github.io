// ===== 한 번의 지도 편집을 묶는 되돌리기 기록 (저장 파일에는 포함하지 않음) =====
const UNDO = {
  fields: ['t', 'tree', 'type', 'root', 'level', 'fire', 'upgrade', 'lanes', 'garbage', 'landfillStored'],
  _undo: [],
  _redo: [],
  _tokens: new WeakSet(),

  _date() {
    if (typeof S === 'undefined' || !S) return NaN;
    const date = S.year * 360 + (S.month - 1) * 30 + S.day - 1;
    return Number.isSafeInteger(date) ? date : NaN;
  },

  _same(tile, values, fields) {
    return !!tile && fields.every((field, j) => Object.is(tile[field], values[j]));
  },

  begin() {
    const day = this._date();
    if (!Number.isFinite(day) || !Number.isFinite(S.money)) return null;
    const fields = [...this.fields];
    const token = { city: S, day, money: S.money, fields,
      tiles: S.tiles.map(t => fields.map(field => t[field])) };
    this._tokens.add(token);
    return token;
  },

  commit(token, label = '지도 편집') {
    if (!token || !this._tokens.has(token)) return { ok: false, reason: '유효한 작업 기록이 없습니다.' };
    this._tokens.delete(token);
    if (token.city !== S || token.tiles.length !== S.tiles.length || token.day !== this._date()) {
      return { ok: false, reason: '도시 또는 날짜가 달라 작업을 기록할 수 없어요.' };
    }
    const cost = token.money - S.money;
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(S.money)) {
      return { ok: false, reason: '작업 비용이 올바르지 않아 기록할 수 없어요.' };
    }
    const changes = [];
    for (let i = 0; i < token.tiles.length; i++) {
      if (!this._same(S.tiles[i], token.tiles[i], token.fields)) {
        changes.push({ i, before: token.tiles[i], after: token.fields.map(field => S.tiles[i][field]) });
      }
    }
    if (!changes.length) return { ok: false, reason: '변경된 칸이 없습니다.' };
    this._undo.push({ city: S, day: token.day, cost, label, fields: token.fields, changes });
    if (this._undo.length > 30) this._undo.shift();
    this._redo.length = 0;
    return { ok: true };
  },

  clear() {
    this._undo.length = this._redo.length = 0;
    this._tokens = new WeakSet();
  },

  _reason(record, redo) {
    if (!record) return redo ? '다시 실행할 작업이 없어요.' : '되돌릴 작업이 없어요.';
    if (record.city !== S) return '다른 도시의 작업은 되돌릴 수 없어요.';
    const elapsed = this._date() - record.day;
    if (!Number.isFinite(elapsed) || elapsed < 0) return '도시 날짜가 달라 되돌릴 수 없어요.';
    if (elapsed >= 30) return '시간이 지나 되돌릴 수 없어요.';
    const expected = redo ? 'before' : 'after';
    if (record.changes.some(change => !this._same(S.tiles[change.i], change[expected], record.fields))) {
      return '그 사이 칸이 성장하거나 바뀌어 작업을 되돌릴 수 없어요.';
    }
    if (!Number.isFinite(S.money) || !Number.isFinite(record.cost) || record.cost < 0
      || !Number.isFinite(S.money + (redo ? -record.cost : record.cost))) return '자금 정보가 올바르지 않아요.';
    if (redo && S.money < record.cost) return '돈이 부족해 다시 실행할 수 없어요.';
    return '';
  },

  view() {
    const undo = this._undo[this._undo.length - 1], redo = this._redo[this._redo.length - 1];
    const undoReason = this._reason(undo, false), redoReason = this._reason(redo, true);
    return { canUndo: !undoReason, canRedo: !redoReason, undoReason, redoReason,
      undoLabel: undo?.label || '', redoLabel: redo?.label || '', undoCount: this._undo.length, redoCount: this._redo.length };
  },

  _write(record, side) {
    for (const change of record.changes) {
      const t = S.tiles[change.i];
      record.fields.forEach((field, j) => { t[field] = change[side][j]; });
      t.noPower = 0;
    }
    S.netDirty = true;
    S.layoutDirty = true;
    S.servicesDirty = true;
  },

  _fail(reason) {
    if (typeof notify === 'function') notify(reason, 'warn');
    return { ok: false, reason };
  },

  _apply(redo) {
    const from = redo ? this._redo : this._undo, to = redo ? this._undo : this._redo;
    const record = from[from.length - 1], reason = this._reason(record, redo);
    if (reason) return this._fail(reason);
    const money = S.money;
    this._write(record, redo ? 'after' : 'before');
    S.money += redo ? -record.cost : record.cost;
    try {
      recomputeAll();
    } catch (e) {
      this._write(record, redo ? 'before' : 'after');
      S.money = money;
      try { recomputeAll(); } catch (_) { /* 현재 기록과 자금은 복원한 채 다음 갱신을 기다린다. */ }
      return this._fail('도시를 다시 계산하지 못해 작업을 유지했어요.');
    }
    from.pop(); to.push(record);
    if (typeof checkSupplyAlerts === 'function') checkSupplyAlerts();
    if (typeof drawMinimap === 'function') drawMinimap();
    if (typeof UI !== 'undefined' && typeof UI.refresh === 'function') UI.refresh();
    return { ok: true };
  },

  undo() { return this._apply(false); },
  redo() { return this._apply(true); },
};
