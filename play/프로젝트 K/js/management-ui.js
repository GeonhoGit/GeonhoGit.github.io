// ===== 도시 운영 화면 =====
const MANAGEMENT = {
  tab: 'quests',
  tabs: ['quests', 'events', 'policies', 'development', 'challenge', 'achievements'],
  _signature: '',

  text(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  },
  money(value) { return `₩${fmt(Number(value) || 0)}`; },
  button(action, id, label, disabled = false) {
    return `<button class="management-action" data-action="${action}" data-id="${this.text(id)}"${disabled ? ' disabled' : ''}>${this.text(label)}</button>`;
  },
  empty(title, copy) {
    return `<div class="management-empty"><span class="eyebrow">도시의 다음 이야기</span><h3>${this.text(title)}</h3><p>${this.text(copy)}</p></div>`;
  },

  init() {
    $('btn-management').onclick = () => this.open();
    for (const tab of this.tabs) {
      const button = $('management-tab-' + tab);
      button.onclick = () => this.selectTab(tab);
      button.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const index = this.tabs.indexOf(tab);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? this.tabs.length - 1
          : (index + (e.key === 'ArrowRight' ? 1 : this.tabs.length - 1)) % this.tabs.length;
        this.selectTab(this.tabs[next]);
        $('management-tab-' + this.tabs[next]).focus();
      });
    }
    $('management-content').addEventListener('click', e => this.handleAction(e));
    $('info').addEventListener('click', e => this.handleAction(e));
    const scenarios = typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.view().scenarios : [];
    $('scenario-select').innerHTML = '<option value="">자유 도시 · 제한 없이</option>'
      + scenarios.map(s => `<option value="${this.text(s.id)}">${this.text(s.name)}</option>`).join('');
    $('scenario-select').onchange = () => this.updateScenario();
    this.updateScenario();
  },
  updateScenario() {
    const id = $('scenario-select').value;
    const scenarios = typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.view().scenarios : [];
    const scenario = scenarios.find(s => s.id === id);
    $('scenario-description').textContent = scenario?.description || '나만의 속도로 자유롭게 도시를 성장시키세요.';
    $('scenario-duration').textContent = scenario ? `도전 기간 ${scenario.limit}개월` : '기간 제한 없음';
    $('scenario-conditions').textContent = scenario?.startingConditions || '기본 지형 · 선택한 시작 자금으로 시작';
  },
  open() {
    UI.open('modal-management');
    this.refresh(true);
  },
  selectTab(tab) {
    if (!this.tabs.includes(tab)) return;
    this.tab = tab;
    this.refresh(true);
    $('management-content').scrollTop = 0;
  },
  refresh(force = false) {
    if (!S) return;
    const civic = typeof CIVIC !== 'undefined' ? CIVIC.view() : { quests: [], policies: [], event: null };
    const pending = civic.quests.filter(q => q.ready && !q.claimed).length + (civic.event?.phase === 'offer' ? 1 : 0);
    if (this._pending !== pending) {
      this._pending = pending;
      $('management-badge').textContent = String(pending);
      $('management-badge').classList.toggle('hidden', pending === 0);
      $('btn-management').setAttribute('aria-label', pending ? `도시 운영 · 받을 보상과 새 제안 ${pending}건` : '도시 운영');
    }
    if ($('modal-management').classList.contains('hidden')) return;
    const development = typeof DEVELOPMENT !== 'undefined' ? DEVELOPMENT.view() : { specializations: [], facilities: [], scenario: null };
    const data = this.tab === 'quests' ? civic.quests : this.tab === 'events' ? civic.event
      : this.tab === 'policies' ? civic.policies : this.tab === 'development' ? [development.specializations, development.facilities]
      : this.tab === 'achievements' ? (typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.view() : null) : development.scenario;
    const signature = JSON.stringify([this.tab, data]);
    if (!force && signature === this._signature) return;
    this._signature = signature;
    for (const tab of this.tabs) {
      const selected = tab === this.tab;
      const button = $('management-tab-' + tab);
      button.classList.toggle('on', selected);
      button.setAttribute('aria-selected', selected);
      button.tabIndex = selected ? 0 : -1;
    }
    const content = $('management-content');
    const active = content.contains(document.activeElement) ? document.activeElement : null;
    const focusAction = active?.dataset?.action, focusId = active?.dataset?.id;
    content.setAttribute('aria-labelledby', 'management-tab-' + this.tab);
    content.innerHTML = this.tab === 'quests' ? this.quests(civic.quests)
      : this.tab === 'events' ? this.events(civic.event)
      : this.tab === 'policies' ? this.policies(civic.policies)
      : this.tab === 'development' ? this.development(development)
      : this.tab === 'achievements' ? this.achievements(typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.view() : null)
      : this.challenge(development.scenario);
    if (active) {
      const replacement = focusAction && content.querySelector(`[data-action="${focusAction}"][data-id="${focusId}"]`);
      if (replacement && !replacement.disabled) replacement.focus();
      else $('management-tab-' + this.tab).focus();
    }
  },

  quests(quests) {
    if (!quests.length) return this.empty('시민들의 이야기를 기다리는 중입니다', '도시를 성장시키면 새로운 의뢰가 도착합니다.');
    return '<p class="management-lead">작은 불편을 해결하고, 시민들과 함께 도시를 만들어 가세요. 달성한 의뢰의 보상은 직접 받을 수 있습니다.</p><div class="management-cards">'
      + quests.map(q => {
        const progress = Math.min(100, Math.max(0, q.target ? q.progress / q.target * 100 : 100));
        return `<article class="management-card${q.claimed ? ' is-complete' : ''}"><div class="management-card-top"><span class="management-badge">${q.claimed ? '수령 완료' : q.ready ? '목표 달성' : '진행 중'}</span><span class="management-reward">${this.money(q.reward)}</span></div>
          <h3>${this.text(q.title)}</h3><p>${this.text(q.description)}</p><div class="management-progress-label"><span>진행</span><b>${fmt(q.progress)} / ${fmt(q.target)}</b></div><div class="management-progress" role="progressbar" aria-label="${this.text(q.title)}" aria-valuemin="0" aria-valuemax="${q.target}" aria-valuenow="${Math.min(q.progress, q.target)}"><i style="width:${progress}%"></i></div>
          ${q.permitText ? `<p class="management-permit">보상 · ${this.text(q.permitText)}</p>` : ''}
          ${this.button('claim', q.id, q.claimed ? '수령 완료' : q.ready ? '보상받기' : '목표를 달성해 주세요', !q.ready || q.claimed)}</article>`;
      }).join('') + '</div>';
  },
  events(event) {
    if (!event) return this.empty('아직 도착한 제안이 없어요', '도시의 시간이 흐르면 새로운 소식이 찾아옵니다. 제안을 받은 뒤 이곳에서 비용과 효과를 비교하고 결정하세요.');
    const active = event.phase === 'active';
    const choice = event.choices.find(c => c.id === event.choiceId);
    const remaining = active ? `${event.remainingDays ?? event.remaining * 30}일 남음` : `${event.remaining}개월 안에 선택`;
    let html = `<div class="management-event"><span class="management-badge">${active ? '진행 중' : '시장의 결정이 필요해요'} · ${remaining}</span><h3>${this.text(event.title)}</h3><p>${this.text(event.description)}</p></div>`;
    if (active) {
      return html + `<article class="management-card active-event"><h3>${this.text(event.choiceTitle || choice?.title)}</h3><p>${this.text(choice?.effectText || '선택한 효과가 도시에 적용되고 있습니다.')}</p><p class="management-cost">현재 월 요율 ${this.money(event.monthlyCost ?? choice?.monthlyCost)}</p><p class="management-muted">월 요율은 30일 기준이며 실제 적용일만 일할 정산합니다. 수입 변화도 적용된 날짜만 반영됩니다.</p><p class="management-muted">기간이 끝나면 효과가 종료됩니다. 도시 운영 창을 닫으면 시간이 다시 흐릅니다.</p></article>`;
    }
    return html + '<div class="management-cards event-choices">' + event.choices.map(c => `<article class="management-card"><h3>${this.text(c.title)}</h3><p>${this.text(c.description)}</p><p class="management-effect">${this.text(c.effectText)}</p><dl class="management-facts"><div><dt>선택 비용</dt><dd>${this.money(c.cost)}</dd></div><div><dt>현재 월 요율</dt><dd>${this.money(c.monthlyCost)}</dd></div><div><dt>효과 기간</dt><dd>${c.duration ? `${c.duration}개월 (${c.duration * 30}일)` : '즉시 결정'}</dd></div></dl>${this.button('event', c.id, c.affordable ? '이 선택으로 결정' : '자금이 부족해요', !c.affordable)}</article>`).join('') + '</div><p class="management-muted">월 요율은 30일 기준이며 실제 적용일만 일할 정산합니다. 수입 변화도 적용된 날짜만 반영됩니다.</p>';
  },
  policies(policies) {
    return '<p class="management-lead">도시에 맞는 운영 방침을 선택하세요. 도입 비용은 켤 때 한 번, 유지비는 활성화한 동안 매달 지출됩니다. 인구 500명부터는 도시 규모에 맞춰 비용이 함께 늘어납니다.</p><div class="management-cards">'
      + policies.map(p => `<article class="management-card${p.active ? ' is-active' : ''}"><div class="management-card-top"><span class="management-badge">${p.active ? '시행 중' : p.locked ? `인구 ${fmt(p.unlock)}명 필요` : '도입 가능'}</span></div><h3>${this.text(p.title)}</h3><p>${this.text(p.description)}</p><p class="management-effect">${this.text(p.effectText)}</p><dl class="management-facts"><div><dt>도입 비용</dt><dd>${this.money(p.activationCost)}</dd></div><div><dt>월 유지비</dt><dd>${this.money(p.monthlyCost)}</dd></div></dl>${this.button('policy', p.id, p.active ? '정책 중단' : p.locked ? '아직 도입할 수 없어요' : p.affordable ? '정책 도입' : '자금이 부족해요', !p.active && (p.locked || !p.affordable))}</article>`).join('') + '</div>';
  },
  development(view) {
    return '<p class="management-lead">특화는 도시 전체에 적용할 보너스 한 가지를 고르는 기능입니다. 모든 시설은 인구 조건을 충족하면 특화 선택과 관계없이 건설할 수 있습니다. 첫 선택은 무료이며, 변경 시에는 비용과 대기 기간이 있습니다.</p><div class="management-cards specialization-cards">'
      + view.specializations.map(s => `<article class="management-card${s.selected ? ' is-active' : ''}"><span class="management-badge">${s.selected ? '우리 도시의 특화' : '도시 특화'}</span><h3>${this.text(s.name)}</h3><p>${this.text(s.description)}</p><p class="management-cost">${s.cost ? `변경 비용 ${this.money(s.cost)}` : '첫 선택 무료'}</p>${!s.available && !s.selected ? `<p class="management-muted">${this.text(s.reason)}</p>` : ''}${this.button('specialize', s.id, s.selected ? '선택됨' : '이 특화 선택', s.selected || !s.available)}</article>`).join('')
      + '</div><h3 class="management-section-title">도시 발전 시설</h3><p class="management-lead">인구 조건을 충족하면 건설 도구에서 사용할 수 있습니다. 시민 의뢰의 허가증으로 일부 시설을 일찍 만날 수도 있어요. 근무 인원이 부족하면 운영 수입이 줄어들며 주민이 없으면 수입은 0입니다.</p><div class="facility-list">'
      + view.facilities.map(f => {
        const d = typeof DEFS !== 'undefined' ? DEFS[f.key] : null;
        return `<article class="facility-row"><div><h4>${d?.icon || '▥'} ${this.text(f.name)}</h4><p>기본 해금: 인구 ${fmt(f.unlock)}명</p><p class="management-muted">${this.text(f.unlocked ? d?.desc || '건설할 수 있습니다.' : f.reason)}</p>${d ? `<p class="management-cost">건설 ${this.money(d.cost)} · 월 유지 ${this.money(d.upkeep)}${d.monthlyIncome ? ` · 최대 월 수입 ${this.money(d.monthlyIncome)} (고용 100%, 수입 조정 전)` : ''}</p>` : ''}</div>${this.button('build', f.key, f.unlocked ? '건설 도구 선택' : '미해금', !f.unlocked)}</article>`;
      }).join('') + '</div><p class="management-muted">지은 시설은 살펴보기로 선택하면 확장할 수 있습니다. 확장 효과와 추가 유지비를 확인한 뒤 결정하세요.</p>';
  },
  achievements(view) {
    if (!view) return this.empty('업적을 불러올 수 없어요', '게임 파일이 모두 있는지 확인해 주세요.');
    const card = a => `<article class="achievement${a.unlocked ? ' is-unlocked' : a.everywhere ? ' is-elsewhere' : ''}">
      <span class="achievement-icon" aria-hidden="true">${a.unlocked || a.everywhere ? a.icon : '🔒'}</span>
      <div><h3>${this.text(a.title)}</h3><p>${this.text(a.description)}</p>
      <span class="achievement-state">${a.unlocked ? `이 도시 · ${a.year}년 ${a.month}월 달성` : a.everywhere ? '다른 도시에서 달성' : '아직 달성하지 않음'}</span></div></article>`;
    return `<p class="management-lead">도시를 키우며 특별한 순간을 모아 보세요. 업적은 매달 말에 확인합니다.
      <b>이 도시 ${view.city} / ${view.total}</b> · 모든 도시 ${view.ever} / ${view.total}${view.streak ? ` · 연속 흑자 ${view.streak}개월` : ''}</p>
      <div class="achievement-grid">${view.items.map(card).join('')}</div>`;
  },
  challenge(scenario) {
    if (!scenario) return this.empty('자유롭게 자라는 도시', '이 도시는 기간 제한이 없는 자유 모드입니다. 새로운 도전을 원한다면 도시를 저장한 뒤 메뉴에서 재건·섬·오염 시나리오를 시작해 보세요.');
    const success = ['success', 'won', 'completed'].includes(scenario.status);
    const failed = ['failed', 'failure'].includes(scenario.status);
    const status = success ? '도전 성공' : failed ? '도전 실패' : '도전 진행 중';
    return `<div class="management-event"><span class="management-badge${failed ? ' is-warning' : ''}">${status}</span><h3>${this.text(scenario.name)}</h3><p>${this.text(scenario.description)}</p><p class="management-cost">${scenario.months} / ${scenario.limit}개월 · ${Math.max(0, scenario.limit - scenario.months)}개월 남음</p></div><div class="scenario-goals">`
      + scenario.goals.map(g => `<div class="scenario-goal"><span>${g.complete ? '✓' : '○'} ${this.text(g.label)}</span><b>${Number(g.current).toLocaleString('ko-KR', { maximumFractionDigits: 1 })} / ${fmt(g.target)}</b></div>`).join('')
      + `</div><p class="management-outcome">${success ? '목표를 모두 달성했어요. 축하합니다! 이 도시에서 계속 플레이할 수 있습니다.' : failed ? '기간 안에 목표를 모두 달성하지 못했지만, 도시는 사라지지 않습니다. 계속 플레이하며 다음 목표를 만들어 보세요.' : '기간 안에 모든 목표를 달성하세요. 도전 결과와 관계없이 도시는 계속 플레이할 수 있습니다.'}</p>`;
  },

  upgradeMarkup() {
    if (typeof DEVELOPMENT === 'undefined') return '';
    const upgrade = DEVELOPMENT.view().upgrade;
    if (!upgrade) return '';
    const complete = upgrade.level >= upgrade.maxLevel;
    return `<section class="facility-upgrade"><div class="row"><span>시설 확장</span><b>${upgrade.level} / ${upgrade.maxLevel}단계</b></div>${complete ? '<p class="ok">모든 확장을 마쳤습니다.</p>' : `<p>${this.text(upgrade.effectText || (upgrade.effects || []).join(' · '))}</p><p class="management-cost">확장 비용 ${this.money(upgrade.cost)}</p>${!upgrade.available ? `<p class="management-muted">${this.text(upgrade.reason)}</p>` : ''}${this.button('upgrade', upgrade.root, '시설 확장', !upgrade.available)}`}</section>`;
  },
  handleAction(e) {
    const button = e.target.closest?.('button[data-action]');
    if (!button || button.disabled) return;
    e.preventDefault(); e.stopPropagation();
    const { action, id } = button.dataset;
    if (action === 'build') {
      UI.close('modal-management'); UI.setTool(id); return;
    }
    let result;
    if (action === 'claim' && typeof CIVIC !== 'undefined') result = CIVIC.claimQuest(id);
    else if (action === 'policy' && typeof CIVIC !== 'undefined') result = CIVIC.togglePolicy(id);
    else if (action === 'event' && typeof CIVIC !== 'undefined') result = CIVIC.chooseEvent(id);
    else if (action === 'specialize' && typeof DEVELOPMENT !== 'undefined') result = DEVELOPMENT.chooseSpecialization(id);
    else if (action === 'upgrade' && typeof DEVELOPMENT !== 'undefined') result = DEVELOPMENT.upgrade(Number(id));
    if (!result) return;
    if (!result.ok) { UI.toast(result.reason || '지금은 실행할 수 없습니다.', 'warn'); return; }
    const messages = { claim: '시민 의뢰 보상을 받았습니다.', policy: '도시 운영 정책을 변경했습니다.', event: '도시의 다음 소식을 결정했습니다.', specialize: '도시의 특화를 선택했습니다.', upgrade: '시설을 한 단계 확장했습니다.' };
    UI.toast(messages[action], 'good');
    UI.refresh();
    this.refresh();
    if (action === 'upgrade') {
      const next = $('info').querySelector('[data-action="upgrade"]');
      if (next && !next.disabled) next.focus();
      else { $('info').setAttribute('tabindex', '-1'); $('info').focus(); }
    }
  },
};
