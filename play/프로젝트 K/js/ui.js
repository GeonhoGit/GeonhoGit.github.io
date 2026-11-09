// ===== UI =====
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('ko-KR');

const TOOL_KEYS = { road: '1', res: '2', com: '3', ind: '4', bulldoze: 'X', inspect: 'Esc' };
// 화면 아래 도구 바에 왼쪽부터 이 순서로 모두 펼쳐 놓는다
const TOOL_CATEGORIES = [
  ['tools', '도구', ['inspect', 'bulldoze']],
  ['infra', '기반', ['road', 'res', 'com', 'ind', 'levee']],
  ['transit', '교통', ['avenue', 'busstop', 'subway']],
  ['util', '전기·수도', ['power', 'solar', 'watertower', 'pump']],
  ['waste', '환경', ['landfill', 'incinerator', 'recycling']],
  ['service', '공공', ['park', 'police', 'fire', 'school', 'hospital', 'stadium']],
  ['special', '발전 시설', ['hotel', 'observation', 'university', 'research', 'logistics', 'advancedFactory']],
];
// 바에 들어갈 짧은 이름 (전체 이름은 설명 카드에 표시)
const TOOL_SHORT = {
  inspect: '살펴보기', bulldoze: '철거', road: '도로', res: '주거', com: '상업', ind: '공업', avenue: '큰길',
  busstop: '버스', subway: '지하철', levee: '제방',
  power: '화력', solar: '태양광', watertower: '급수탑', pump: '양수장',
  landfill: '매립지', incinerator: '소각장', recycling: '재활용',
  park: '공원', police: '경찰서', fire: '소방서', school: '학교', hospital: '병원', stadium: '경기장',
  hotel: '호텔', observation: '전망대', university: '대학', research: '연구소', logistics: '물류', advancedFactory: '첨단공장',
};

const UI = {
  tool: 'inspect',
  speed: 1,
  playing: false,
  difficulty: 'normal',
  timer: 0,
  toolCategory: 'infra',
  _modalStack: [],
  _resumeSpeed: null,

  init() {
    this.buildToolbar();
    this.buildOverlays();
    // 상단 바 높이가 바뀌면(경고 배지 등) 그 아래 패널들의 기준선(--hud-top)을 따라 옮긴다
    const topbar = $('topbar');
    if (topbar && typeof ResizeObserver === 'function' && typeof document.documentElement?.style?.setProperty === 'function') {
      const sync = () => {
        const r = topbar.getBoundingClientRect();
        if (r.height) document.documentElement.style.setProperty('--hud-top', Math.ceil(r.bottom + 8) + 'px');
      };
      new ResizeObserver(sync).observe(topbar);
      if (typeof window.addEventListener === 'function') window.addEventListener('resize', sync);
      sync();
    }
    // 하단 메뉴: 건설·지도 정보는 바 위에 트레이를 펼치고, 예산·도시 운영은 창을 연다
    if ($('tab-build')) $('tab-build').onclick = () => this.toggleTray('build');
    if ($('tab-layers')) $('tab-layers').onclick = () => this.toggleTray('layers');
    this.showTray('build');
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches) {
      $('map-panel').open = false;
    }
    if (typeof GUIDE !== 'undefined') GUIDE.init();
    if (typeof MANAGEMENT !== 'undefined') MANAGEMENT.init();
    // 속도
    $('speed').querySelectorAll('button').forEach(b => b.onclick = () => this.setSpeed(+b.dataset.speed));
    this.initFinance();
    this.initNews();
    this.initDisasters();
    this.initSettings();
    $('btn-budget').onclick = () => this.openBudget();
    $('btn-save').onclick = () => saveGame(false);
    $('btn-menu').onclick = () => this.open('modal-menu');
    $('btn-help').onclick = () => this.open('modal-help');
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.close(b.dataset.close));
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('mousedown', e => {
      if (e.target === m && m.id !== 'modal-start') this.close(m.id);
    }));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !this.hasOpenModal()) return;
      const top = this._modalStack[this._modalStack.length - 1];
      const modal = $(top.id);
      const items = this.modalFocusables(modal);
      const current = items.indexOf(document.activeElement);
      if (!items.length) { e.preventDefault(); modal.focus(); }
      else if (current < 0 || (!e.shiftKey && current === items.length - 1) || (e.shiftKey && current === 0)) {
        e.preventDefault(); items[e.shiftKey ? items.length - 1 : 0].focus();
      }
    });
    $('city-name').onclick = () => {
      const el = $('city-name');
      if (el.querySelector('input')) return;
      const inp = document.createElement('input');
      inp.value = S.name; inp.maxLength = 16; inp.className = 'name-input';
      el.textContent = ''; el.appendChild(inp); inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim(); if (v) S.name = v; el.textContent = S.name; };
      inp.onblur = done;
      inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = S.name; inp.blur(); } };
    };
    $('city-name').addEventListener('keydown', e => {
      if (e.target !== $('city-name') || $('city-name').querySelector('input')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation(); $('city-name').click();
      }
    });
    // 시작 화면
    $('diff').querySelectorAll('button').forEach(b => b.onclick = () => {
      $('diff').querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      this.difficulty = b.dataset.d;
    });
    $('btn-new').onclick = () => {
      const scenario = $('scenario-select')?.value || null;
      const disasterMode = $('disaster-select')?.value || 'rare';
      newGame({ name: $('in-name').value.trim() || '새 도시', difficulty: this.difficulty, scenario, disasterMode });
      if (typeof GUIDE !== 'undefined') GUIDE.reset();
      this.startPlaying();
      const challenge = scenario && typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.view().scenario : null;
      this.toast(challenge ? `🏙️ ${challenge.name} · ${challenge.description} 도시 운영에서 목표를 확인하세요.` : `🏙️ ${S.name}에 오신 것을 환영합니다! 도로부터 깔아 보세요.`, 'good');
    };
    $('btn-continue').onclick = () => { if (loadGame()) { this.startPlaying(); this.toast('📂 불러왔습니다', 'info'); } };
    if (hasSave()) $('btn-continue').classList.remove('hidden');
    $('in-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-new').click(); });
    // 메뉴
    this.initSaves();
    $('m-new').onclick = () => {
      if (hasSave()) $('btn-continue').classList.remove('hidden');
      this.open('modal-start');
      this.close('modal-menu');
    };
    // 세율
    for (const k of ['res', 'com', 'ind']) {
      $('tax-' + k).oninput = e => { S.taxes[k] = +e.target.value; $('tax-' + k + '-v').textContent = S.taxes[k] + '%'; computeStats(); };
    }
    // 미니맵
    const mm = $('minimap');
    const mmMove = e => {
      const r = mm.getBoundingClientRect();
      centerCamera((e.clientX - r.left) / r.width * MAP_W, (e.clientY - r.top) / r.height * MAP_H);
    };
    mm.addEventListener('mousedown', e => { mmMove(e); const mv = ev => mmMove(ev); window.addEventListener('mousemove', mv); window.addEventListener('mouseup', () => window.removeEventListener('mousemove', mv), { once: true }); });
    this.open('modal-start');
  },

  startPlaying() {
    this.playing = true;
    for (const entry of this._modalStack) { $(entry.id).classList.add('hidden'); $(entry.id).inert = false; }
    $('modal-start').classList.add('hidden');
    this._modalStack = [];
    this._resumeSpeed = null;
    R.cars = []; R.particles = []; R.selected = null;
    R.cam.zoom = 1;
    centerCamera(MAP_W / 2, MAP_H / 2);
    if (typeof updateZoomValue === 'function') updateZoomValue();
    drawMinimap();
    this.setSpeed(1);
    this.setTool('road');
    this.refresh();
    $('game').focus();
  },

  hasOpenModal() { return this._modalStack.length > 0; },
  modalFocusables(modal) {
    return Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'))
      .filter(el => el.tabIndex !== -1 && !el.closest('.hidden'));
  },
  focusModal(id, preferred) {
    const modal = $(id);
    const target = preferred && modal.contains(preferred) ? preferred : this.modalFocusables(modal)[0] || modal;
    if (target === modal) modal.setAttribute('tabindex', '-1');
    target.focus();
  },
  open(id) {
    if (this._modalStack.some(entry => entry.id === id)) return;
    if (!this.hasOpenModal()) this._resumeSpeed = this.speed;
    if (id === 'modal-start') this._resumeSpeed = null;
    for (const entry of this._modalStack) $(entry.id).inert = true;
    this._modalStack.push({ id, returnFocus: document.activeElement });
    const modal = $(id);
    modal.inert = false;
    modal.style.zIndex = 1000 + this._modalStack.length;
    modal.classList.remove('hidden');
    this.setSpeed(0);
    if (typeof resetInput === 'function') resetInput();
    else if (typeof input !== 'undefined') {
      input.keys = {}; input.down = false; input.panning = false;
      input.start = null; input.panStart = null; input.camStart = null;
    }
    R.preview = null;
    this.tooltip(0, 0, '');
    this.focusModal(id);
  },
  close(id) {
    if (id === 'modal-save-confirm') this._pendingSave = null;
    if (id === 'modal-transfer') this._importRead = (this._importRead || 0) + 1;
    const index = this._modalStack.findIndex(entry => entry.id === id);
    $(id).classList.add('hidden');
    $(id).inert = false;
    if (index < 0) return;
    const wasTop = index === this._modalStack.length - 1;
    const [entry] = this._modalStack.splice(index, 1);
    const top = this._modalStack[this._modalStack.length - 1];
    if (top) {
      $(top.id).inert = false;
      if (wasTop) this.focusModal(top.id, entry.returnFocus);
    } else {
      if (this._resumeSpeed !== null) this.setSpeed(this._resumeSpeed);
      this._resumeSpeed = null;
      if (entry.returnFocus?.isConnected) entry.returnFocus.focus();
    }
  },
  closeTopModal() {
    const top = this._modalStack[this._modalStack.length - 1];
    if (!top || top.id === 'modal-start') return false;
    this.close(top.id);
    return true;
  },

  initSettings() {
    if ($('m-settings')) $('m-settings').onclick = () => this.openSettings();
    for (const [id, key] of [['setting-day-night', 'dayNight'], ['setting-seasons', 'seasons']]) {
      if ($(id)) $(id).onchange = () => {
        if (typeof AMBIENCE === 'undefined') return;
        const result = AMBIENCE.updateSettings({ [key]: $(id).checked });
        this.updateSettings();
        $('settings-status').textContent = !result.ok || !result.persisted ? result.reason || '설정을 저장할 수 없습니다.' : '설정을 저장했습니다.';
      };
    }
    this.initSoundSettings();
  },
  updateSettings() {
    if (typeof AMBIENCE !== 'undefined') {
      const settings = AMBIENCE.settings;
      if ($('setting-day-night')) $('setting-day-night').checked = settings.dayNight;
      if ($('setting-seasons')) $('setting-seasons').checked = settings.seasons;
    }
    this.updateSoundSettings();
  },
  openSettings() {
    if (typeof AMBIENCE === 'undefined' && typeof SOUND === 'undefined') return;
    this.updateSettings(); $('settings-status').textContent = '';
    this.open('modal-settings');
  },
  initSoundSettings() {
    if (typeof SOUND === 'undefined') return;
    const apply = patch => {
      const result = SOUND.updateSettings(patch);
      this.updateSoundSettings();
      $('settings-status').textContent = !result.ok || !result.persisted ? result.reason || '소리 설정을 저장할 수 없습니다.' : '설정을 저장했습니다.';
    };
    if ($('setting-sound-enabled')) $('setting-sound-enabled').onchange = () => apply({ enabled: $('setting-sound-enabled').checked });
    for (const [id, key] of [['setting-effects-volume', 'effectsVolume'], ['setting-ambience-volume', 'ambienceVolume']]) {
      if ($(id)) $(id).oninput = () => apply({ [key]: Number($(id).value) / 100 });
    }
    if ($('m-sound')) $('m-sound').onclick = () => {
      const result = SOUND.toggleMute(); this.updateSoundSettings();
      if (!result.ok || !result.persisted) this.toast(result.reason || '소리 설정을 저장할 수 없습니다.', 'warn');
    };
    if (!this._soundClickBound && typeof document.addEventListener === 'function') {
      document.addEventListener('click', event => {
        const button = event.target?.closest?.('button');
        if (button && !button.disabled) SOUND.play('ui');
      });
      this._soundClickBound = true;
    }
    this.updateSoundSettings();
  },
  updateSoundSettings() {
    if (typeof SOUND === 'undefined') return;
    const settings = SOUND.settings;
    if ($('setting-sound-enabled')) $('setting-sound-enabled').checked = settings.enabled;
    for (const [prefix, key] of [['effects', 'effectsVolume'], ['ambience', 'ambienceVolume']]) {
      const slider = $('setting-' + prefix + '-volume'), value = Math.round(settings[key] * 100);
      if (slider) { slider.value = String(value); slider.setAttribute('aria-valuetext', value + '%'); }
      if ($('setting-' + prefix + '-value')) $('setting-' + prefix + '-value').textContent = value + '%';
    }
    const button = $('m-sound');
    if (button) {
      button.textContent = settings.enabled ? '🔊 소리 켜짐' : '🔇 소리 꺼짐';
      button.setAttribute('aria-pressed', String(settings.enabled));
      button.setAttribute('aria-label', settings.enabled ? '모든 소리 끄기' : '소리 켜기');
      button.title = settings.enabled ? '모든 소리 끄기' : '소리 켜기';
    }
  },

  initDisasters() {
    if ($('m-disasters')) $('m-disasters').onclick = () => this.openDisasters();
    if ($('disaster-mode')) $('disaster-mode').onchange = () => {
      if (!S || typeof DISASTER === 'undefined') return;
      const result = DISASTER.setMode($('disaster-mode').value);
      $('disaster-status').textContent = result.ok ? '재난 설정을 변경했습니다.' : result.reason || '설정을 변경할 수 없습니다.';
    };
    if ($('disaster-trigger')) $('disaster-trigger').onclick = () => {
      if (!S || typeof DISASTER === 'undefined') return;
      const result = DISASTER.trigger($('disaster-kind').value, { manual: true });
      if (!result.ok) { $('disaster-status').textContent = result.reason || '재난을 일으킬 수 없습니다.'; return; }
      this.close('modal-disasters'); this.close('modal-menu'); this.refresh();
      $('game').focus();
    };
  },
  openDisasters() {
    if (!S || typeof DISASTER === 'undefined') return;
    $('disaster-mode').value = S.disasterMode || 'rare';
    $('disaster-status').textContent = '';
    this.updateDisasters();
    this.open('modal-disasters');
  },
  updateDisasters() {
    if (!S || typeof DISASTER === 'undefined' || !$('disaster-active')) return;
    const view = DISASTER.view(), active = [];
    if (view.flood) active.push(`홍수 · ${view.flood.remaining}일 남음`);
    if (view.storm) active.push(`태풍 시설 정지 · ${view.storm.remaining}일 남음`);
    $('disaster-active').textContent = active.join(' / ') || '현재 진행 중인 재난 피해가 없습니다.';
  },

  initNews() {
    if ($('btn-news')) $('btn-news').onclick = () => this.openNews();
    if ($('news-bar')) $('news-bar').onclick = () => {
      const item = typeof NEWS !== 'undefined' ? NEWS.view().latest : null;
      if (item) this.locateNews(item);
    };
    if (typeof window.addEventListener === 'function') window.addEventListener('resize', () => this.updateNews());
    this.updateNews();
  },
  updateNews() {
    const bar = $('news-bar'), badge = $('news-badge'), button = $('btn-news');
    if (!bar || !badge || !button) return;
    const view = S && typeof NEWS !== 'undefined' ? NEWS.view() : { items: [], latest: null, unread: 0 };
    button.disabled = !S || typeof NEWS === 'undefined';
    badge.textContent = String(view.unread); badge.classList.toggle('hidden', !view.unread);
    button.setAttribute('aria-label', `도시 뉴스${view.unread ? ', 읽지 않은 소식 ' + view.unread + '개' : ''}`);
    const latest = view.latest;
    const hidden = !latest || !S || S.stats.pop < 100 || window.innerWidth <= 760 || ($('guide') && !$('guide').classList.contains('hidden'));
    bar.classList.toggle('hidden', hidden);
    if (!latest) { this._newsKey = null; return; }
    $('news-date').textContent = `${latest.year}.${String(latest.month).padStart(2, '0')}`;
    $('news-headline').textContent = latest.title;
    bar.title = `${latest.title} · ${latest.advice}`;
    bar.setAttribute('aria-label', `${latest.title}. ${latest.advice}`);
    const key = `${latest.id}:${latest.title}`;
    if (!hidden) {
      this.fitNewsBar();
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (key !== this._newsKey && !reduced && typeof bar.animate === 'function') bar.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    }
    this._newsKey = key;
  },
  fitNewsBar() {
    const bar = $('news-bar');
    if (!bar || bar.classList.contains('hidden')) return;
    const bounds = bar.getBoundingClientRect(), time = $('time-controls')?.getBoundingClientRect?.();
    const height = bounds.height || 44, width = window.innerWidth, margin = 16, gap = 8;
    const obstacles = ['topbar', 'time-controls', 'right-panel', 'info', 'active-tool', 'zoom-controls', 'bottom-bar', 'tool-dock', 'layer-tray']
      .map(id => $(id)).filter(el => el && !el.classList.contains('hidden') && typeof el.getBoundingClientRect === 'function')
      .map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    for (const top of [...new Set([time?.height ? time.top : bounds.top, time?.height ? time.bottom + gap : bounds.top])]) {
      if (top < margin || top + height > window.innerHeight - margin) continue;
      const blocks = obstacles.filter(r => r.top - gap < top + height && r.bottom + gap > top).sort((a, b) => a.left - b.left);
      const spaces = []; let start = margin;
      for (const r of blocks) {
        const left = Math.max(margin, r.left - gap), right = Math.min(width - margin, r.right + gap);
        if (left > start) spaces.push({ left: start, right: left });
        start = Math.max(start, right);
      }
      if (start < width - margin) spaces.push({ left: start, right: width - margin });
      const slot = spaces.filter(s => s.right - s.left >= 200).sort((a, b) => (b.right - b.left) - (a.right - a.left))[0];
      if (!slot) continue;
      const barWidth = Math.min(460, slot.right - slot.left);
      bar.style.top = top + 'px'; bar.style.width = barWidth + 'px';
      bar.style.left = Math.max(slot.left, Math.min((width - barWidth) / 2, slot.right - barWidth)) + 'px';
      return;
    }
    bar.classList.add('hidden');
  },
  openNews() {
    if (!S || typeof NEWS === 'undefined') return;
    NEWS.markRead();
    const items = NEWS.view().items.slice(0, 30), list = $('news-list');
    const key = JSON.stringify(items);
    if (this._newsListKey !== key) {
      list.innerHTML = '';
      if (!items.length) { const empty = document.createElement('p'); empty.textContent = '아직 도착한 소식이 없습니다. 한 달이 지나면 도시 소식을 전해 드려요.'; list.appendChild(empty); }
      for (const item of items) {
        const article = document.createElement('article'); article.className = 'news-item';
        const date = document.createElement('time'); date.textContent = `${item.year}년 ${item.month}월`; article.appendChild(date);
        const title = document.createElement('h3'); title.textContent = item.title; article.appendChild(title);
        const advice = document.createElement('p'); advice.textContent = item.advice; article.appendChild(advice);
        if (Number.isInteger(item.x) && Number.isInteger(item.y) && inMap(item.x, item.y)) {
          const button = document.createElement('button'); button.textContent = '위치 보기 →'; button.onclick = () => this.locateNews(item); article.appendChild(button);
        }
        list.appendChild(article);
      }
      this._newsListKey = key;
    }
    this.updateNews(); this.open('modal-news');
  },
  locateNews(item) {
    if (!Number.isInteger(item.x) || !Number.isInteger(item.y) || !inMap(item.x, item.y)) { this.openNews(); return; }
    if (typeof NEWS !== 'undefined') NEWS.markRead(item.id);
    this.setTool('inspect'); centerCamera(item.x + 0.5, item.y + 0.5);
    R.selected = { x: item.x, y: item.y }; this.updateInfo();
    this.close('modal-news'); this.updateNews(); $('game')?.focus?.();
  },

  initSaves() {
    const bind = (id, fn) => { if ($(id)) $(id).onclick = fn; };
    bind('m-save', () => this.openSaves());
    bind('m-load', () => this.openSaves());
    for (const [id, mode] of [['m-export','export'], ['m-import','import'], ['saves-export','export'], ['saves-import','import']])
      bind(id, () => this.openTransfer(mode));
    bind('save-confirm-cancel', () => this.close('modal-save-confirm'));
    bind('save-confirm-accept', () => {
      const pending = this._pendingSave;
      if (!pending) return;
      this.close('modal-save-confirm');
      this.performSaveAction(pending.action, pending.id);
    });
    bind('export-copy', () => this.copyCityCode());
    bind('export-download', () => this.downloadCityCode());
    bind('import-load', () => {
      if (typeof SAVES === 'undefined') return;
      const result = SAVES.importText($('import-code').value);
      if (!result.ok) { $('transfer-status').textContent = result.reason || '도시 데이터를 읽을 수 없습니다.'; return; }
      this.startPlaying(); this.toast('📂 도시를 가져왔습니다', 'good');
    });
    if ($('import-file')) $('import-file').onchange = () => this.readCityFile();
  },
  openSaves() {
    if (typeof SAVES === 'undefined') { this.toast('저장 기능을 사용할 수 없습니다.', 'warn'); return; }
    $('saves-status').textContent = '';
    this.fillSaves(); this.open('modal-saves');
  },
  fillSaves() {
    const container = $('save-slots');
    container.innerHTML = '';
    for (const slot of SAVES.list()) {
      const card = document.createElement('article'); card.className = 'save-slot';
      const add = (tag, value, cls) => {
        const el = document.createElement(tag); el.textContent = value;
        if (cls) el.className = cls;
        card.appendChild(el); return el;
      };
      add('h3', slot.id === 'auto' ? '자동 저장' : `저장 칸 ${slot.id}`);
      const meta = slot.metadata;
      if (meta) {
        add('strong', meta.name, 'save-city-name');
        add('p', `${meta.date.year}년 ${meta.date.month}월 ${meta.date.day}일 · ${fmt(meta.pop)}명 · ₩${fmt(meta.money)}`, 'save-meta');
        add('p', meta.savedAt ? `저장 시각 ${new Date(meta.savedAt).toLocaleString('ko-KR')}` : '저장 시각 정보 없음', 'save-meta');
      } else add('p', slot.error || '비어 있는 저장 칸', slot.error ? 'save-error' : 'save-meta');
      const actions = add('div', '', 'save-actions');
      for (const [action, label] of [['save','저장'], ['load','불러오기'], ['remove','삭제']]) {
        if (slot.id === 'auto' && action === 'save') continue;
        const button = document.createElement('button'); button.textContent = label;
        button.dataset.action = action; button.dataset.slot = String(slot.id);
        button.disabled = action === 'save' ? !S || !!slot.error && !slot.exists : !slot.exists || action === 'load' && !!slot.error;
        button.setAttribute('aria-label', `${slot.id === 'auto' ? '자동 저장' : '저장 칸 ' + slot.id} ${label}`);
        button.onclick = () => this.requestSaveAction(action, slot.id);
        if (action === 'remove') button.className = 'danger-action';
        actions.appendChild(button);
      }
      container.appendChild(card);
    }
    $('saves-export').disabled = !S;
  },
  requestSaveAction(action, id) {
    if (typeof SAVES === 'undefined') return;
    const slot = SAVES.list().find(s => s.id === id);
    if (!slot || !['save','load','remove'].includes(action)) return;
    if (action === 'save' && (!S || id === 'auto')) return;
    if (slot.error && !slot.exists) { $('saves-status').textContent = slot.error; return; }
    if ((action === 'save' || action === 'remove') && slot.exists) {
      this._pendingSave = { action, id };
      $('save-confirm-title').textContent = action === 'save' ? '이 저장 칸을 덮어쓸까요?' : '이 저장을 삭제할까요?';
      const label = id === 'auto' ? '자동 저장' : `저장 칸 ${id}`;
      $('save-confirm-message').textContent = `${label} · ${slot.metadata?.name || '손상된 저장 데이터'}${action === 'save' ? ' 대신 현재 도시를 저장합니다. 이전 저장 내용은 사라집니다.' : '을 삭제합니다. 삭제한 저장은 되돌릴 수 없습니다.'}`;
      $('save-confirm-accept').textContent = action === 'save' ? '덮어쓰기' : '삭제';
      this.open('modal-save-confirm'); $('save-confirm-cancel').focus();
      return;
    }
    this.performSaveAction(action, id);
  },
  performSaveAction(action, id) {
    const result = SAVES[action](id);
    if (!result.ok) { $('saves-status').textContent = result.reason || '저장 작업을 완료하지 못했습니다.'; return; }
    if (action === 'load') { this.startPlaying(); this.toast('📂 불러왔습니다', 'good'); return; }
    this.fillSaves();
    $('saves-status').textContent = action === 'save' ? '현재 도시를 저장했습니다.' : '저장을 삭제했습니다.';
  },
  openTransfer(mode) {
    if (typeof SAVES === 'undefined') { this.toast('도시 옮기기 기능을 사용할 수 없습니다.', 'warn'); return; }
    this._importRead = (this._importRead || 0) + 1;
    $('transfer-title').textContent = mode === 'export' ? '도시 내보내기' : '도시 가져오기';
    $('transfer-export').classList.toggle('hidden', mode !== 'export');
    $('transfer-import').classList.toggle('hidden', mode !== 'import');
    $('transfer-status').textContent = '';
    $('export-download').classList.toggle('hidden', typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function');
    if (mode === 'export') {
      $('export-code').value = '';
      try { $('export-code').value = SAVES.exportText(); }
      catch { $('transfer-status').textContent = '도시를 내보낼 수 없습니다. 현재 도시가 있는지 확인하세요.'; }
      $('export-copy').disabled = $('export-download').disabled = !$('export-code').value;
    } else { $('import-code').value = ''; $('import-file').value = ''; }
    this.open('modal-transfer');
  },
  async copyCityCode() {
    const area = $('export-code');
    if (!area.value) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(area.value);
      $('transfer-status').textContent = '복사했습니다. 다른 곳의 도시 가져오기에 붙여넣으세요.';
    } catch {
      area.focus(); area.select();
      $('transfer-status').textContent = '자동 복사를 사용할 수 없습니다. 선택된 내용을 Ctrl+C 또는 ⌘C로 직접 복사하세요.';
    }
  },
  downloadCityCode() {
    if (!$('export-code').value) return;
    let url, link;
    try {
      url = URL.createObjectURL(new Blob([$('export-code').value], { type: 'text/plain;charset=utf-8' }));
      link = document.createElement('a'); link.href = url;
      link.download = `tilecity-${String(S?.name || 'city').replace(/[\\/:*?"<>|]/g, '_')}.txt`;
      document.body.appendChild(link); link.click();
      $('transfer-status').textContent = '파일 저장을 요청했습니다. 다운로드가 막히면 위 내용을 복사하세요.';
    } catch { $('transfer-status').textContent = '파일을 저장할 수 없습니다. 위 내용을 복사해 보관하세요.'; }
    finally { if (link) link.remove(); if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
  },
  async readCityFile() {
    const file = $('import-file').files?.[0];
    if (!file) return;
    const request = this._importRead = (this._importRead || 0) + 1;
    try {
      if (file.size > 8000000) throw new Error('file too large');
      const content = await file.text();
      if (request !== this._importRead) return;
      $('import-code').value = content;
      $('transfer-status').textContent = '파일을 읽었습니다. 도시 가져오기를 누르면 현재 도시를 바꿉니다.';
    } catch {
      if (request === this._importRead) $('transfer-status').textContent = '파일을 읽을 수 없습니다. 파일 내용을 복사해 아래 입력란에 붙여넣으세요.';
    }
  },

  buildToolbar() {
    const tb = $('toolbar');
    tb.innerHTML = '';
    for (const [cat, name, keys] of TOOL_CATEGORIES) {
      const group = document.createElement('div');
      group.className = 'tool-group'; group.dataset.category = cat;
      group.setAttribute('role', 'group'); group.setAttribute('aria-label', name);
      const label = document.createElement('span');
      label.className = 'tool-group-label'; label.textContent = name;
      group.appendChild(label);
      const row = document.createElement('div');
      row.className = 'tool-row';
      group.appendChild(row);
      for (const k of keys) {
        const d = DEFS[k];
        if (!d) continue;
        const b = document.createElement('button');
        b.className = 'tool'; b.dataset.tool = k; b.dataset.category = cat;
        b.setAttribute('aria-label', d.name);
        b.innerHTML = `<span class="ic">${d.icon}</span><span class="nm">${TOOL_SHORT[k] || d.name}</span>` +
          (TOOL_KEYS[k] ? `<span class="key">${TOOL_KEYS[k]}</span>` : '') +
          (d.cost && k !== 'inspect' ? `<span class="cost">₩${fmt(d.cost)}</span>` : '');
        b.onclick = () => this.setTool(k);
        if (typeof b.addEventListener === 'function') {
          b.addEventListener('mouseenter', () => this.showToolHint(k, b, true));
          b.addEventListener('focus', () => this.showToolHint(k, b, true));
          b.addEventListener('mouseleave', () => this.showToolHint(this.tool));
          b.addEventListener('blur', () => this.showToolHint(this.tool));
        }
        row.appendChild(b);
      }
      tb.appendChild(group);
    }
    this.selectCategory(this.toolCategory);
    // 바가 화면보다 길면(좁은 화면) 양 끝을 흐리게 해 더 있음을 알리고, 휠로 가로 스크롤
    const dock = $('tool-dock');
    if (dock && typeof dock.addEventListener === 'function' && !dock._scrollHint) {
      dock._scrollHint = true;
      const update = () => {
        const max = dock.scrollWidth - dock.clientWidth;
        dock.classList.toggle('more-left', max > 1 && dock.scrollLeft > 2);
        dock.classList.toggle('more-right', max > 1 && dock.scrollLeft < max - 2);
      };
      dock.addEventListener('scroll', update, { passive: true });
      dock.addEventListener('wheel', e => {
        if (dock.scrollWidth <= dock.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        e.preventDefault(); dock.scrollLeft += e.deltaY;
      }, { passive: false });
      if (typeof window.addEventListener === 'function') window.addEventListener('resize', update);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(update);
    }
  },
  // 모든 도구가 항상 보이므로, 카테고리는 선택한 도구가 속한 묶음 표시용
  selectCategory(category) {
    this.toolCategory = category;
    $('toolbar').querySelectorAll('.tool-group').forEach(g => g.classList.toggle('on', g.dataset.category === category));
  },

  // 바 위에 뜨는 설명 카드: 마우스를 올린 도구, 아니면 선택한 도구(살펴보기 제외)를 보여 준다
  showToolHint(k, anchor, hovering) {
    const card = $('active-tool');
    const d = DEFS[k];
    if (!card || !d) return;
    if (this.tray !== undefined && this.tray !== 'build') { card.classList.add('hidden'); return; }
    if (!hovering && k === 'inspect') { card.classList.add('hidden'); document.body?.classList?.remove('hint-open'); return; }
    const category = TOOL_CATEGORIES.find(([, , keys]) => keys.includes(k));
    const locked = S && !isUnlocked(k);
    $('active-tool-group').textContent = (hovering && k !== this.tool ? '' : '선택한 도구 · ') + (category ? category[1] : '');
    const touchUI = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const cancelHint = touchUI ? '두 손가락으로 지도 이동' : '우클릭 취소';
    $('active-tool-name').textContent = d.name + (TOOL_KEYS[k] && !touchUI ? `  [${TOOL_KEYS[k]}]` : '');
    $('active-tool-desc').textContent = d.desc;
    const cost = $('active-tool-cost');
    const treeCost = typeof treeRemovalCost === 'function' ? treeRemovalCost() : 3;
    cost.textContent = locked ? `🔒 ${this.toolLockReason(k)}`
      : k === 'inspect' ? '건물을 눌러 정보 보기 · 드래그로 이동'
      : k === 'bulldoze' ? `건물·도로 ₩${fmt(d.cost)} · 나무 칸당 ₩${fmt(treeCost)} · ${cancelHint}`
      : `기본 ₩${fmt(d.cost)}${d.drag ? ' (칸당)' : ''} · 나무 정리 칸당 ₩${fmt(treeCost)} 별도 · 월 유지비 ₩${d.upkeep.toLocaleString('ko-KR')} · ${cancelHint}`;
    cost.classList.toggle('no', !!locked);
    card.classList.remove('hidden');
    document.body?.classList?.add('hint-open');
    const btn = anchor || [...$('toolbar').querySelectorAll('.tool')].find(b => b.dataset.tool === k);
    const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 0;
    if (btn && typeof btn.getBoundingClientRect === 'function' && vw) {
      const r = btn.getBoundingClientRect();
      const w = (card.getBoundingClientRect && card.getBoundingClientRect().width) || 280;
      // 오른쪽 정보 패널은 가리지 않도록 그 왼쪽까지만
      const rp = $('right-panel')?.getBoundingClientRect?.();
      const maxRight = rp && rp.width ? rp.left - 8 : vw - 8;
      card.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, maxRight - w)) + 'px';
    }
    // 마우스가 없는 작은 화면에서는 고른 도구를 잠깐 보여 주고 접는다
    if (typeof clearTimeout === 'function') clearTimeout(this._hintTimer);
    if (!hovering && vw && vw <= 760 && typeof setTimeout === 'function') this._hintTimer = setTimeout(() => { card.classList.add('hidden'); document.body?.classList?.remove('hint-open'); }, 2500);
  },

  updateLocks() {
    if (!S) return;
    document.querySelectorAll('.tool').forEach(b => {
      const k = b.dataset.tool;
      const lock = !isUnlocked(k);
      b.classList.toggle('locked', lock);
      b.setAttribute('aria-disabled', lock);
      const c = b.querySelector('.cost');
      if (c) c.textContent = lock ? this.toolLockReason(k) : `₩${fmt(DEFS[k].cost)}`;
      b.title = '';  // 설명은 바 위 카드로 보여 준다
      b.setAttribute('aria-label', DEFS[k].name + (lock ? ` (잠김: ${this.toolLockReason(k)})` : ''));
    });
  },
  toolLockReason(k) {
    return (typeof DEVELOPMENT !== 'undefined' && DEVELOPMENT.lockReason(k)) || `인구 ${fmt(DEFS[k].unlock)}명 필요`;
  },

  buildOverlays() {
    const ov = $('overlays');
    for (const [k, n] of OVERLAYS) {
      const b = document.createElement('button');
      b.textContent = n; b.dataset.ov = k;
      if (k === 'none') b.classList.add('on');
      b.onclick = () => this.setOverlay(k);
      ov.appendChild(b);
    }
  },
  setOverlay(k) {
    R.overlay = k;
    $('overlays').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.ov === k));
    // 트레이가 닫혀 있어도 지금 켜진 지도가 무엇인지 하단 탭에 표시
    const cur = $('layer-current');
    if (cur) {
      const name = k !== 'none' ? (OVERLAYS.find(([key]) => key === k) || [])[1] || '' : '';
      cur.textContent = name;
      cur.classList?.toggle('hidden', !name);
    }
  },

  // 하단 트레이: 'build'(건설 도구) | 'layers'(지도 정보) | null(모두 닫기). 한 번에 하나만 펼친다.
  showTray(name) {
    this.tray = name;
    const trays = { build: ['tab-build', 'tool-dock'], layers: ['tab-layers', 'layer-tray'] };
    for (const [key, [tabId, panelId]] of Object.entries(trays)) {
      const open = key === name;
      $(panelId)?.classList?.toggle('hidden', !open);
      $(tabId)?.classList?.toggle('on', open);
      $(tabId)?.setAttribute?.('aria-pressed', open);
    }
    const body = typeof document !== 'undefined' ? document.body : null;
    if (body?.classList) {
      body.classList.toggle('tray-build', name === 'build');
      body.classList.toggle('tray-layers', name === 'layers');
    }
    if (name !== 'build') { $('active-tool')?.classList?.add('hidden'); body?.classList?.remove('hint-open'); }
    else if (this.tool && this.tool !== 'inspect') this.showToolHint(this.tool);
  },
  toggleTray(name) {
    this.showTray(this.tray === name ? null : name);
  },

  setTool(k) {
    const category = TOOL_CATEGORIES.find(([, , keys]) => keys.includes(k));
    if (!category) return;
    this.selectCategory(category[0]);
    if (!DEFS[k]) return;
    if (S && !isUnlocked(k)) { this.toast(`🔒 ${DEFS[k].name}: ${this.toolLockReason(k)}`, 'warn'); return; }
    this.tool = k;
    document.querySelectorAll('.tool').forEach(b => {
      b.classList.toggle('on', b.dataset.tool === k);
      b.setAttribute('aria-pressed', b.dataset.tool === k);
    });
    const d = DEFS[k];
    if (k !== 'inspect' && this.tray !== 'build') this.showTray('build');
    this.showToolHint(k);
    const sel = [...$('toolbar').querySelectorAll('.tool')].find(b => b.dataset.tool === k);
    if (sel && typeof sel.scrollIntoView === 'function') sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    R.preview = null;
    if (k !== 'inspect') { R.selected = null; $('info').classList.add('hidden'); }
    // 관련 오버레이 자동 전환
    const service = d.serviceKey || (SERVICE_KEYS.includes(k) ? k : null);
    const overlay = d.cat === 'waste' ? 'garbage' : ['busstop', 'subway'].includes(k) ? 'transit'
      : d.powerCap ? 'power' : d.waterCap ? 'water' : ['park', 'stadium'].includes(service) ? 'land' : service;
    if (overlay && OVERLAYS.some(([key]) => key === overlay)) this.setOverlay(overlay);
    else if (k !== 'inspect' && this._autoOv) this.setOverlay('none');
    this._autoOv = !!overlay;
  },

  setSpeed(s) {
    this.speed = s;
    if (s > 0) this.lastSpeed = s;
    $('speed').querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', +b.dataset.speed === s);
      b.setAttribute('aria-pressed', +b.dataset.speed === s);
    });
    $('speed-state').textContent = s === 0 ? '일시정지' : `${s}× 진행 중`;
  },

  // 주기적 갱신
  refresh() {
    if (!S) return;
    const st = S.stats;
    if (!$('city-name').querySelector('input')) $('city-name').textContent = S.name;
    $('city-title').textContent = cityTitle();
    $('s-date').textContent = `${S.year}년 ${S.month}월`;
    const m = $('s-money');
    m.textContent = '₩' + fmt(S.money);
    m.className = S.money < 0 ? 'neg' : '';
    if (S.budget) {
      const dl = S.budget.income - S.budget.expense;
      $('s-delta').textContent = (dl >= 0 ? '+' : '') + fmt(dl);
      $('s-delta').className = dl >= 0 ? 'pos' : 'neg';
    } else {
      $('s-delta').textContent = '';
      $('s-delta').className = '';
    }
    $('s-pop').textContent = fmt(st.pop);
    $('s-happy').textContent = Math.round(st.happiness) + '%';
    $('s-happy').className = st.happiness < 40 ? 'neg' : st.happiness > 65 ? 'pos' : '';
    this.supplyStat('power', st.powerUse, st.powerCap, st.powerNet);
    this.supplyStat('water', st.waterUse, st.waterCap, st.waterNet);
    for (const k of ['res', 'com', 'ind']) {
      const v = st.demand[k];
      const el = $('d-' + k);
      const h = Math.abs(v) * 50;
      el.style.height = h + '%';
      el.style.top = v >= 0 ? (50 - h) + '%' : '50%';
      el.style.background = v >= 0 ? { res: '#4cc85a', com: '#3d8fe6', ind: '#e6b229' }[k] : '#c0504d';
    }
    this.updateLocks();
    this.updateInfo();
    if (!$('modal-budget').classList.contains('hidden')) this.fillBudget();
    if (typeof GUIDE !== 'undefined') GUIDE.update();
    this.updateNews();
    if ($('modal-disasters') && !$('modal-disasters').classList.contains('hidden')) this.updateDisasters();
    if (typeof MANAGEMENT !== 'undefined') MANAGEMENT.refresh();
    this.fitToasts();
  },

  supplyNumber(value) {
    return value > 0 && value < 0.1 ? '<0.1' : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  },
  supplyInfo(use, totalCap, net) {
    const demand = net?.demand ?? use ?? 0;
    const cap = net?.linkedCap ?? totalCap ?? 0;
    const short = net?.short || 0, cut = net?.cut || 0;
    const idleSources = net?.idleSources || [];
    const state = short > 0 ? 'shortage' : cut > 0 || idleSources.length ? 'disconnected'
      : demand === 0 ? 'idle' : cap > 0 && demand >= cap * 0.9 ? 'tight' : 'ok';
    return {
      demand, cap, short, cut, state, idleSources, targets: net?.targets || [],
      shortfall: net?.shortfall ?? Math.max(0, demand - cap), cutDemand: net?.cutDemand || 0,
      idleCap: net?.idleCap || 0, spare: Math.max(0, cap - demand),
    };
  },
  // 필요량/공급량과 용량 부족/연결 끊김을 구분한다.
  supplyStat(kind, use, totalCap, net) {
    const val = $('s-' + kind), btn = $(kind + '-alert');
    const wrapper = $('stat-' + kind), status = $(kind + '-status'), detail = $(kind + '-detail');
    const info = this.supplyInfo(use, totalCap, net);
    const number = value => this.supplyNumber(value);
    const isPower = kind === 'power';
    const src = isPower ? '발전소' : '급수 시설';
    const disconnected = info.cut > 0 || info.idleSources.length > 0;
    let statusText, detailText, label = '';
    if (info.short > 0) {
      statusText = `${isPower ? '전력' : '물'} ${info.shortfall > 0 ? number(info.shortfall) + ' ' : ''}부족${disconnected ? ' · 미연결' : ''}`;
      detailText = info.idleSources.length ? '도로 연결 먼저 · 부족하면 증설'
        : info.cut > 0 ? `${src} 증설 · 도로 연결 필요` : `${src} 증설 필요`;
      label = `${isPower ? '정전' : '단수'} ${fmt(info.short)}곳 · 위치 보기`;
    } else if (info.cut > 0) {
      statusText = isPower ? '전력 연결 끊김' : '수도 연결 끊김';
      detailText = info.idleSources.length ? `도로 연결 필요 · ${src}도 미연결` : '도로 연결 필요';
      label = `미연결 ${fmt(info.cut)}곳 · 위치 보기`;
    } else if (info.idleSources.length) {
      statusText = isPower ? '발전소 미연결' : '급수시설 미연결';
      detailText = '도로 연결 필요';
      label = `미연결 ${fmt(info.idleSources.length)}개 · 위치 보기`;
    } else {
      statusText = info.state === 'tight' ? '여유 적음' : info.state === 'idle' ? '공급 대기' : '공급 정상';
      detailText = info.state === 'idle' ? '공급 시설과 구역을 연결하세요' : `여유 ${number(info.spare)}`;
    }
    if (val) {
      val.textContent = `${number(info.demand)}/${number(info.cap)}`;
      val.className = info.state === 'shortage' ? 'neg' : ['disconnected', 'tight'].includes(info.state) ? 'warn-text' : '';
    }
    if (status && status.textContent !== statusText) status.textContent = statusText;
    if (detail && detail.textContent !== detailText) detail.textContent = detailText;
    if (wrapper) for (const state of ['shortage', 'disconnected', 'tight', 'ok', 'idle']) {
      wrapper.classList.toggle('supply-' + state, info.state === state);
    }
    if (!btn) return;
    btn.classList.toggle('hidden', !label);
    btn.classList.toggle('severe', info.short > 0);
    if (!label) {
      btn.onclick = null; btn.title = ''; btn.textContent = '';
      btn.setAttribute('aria-label', '');
      if (this._alertIdx) delete this._alertIdx[kind];
      return;
    }
    if (btn.textContent !== label) btn.textContent = label;
    const lines = [`${isPower ? '전력' : '물'} 필요 ${number(info.demand)} / 연결 공급 ${number(info.cap)}`];
    if (info.short) lines.push(`용량 부족 ${number(info.shortfall)} · ${fmt(info.short)}곳 ${isPower ? '정전' : '단수'}`);
    if (info.cut) lines.push(`공급망 미연결 ${fmt(info.cut)}곳 · 필요 ${number(info.cutDemand)}`);
    if (info.idleSources.length) lines.push(`미연결 ${src} ${fmt(info.idleSources.length)}개 · 미사용 공급 ${number(info.idleCap)}`);
    lines.push(detailText);
    btn.setAttribute('aria-label', lines.join('. ') + '. 위치 보기');
    lines.push('누를 때마다 해당 위치로 이동합니다');
    btn.title = lines.join('\n');
    btn.onclick = () => {
      const list = [...new Set([...info.targets, ...info.idleSources])];
      if (!list.length) return;
      this._alertIdx = this._alertIdx || {};
      const k = (this._alertIdx[kind] = ((this._alertIdx[kind] ?? -1) + 1) % list.length);
      const i = list[k], x = i % MAP_W, y = (i / MAP_W) | 0;
      this.setTool('inspect');
      centerCamera(x + 0.5, y + 0.5);
      R.selected = { x, y };
      this.setOverlay(kind);
      this.updateInfo();
    };
  },

  updateInfo() {
    const el = $('info');
    const sel = R.selected || (this.tool === 'inspect' ? R.hover : null);
    if (!sel || !inMap(sel.x, sel.y)) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const i = idx(sel.x, sel.y);
    const t = S.tiles[i];
    const disaster = typeof DISASTER !== 'undefined' ? DISASTER.tileStatus(i) : { floodDays: 0, stormDays: 0, stopped: false };
    const stoppedReason = disaster.floodDays ? `침수로 운영 중지 (${disaster.floodDays}일 남음)` : `태풍으로 운영 중지 (${disaster.stormDays}일 남음)`;
    const bar = (label, v, color) => `<div class="row"><span>${label}</span><span>${Math.round(v)}</span></div><div class="bar"><i style="width:${Math.min(100, v)}%;background:${color}"></i></div>`;
    const yn = (b, y, n) => b ? `<span class="ok">${y}</span>` : `<span class="no">${n}</span>`;
    let html = '';
    if (!t.type) {
      const ter = t.t === TERRAIN.WATER ? '🌊 물' : t.t === TERRAIN.SAND ? '🏖️ 모래사장' : t.tree ? '🌲 숲' : '🌱 풀밭';
      html += `<h4>${ter}</h4>`;
    } else if (t.type === 'rubble') {
      html += `<h4>🧱 잔해</h4><div class="desc">화재·재난으로 무너진 건물입니다. 철거 도구로 치우세요.</div>`;
    } else {
      const root = rootOf(i);
      const d = t.type === 'road' && t.lanes === 2 ? DEFS.avenue
        : typeof facilityDefinition === 'function' ? facilityDefinition(S.tiles[root], root) : DEFS[t.type];
      const transit = t.type === 'busstop' || t.type === 'subway';
      const wasteFacility = d.cat === 'waste';
      const lvName = ['빈 구역', '저밀도', '중밀도', '고밀도'];
      html += `<h4>${d.icon} ${d.name}${d.zone ? ` · ${lvName[t.level]}` : ''}${t.type === 'road' && t.t === TERRAIN.WATER ? ' (다리)' : ''}</h4>`;
      if (d.zone) {
        if (t.type === 'res') {
          html += `<div class="row"><span>거주 인구</span><span>${ZONE_CAP.res[t.level]}명</span></div>`;
          html += `<div class="row"><span>출근 경로 혼잡</span><span>${fmt(t.commuteTraffic || 0)}%</span></div>`;
        }
        else html += `<div class="row"><span>일자리</span><span>${ZONE_CAP[t.type][t.level]}개</span></div>`;
        html += `<div class="row"><span>도로 연결</span>${yn(t.road, '있음', '없음 (2칸 이내 필요)')}</div>`;
      }
      if (t.type === 'road') {
        const capacity = typeof TRAFFIC !== 'undefined' ? TRAFFIC.capacity(t) : t.lanes === 2 ? 750 : 300;
        html += `<div class="row"><span>통행량 / 수용량</span><span>${fmt(t.trafficLoad || 0)} / ${fmt(capacity)}명</span></div>`;
        html += `<div class="row"><span>혼잡도</span><span>${fmt(t.traffic || 0)}%</span></div>`;
      }
      if (t.type !== 'road' && t.type !== 'park' && t.type !== 'levee' && !transit && !wasteFacility) {
        html += `<div class="row"><span>전기</span>${d.powerCap ? yn(!disaster.stopped, `공급 ${d.powerCap}`, '공급 중지') : yn(t.powered, '공급됨', '없음')}</div>`;
        html += `<div class="row"><span>물</span>${d.waterCap ? yn(!disaster.stopped, `공급 ${d.waterCap}`, '공급 중지') : yn(t.watered, '공급됨', '없음')}</div>`;
      }
      if (transit) {
        const station = S.tiles[root];
        const operating = station.transitOperating === true;
        let reason = '운행 중지';
        if (disaster.stopped) reason = stoppedReason;
        else if (station.transitOperating === undefined) reason = '운행 정보 계산 대기';
        else if (station.fire) reason = '화재로 운행 중지';
        else if (t.type === 'busstop') reason = '인접 도로 필요';
        else if (!station.road) reason = '도로 연결 필요';
        else if (!station.powered) reason = '전력 공급 필요';
        else if (!(station.transitConnected > 0)) reason = '다른 운영 가능한 역 필요';
        const users = Number.isFinite(station.transitUsage) ? Math.max(0, station.transitUsage) : 0;
        html += `<div class="row"><span>운영 상태</span>${yn(operating && !disaster.stopped, '운행 중', reason)}</div>`;
        html += `<div class="row"><span>도로 연결</span>${yn(station.road, '있음', '없음')}</div>`;
        if (t.type === 'subway') html += `<div class="row"><span>전기</span>${yn(station.powered, '공급됨', '없음')}</div>`;
        html += `<div class="row"><span>하루 평균 이용객</span><span>${(users / 30).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}명</span></div>`;
        html += `<div class="row"><span>월 승하차 이용자</span><span>${fmt(users)}명</span></div>`;
        html += `<div class="row"><span>${t.type === 'subway' ? '연결된 다른 역' : '같은 도로망 정류장'}</span><span>${fmt(station.transitConnected || 0)}개</span></div>`;
      }
      if (wasteFacility) {
        const facility = S.tiles[root];
        const reason = disaster.stopped ? stoppedReason : facility.wasteReason || (facility.wasteOperating === undefined ? '처리 정보 계산 대기' : '운영 중지');
        html += `<div class="row"><span>운영 상태</span>${yn(facility.wasteOperating === true && !disaster.stopped, '운영 중', reason)}</div>`;
        html += `<div class="row"><span>도로 연결</span>${yn(facility.road, '있음', '없음')}</div>`;
        if (d.powerUse) html += `<div class="row"><span>전기</span>${yn(facility.powered, '공급됨', '없음')}</div>`;
        if (t.type === 'landfill') {
          const stored = facility.landfillStored || 0, capacity = d.wasteCapacity;
          const fill = capacity > 0 ? Math.min(100, stored / capacity * 100) : 0;
          html += `<div class="row"><span>매립 저장량</span><span>${fmt(stored)} / ${fmt(capacity)}</span></div>`;
          html += `<div class="row"><span>채움</span><span>${fill.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%</span></div>`;
          if (fill >= 90) html += `<div class="desc no">${fill >= 100 ? '매립지가 가득 찼습니다. 같은 도로망에 새 처리 시설이 필요합니다.' : '용량의 90% 이상 찼습니다. 새 처리 시설을 준비하세요.'}</div>`;
          else if (fill >= 70) html += '<div class="desc">용량의 70% 이상 찼습니다. 재활용·소각 시설이나 새 매립지를 미리 준비하세요.</div>';
        } else html += `<div class="row"><span>월 처리 용량</span><span>${fmt(d.wasteProcess || 0)}</span></div>`;
        html += `<div class="row"><span>이번 달 예상 처리</span><span>${fmt(facility.wasteProcessed || 0)}</span></div>`;
        if (d.pollutionRadius) html += `<div class="row"><span>오염 영향 범위</span><span>${d.pollutionRadius}칸</span></div>`;
      }
      if (t.fire) html += `<div class="row"><span>상태</span><span class="no">🔥 불타는 중!</span></div>`;
      if (d.specialization) html += `<div class="row"><span>도로 연결</span>${yn(S.tiles[root].road, '있음', '없음')}</div>`;
      if (d.comJobs || d.indJobs || d.monthlyIncome) {
        const facility = S.tiles[root];
        const operating = typeof isFacilityOperating === 'function' ? isFacilityOperating(facility, root)
          : facility.fire === 0 && facility.road && (!(d.powerUse > 0) || facility.powered) && (!(d.waterUse > 0) || facility.watered);
        const rate = operating ? Number.isFinite(facility.trafficJobFill)
          ? Math.max(0, Math.min(1, facility.trafficJobFill)) : this.employmentStats().rate : 0;
        if (d.comJobs || d.indJobs) {
          html += `<div class="row"><span>시설 일자리 정원</span><span>${fmt((d.comJobs || 0) + (d.indJobs || 0))}개</span></div>`;
          html += `<div class="row"><span>시설 고용률</span><span>${(rate * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%</span></div>`;
        }
        if (d.monthlyIncome) {
          html += `<div class="row"><span>월 기본 수입 (고용 100%)</span><span>₩${fmt(d.monthlyIncome)}</span></div>`;
          html += `<div class="row"><span>예상 월 운영 수입</span><span>₩${fmt(d.monthlyIncome * rate)}</span></div>`;
          html += '<div class="desc">연결 상태와 고용률 기준 · 정책·특화·이벤트 수입 조정 전</div>';
        }
      }
      if (d.powerUse || d.waterUse) {
        const effects = typeof simulationModifiers === 'function' ? simulationModifiers() : { powerUse: 1, waterUse: 1 };
        const power = (typeof powerUseOf === 'function' ? powerUseOf(S.tiles[root], root) : d.powerUse || 0) * effects.powerUse;
        const water = (typeof waterUseOf === 'function' ? waterUseOf(S.tiles[root], root) : d.waterUse || 0) * effects.waterUse;
        const consumption = value => value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
        html += `<div class="row"><span>전력 · 수도 소비</span><span>${consumption(power)} · ${consumption(water)}</span></div>`;
      }
      if (d.radius) html += `<div class="row"><span>서비스 범위</span><span>${d.radius}칸</span></div>`;
      if (d.upkeep > 0) html += `<div class="row"><span>월 유지비</span><span>₩${d.upkeep.toLocaleString('ko-KR')}</span></div>`;
      if (!d.zone) html += `<div class="desc">${S.tiles[root].upgrade || d.monthlyIncome ? '기본 시설 설명: ' : ''}${d.desc}</div>`;
    }
    if (disaster.floodDays) html += `<div class="desc no">🌊 침수 · ${disaster.floodDays}일 남음${t.type === 'road' ? ' · 통행 불가' : DEFS[t.type]?.zone ? ' · 성장 멈춤' : t.type && t.type !== 'rubble' && disaster.stopped ? ' · 운영 중지' : ''}</div>`;
    if (disaster.stormDays) html += `<div class="desc no">🌀 태풍 · ${disaster.stormDays}일 남음${disaster.stopped ? ' · 운영 중지' : ''}</div>`;
    if (t.t !== TERRAIN.WATER) {
      html += '<div style="margin-top:6px"></div>';
      html += bar('땅값', t.land, '#6fd38a');
      html += bar('오염', t.poll, '#e5484d');
      if (t.type && t.type !== 'road' && t.type !== 'rubble' && t.type !== 'levee') {
        const garbage = Math.max(0, Math.min(100, S.tiles[rootOf(i)].garbage || 0));
        html += bar('쌓인 쓰레기', garbage, '#d5ad60');
        if (garbage >= 70 && DEFS[t.type]?.zone) html += '<div class="desc no">쓰레기가 70 이상 쌓여 성장이 멈췄습니다. 같은 도로망에 처리 시설을 연결하세요.</div>';
      }
      if (t.crime > 0) html += bar('범죄', t.crime, '#a855f7');
      const covs = SERVICE_KEYS.filter(k => k !== 'park' && S.cov[k][i] > 0).map(k => DEFS[k].icon).join(' ');
      if (covs) html += `<div class="row"><span>서비스</span><span>${covs}</span></div>`;
    }
    html += `<div class="desc" style="opacity:.6">(${sel.x}, ${sel.y})</div>`;
    if (R.selected && typeof MANAGEMENT !== 'undefined') html += MANAGEMENT.upgradeMarkup();
    if (this._infoHTML !== html) { el.innerHTML = html; this._infoHTML = html; }
  },

  employmentStats() {
    const st = S.stats;
    const capacity = (st.comJobs || 0) + (st.indJobs || 0);
    const workers = st.workers ?? (st.pop || 0) * 0.55;
    const rate = st.jobFillRate ?? (capacity > 0 ? Math.min(1, workers / capacity) : 0);
    const com = st.employedCom ?? (st.comJobs || 0) * rate;
    const ind = st.employedInd ?? (st.indJobs || 0) * rate;
    return { rate, com, ind, missing: Math.max(0, capacity - com - ind) };
  },
  openBudget() {
    for (const k of ['res', 'com', 'ind']) { $('tax-' + k).value = S.taxes[k]; $('tax-' + k + '-v').textContent = S.taxes[k] + '%'; }
    this.fillBudget();
    this.open('modal-budget');
  },
  initFinance() {
    if ($('finance-emergency')) $('finance-emergency').onclick = () => {
      if (typeof FINANCE === 'undefined') return;
      const result = FINANCE.emergency();
      if (!result.ok) { $('finance-crisis-status').textContent = result.reason || '긴급 채권을 발행할 수 없습니다.'; return; }
      this.close('modal-finance-crisis'); this.toast('🏦 긴급 채권을 발행했습니다', 'info');
    };
    if ($('finance-review')) $('finance-review').onclick = () => {
      const origin = this._modalStack.find(entry => entry.id === 'modal-finance-crisis')?.returnFocus;
      this.openBudget(); this.close('modal-finance-crisis');
      const budget = this._modalStack.find(entry => entry.id === 'modal-budget');
      if (budget && origin) budget.returnFocus = origin;
    };
    if ($('finance-continue')) $('finance-continue').onclick = () => this.close('modal-finance-crisis');
  },
  financeMoney(n) { return '₩' + (Number.isFinite(n) ? n : 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 }); },
  fillFinance() {
    const panel = $('finance-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', typeof FINANCE === 'undefined');
    if (typeof FINANCE === 'undefined') return;
    const view = FINANCE.view(), key = JSON.stringify(view);
    if (this._financeKey === key) return;
    this._financeKey = key;
    const money = n => this.financeMoney(n);
    $('finance-summary').textContent = `남은 원금 ${money(view.outstanding)} · 총 한도 ${money(view.limit)} · 추가 가능 ${money(view.remaining)} · 발행 ${3 - view.available} / 3건 · 월 상환 ${money(view.monthlyPayment)} · 순자산 ${money(view.netAssets)} (자금 − 남은 채권 원금)`;
    const offers = $('finance-offers'); offers.innerHTML = '';
    for (const offer of view.offers) {
      const button = document.createElement('button');
      button.textContent = `${money(offer.amount)} 발행 · 월 ${money(offer.payment)}`;
      button.disabled = !offer.allowed; button.title = offer.reason || '연 6% · 60개월 원리금 균등 상환';
      button.onclick = () => this.financeAction('borrow', offer.amount);
      offers.appendChild(button);
    }
    const loans = $('finance-loans'); loans.innerHTML = '';
    if (!view.loans.length) { const empty = document.createElement('p'); empty.className = 'finance-note'; empty.textContent = '상환 중인 채권이 없습니다.'; loans.appendChild(empty); }
    for (const loan of view.loans) {
      const card = document.createElement('article'); card.className = 'finance-loan';
      const title = document.createElement('strong'); title.textContent = `${money(loan.principal)} 채권 · 연 ${fmt(loan.rate * 100)}%`; card.appendChild(title);
      const detail = document.createElement('p'); detail.textContent = `남은 원금 ${money(loan.remaining)} · ${loan.months}개월 · 월 ${money(loan.payment)}`; card.appendChild(detail);
      const parts = document.createElement('p'); parts.textContent = `다음 상환: 원금 ${money(loan.nextPrincipal)} + 이자 ${money(loan.nextInterest)}`; card.appendChild(parts);
      const button = document.createElement('button'); button.textContent = `조기 상환 ${money(loan.remaining)}`;
      button.disabled = !loan.canRepay; button.title = loan.reason || '남은 원금 전액 상환 · 수수료 없음';
      button.onclick = () => this.financeAction('repay', loan.id); card.appendChild(button);
      loans.appendChild(card);
    }
  },
  financeAction(action, value) {
    if (typeof FINANCE === 'undefined') return;
    const result = FINANCE[action](value);
    $('finance-status').textContent = result.ok ? action === 'borrow' ? '채권을 발행했습니다.' : '채권을 조기 상환했습니다.'
      : result.reason || '채권 작업을 완료하지 못했습니다.';
    this.fillFinance();
  },
  openFinanceCrisis() {
    if (!S || typeof FINANCE === 'undefined') return false;
    const view = FINANCE.view(), offer = view.emergency;
    $('finance-crisis-summary').textContent = `현재 자금 ${this.financeMoney(S.money)} · 남은 채권 원금 ${this.financeMoney(view.outstanding)}`;
    $('finance-emergency-info').textContent = `긴급 채권 ${this.financeMoney(offer.amount)} · 연 ${fmt(offer.rate * 100)}% · 60개월 · 월 ${this.financeMoney(offer.payment)} 상환. ${offer.allowed ? '발행하면 자금을 약 ₩2,000으로 회복합니다.' : offer.reason + ' 세율과 지출을 점검하거나 그대로 계속할 수 있습니다.'}`;
    $('finance-emergency').disabled = !offer.allowed;
    $('finance-emergency').title = offer.reason || '일반 채권보다 이자율이 높습니다.';
    $('finance-crisis-status').textContent = '';
    this.open('modal-finance-crisis');
    return true;
  },
  fillBudget() {
    const b = S.budget;
    const rows = [];
    const names = { road: '🛣️ 도로 유지', admin: '🏛️ 도시 행정비', fuel: '⛽ 화력 발전 연료비', waterOps: '💧 정수 운영비', wasteOps: '🚛 쓰레기 처리비', services: '🧑‍🚒 공공 서비스 운영비', civic: '정책·이벤트 운영', policy: '운영 정책', event: '도시 이벤트', loans: '🏦 채권 상환' };
    // 시나리오는 첫 결산 전에도 시작 시점의 월 예산을 제공합니다.
    const period = S.history.length ? '지난달' : '시작 시점';
    if ($('budget-period')) $('budget-period').textContent = b ? `${period} 수입·지출` : '월 수입·지출';
    if (b) {
      rows.push(['🏠 주거세', b.incRes], ['🏪 상업세', b.incCom], ['🏭 공업세', b.incInd]);
      if (b.incTransit !== undefined) rows.push(['🚌 대중교통 요금', b.incTransit]);
      if (b.incFacilities) rows.push(['▥ 시설 운영 수입', b.incFacilities]);
      if (b.incBonus) rows.push(['정책·특화·이벤트 수입 조정', b.incBonus]);
      for (const k in b.exp) if (b.exp[k] > 0) rows.push([names[k] || (DEFS[k] ? `${DEFS[k].icon} ${DEFS[k].name}` : k.replace(/[<>&"']/g, '')), -b.exp[k],
        k === 'loans' ? `원금 ₩${fmt(b.loanPrincipal || 0)} · 이자 ₩${fmt(b.loanInterest || 0)}` : '']);
      const html = rows.map(([n, v, detail]) => `<tr${detail ? ` title="${detail}"` : ''}><td>${n}</td><td class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : ''}${fmt(v)}</td></tr>`).join('')
        + `<tr class="total"><td>합계</td><td class="${b.income - b.expense >= 0 ? 'pos' : 'neg'}">${fmt(b.income - b.expense)}</td></tr>`;
      $('budget-table').innerHTML = html;
    } else $('budget-table').innerHTML = '<tr><td>첫 달이 지나면 표시됩니다</td><td></td></tr>';
    const st = S.stats;
    const employment = this.employmentStats();
    const transit = S.transit || {};
    const transitShare = transit.totalCommuters > 0 ? Math.min(100, (transit.users || 0) / transit.totalCommuters * 100) : 0;
    const waste = S.waste || {};
    const currentWaste = waste.currentProcessed ?? Math.min(waste.generated || 0, waste.processed || 0);
    const wasteRate = Number.isFinite(waste.currentRate) ? Math.max(0, Math.min(1, waste.currentRate))
      : waste.generated > 0 ? currentWaste / waste.generated : 1;
    const collectedBacklog = waste.backlogProcessed ?? Math.max(0, (waste.processed || 0) - currentWaste);
    if ($('budget-advice')) {
      const largest = b && Object.keys(b.exp).filter(k => b.exp[k] > 0).sort((a, c) => b.exp[c] - b.exp[a])[0];
      let advice;
      if (S.traffic?.failed > 0 && (st.comJobs || 0) + (st.indJobs || 0) >= S.traffic.workers)
        advice = `현재 ${fmt(S.traffic.failed)}명이 출근하지 못합니다: 주거지와 직장의 도로 연결을 확인하고, 가까운 곳에 일자리를 마련하세요.`;
      else if (employment.missing >= 1) advice = `현재 근로자 ${fmt(Math.ceil(employment.missing))}명 부족: 상업·공업 수입은 실제 근로자 기준이므로 주거지 성장이 필요합니다.`;
      else if (st.pop > 0 && st.unemployment >= 0.1) advice = `현재 실업률 ${Math.round(st.unemployment * 100)}%: 상업·공업 구역을 늘려 일자리를 마련하세요.`;
      else if (!st.pop) advice = '현재 주민이 없습니다: 도로·전력에 연결한 주거지에 주민이 들어와야 세입이 생깁니다.';
      else if (largest) advice = `${period} 가장 큰 월 지출은 ${names[largest] || DEFS[largest]?.name || largest} ₩${fmt(b.exp[largest])}입니다.`;
      else advice = b ? '현재 인력 수급은 안정적입니다: 월 수입과 유지비를 함께 확인하세요.' : '첫 달이 지나면 수입과 유지비를 확인할 수 있습니다.';
      $('budget-advice').textContent = advice;
    }
    $('city-table').innerHTML = [
      ['인구', fmt(st.pop) + '명'],
      ['일자리 정원 (상업/공업)', `${fmt(st.comJobs)} / ${fmt(st.indJobs)}`],
      ['실제 고용 (상업/공업)', `${fmt(employment.com)} / ${fmt(employment.ind)}`],
      ['부족 인력', fmt(employment.missing) + '명'],
      ['실업률', Math.round(st.unemployment * 100) + '%'],
      ['행복도', Math.round(st.happiness) + '%'],
      ['교통·쓰레기 갱신', S.servicesDirty ? '성장·계절 변경 · 월말 갱신 예정' : '현재 배치 반영'],
      ['평균 출근 혼잡도', fmt(S.traffic?.avgCongestion || 0) + '%'],
      ['출근 실패 인원', fmt(S.traffic?.failed || 0) + '명'],
      ['대중교통 이용자 / 전체 출근자', `${fmt(transit.users || 0)} / ${fmt(transit.totalCommuters || 0)}명 (${fmt(transitShare)}%)`],
      ['버스 / 지하철 이용자', `${fmt(transit.busUsers || 0)} / ${fmt(transit.subwayUsers || 0)}명`],
      ['쓰레기 이번 달 발생분 처리율', fmt(wasteRate * 100) + '%'],
      ['쓰레기 예상 발생 / 당월분 처리', `${fmt(waste.generated || 0)} / ${fmt(currentWaste)}`],
      ['밀린 쓰레기', fmt(waste.backlog || 0)],
      ['밀린 쓰레기 예상 수거', fmt(collectedBacklog)],
      ['매립지 잔여 용량 (전체)', fmt(waste.landfillRemaining || 0)],
      ['전력', this.supplyText(st.powerUse, st.powerCap, st.powerNet)],
      ['물', this.supplyText(st.waterUse, st.waterCap, st.waterNet)],
      ['다음 목표', S.milestone < MILESTONES.length ? `${MILESTONES[S.milestone].title} (인구 ${fmt(MILESTONES[S.milestone].pop)})` : '모두 달성!'],
    ].map(([a, v]) => `<tr><td>${a}</td><td>${v}</td></tr>`).join('');
    this.drawChart();
    this.fillFinance();
  },
  supplyText(use, cap, net) {
    const info = this.supplyInfo(use, cap, net);
    const number = value => this.supplyNumber(value);
    let t = `필요 ${number(info.demand)} / 공급 ${number(info.cap)}`;
    if (info.short) t += ` · 용량 부족 ${number(info.shortfall)} (${fmt(info.short)}곳)`;
    if (info.cut) t += ` · 공급망 미연결 ${fmt(info.cut)}곳 (필요 ${number(info.cutDemand)})`;
    if (info.idleSources.length) t += ` · 미연결 공급시설 ${fmt(info.idleSources.length)}개 (용량 ${number(info.idleCap)})`;
    if (!info.short && !info.cut && !info.idleSources.length) t += info.demand === 0 ? ' · 공급 대기' : ` · 여유 ${number(info.spare)}`;
    return t;
  },
  drawChart() {
    const c = $('chart');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const hs = S.history;
    if (hs.length < 2) { ctx.fillStyle = '#7f938a'; ctx.font = '13px sans-serif'; ctx.fillText('데이터를 모으는 중…', 12, 24); return; }
    const line = (key, color) => {
      let mn = Math.min(...hs.map(h => h[key])), mx = Math.max(...hs.map(h => h[key]));
      if (mn > 0) mn = 0;
      if (mx === mn) mx = mn + 1;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      hs.forEach((h, k) => {
        const x = 8 + (W - 16) * k / (hs.length - 1);
        const y = H - 10 - (H - 20) * (h[key] - mn) / (mx - mn);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
      return mx;
    };
    const mp = line('pop', '#6fd38a');
    const mm = line('money', '#f2c94c');
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#6fd38a'; ctx.fillText('최대 ' + fmt(mp) + '명', 10, 14);
    ctx.fillStyle = '#f2c94c'; ctx.fillText('최대 ₩' + fmt(mm), 120, 14);
  },

  toast(msg, kind, x, y) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.textContent = msg;
    if (x !== undefined) {
      el.classList.add('click');
      el.title = '클릭하면 이동';
      el.onclick = () => centerCamera(x + 0.5, y + 0.5);
    }
    box.appendChild(el);
    const w = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1400;
    const max = w <= 480 ? 2 : w <= 760 ? 3 : 5; // 작은 화면에서는 지도를 덜 가리도록 적게
    while (box.children.length > max) box.removeChild(box.firstChild);
    this.fitToasts();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, kind === 'bad' ? 7000 : 4500);
  },

  // 알림이 다른 패널(수요·지도·정보 등)을 덮지 않도록, 겹치면 오래된 알림부터 접는다
  fitToasts() {
    const box = $('toasts');
    if (!box || typeof box.getBoundingClientRect !== 'function') return;
    if (box.style) { box.style.right = ''; box.style.top = ''; }
    if (!box.children.length) return;
    const hud = ['topbar', 'bottom-bar', 'tool-dock', 'layer-tray', 'active-tool', 'guide', 'news-bar', 'right-panel', 'info', 'time-controls', 'zoom-controls']
      .map(id => $(id)).filter(el => el && typeof el.getBoundingClientRect === 'function' && !el.classList?.contains('hidden'));
    const overlaps = () => {
      const b = box.getBoundingClientRect();
      return hud.some(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      });
    };
    while (box.children.length > 1 && overlaps()) box.removeChild(box.firstChild);
    // 하나만 남아도 겹치면(큰 화면) 오른쪽 패널 왼쪽으로, 그래도 겹치면 그 아래로 옮긴다
    const vw = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
    if (vw > 760 && box.style) {
      if (overlaps()) {
        const rp = $('right-panel')?.getBoundingClientRect?.();
        if (rp && rp.width) box.style.right = Math.round(vw - rp.left + 10) + 'px';
        const b = box.getBoundingClientRect();
        let top = 0;
        for (const el of hud) {
          if (['right-panel', 'tool-dock', 'bottom-bar', 'layer-tray'].includes(el.id)) continue;
          const r = el.getBoundingClientRect();
          if (r.width && r.height && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) top = Math.max(top, r.bottom + 8);
        }
        if (top) box.style.top = Math.round(top) + 'px';
      }
    }
  },

  tooltip(sx, sy, html) {
    const tt = $('tooltip');
    if (!html) { tt.classList.add('hidden'); return; }
    tt.innerHTML = html;
    tt.classList.remove('hidden');
    const bounds = tt.getBoundingClientRect();
    tt.style.left = Math.max(8, Math.min(sx + 16, window.innerWidth - bounds.width - 8)) + 'px';
    tt.style.top = Math.max(8, Math.min(sy + 18, window.innerHeight - bounds.height - 8)) + 'px';
  },
};
