// ===== 첫 도시 안내 · 저장 데이터와 분리된 세션 상태 =====
const GUIDE = {
  dismissed: false,
  current: null,
  nodes: null,

  init() {
    this.nodes = {};
    for (const key of ['guide', 'progress', 'title', 'copy', 'action', 'dismiss']) {
      this.nodes[key] = document.getElementById(key === 'guide' ? key : 'guide-' + key);
    }
    this.nodes.dismiss.onclick = () => {
      this.dismissed = true;
      this.update();
    };
    this.nodes.action.onclick = () => {
      this.update();
      const step = this.current;
      if (!step) return;
      if (step.tool) UI.setTool(step.tool);
      else if (UI.speed === 0) UI.setSpeed(1);
      else UI.openBudget();
      this.update();
    };
    this.update();
  },

  reset() {
    this.dismissed = false;
    this.update();
  },

  needsCollection() {
    return S.waste?.unservedResidential > 0 || !S.waste?.facilities?.some(f => f.operating);
  },

  nextStep() {
    const tiles = S.tiles;
    if (!tiles.some(t => t.type === 'road')) return {
      number: 1, tool: 'road', title: '도로로 시작하세요',
      copy: '빈 땅을 드래그해 도로를 놓아 보세요. 건물은 도로에서 2칸 이내에 있어야 자라요.',
    };
    if (S.stats.powerCap <= 0) return {
      number: 2, tool: 'power', title: '도시에 전기를 연결하세요',
      copy: '발전소를 도로에 붙여 지으세요. 전기는 연결된 도로와 건물을 따라 흐르니, 주거지와는 오염을 피해 떨어뜨려요.',
    };
    if (!tiles.some(t => t.type === 'res' && t.road && t.powered)) {
      const hasHomes = tiles.some(t => t.type === 'res');
      return {
        number: 3, tool: hasHomes ? 'road' : 'res',
        title: hasHomes ? '주거지까지 연결해 주세요' : '첫 주거지를 지정하세요',
        copy: hasHomes
          ? '지어 둔 주거지를 발전소 쪽 도로와 이어 주세요. 도로는 2칸 이내, 전력은 끊김 없이 연결되어야 해요.'
          : '전기가 연결된 도로에서 2칸 이내에 주거 구역을 그려 보세요. 발전소와 떨어진 쪽이 살기 좋아요.',
      };
    }
    if (!tiles.some(t => t.type === 'com' || t.type === 'ind')) return {
      number: 4, tool: 'ind', title: '일자리를 만들어요',
      copy: '도로 옆에 공업 구역을 조금 그려 보세요. 주거지와 띄워 오염을 줄여요. 상업 구역을 먼저 지어도 좋아요.',
    };
    if (S.stats.waterCap <= 0) return {
      number: 5, tool: 'watertower', title: '성장을 위한 물 공급',
      copy: '마을과 이어진 도로 옆에 급수탑을 놓으세요. 물이 공급되면 건물이 더 크게 자랄 수 있어요.',
    };
    if (S.stats.pop >= 150 && this.needsCollection()) return {
      number: 7, tool: 'landfill', title: '쓰레기를 수거할 곳이 필요해요',
      copy: '주거지와 같은 도로망에 매립지를 연결하세요. 도로에서 3칸 이내의 쓰레기를 수거해요. 시설은 도로에서 2칸 이내에 놓으세요.',
    };
    return {
      number: 6, title: '이제 시민을 기다려요',
      copy: UI.speed === 0
        ? '시간을 흐르게 하면 건물이 자라요. R·C·I 수요가 높은 구역을 조금씩 늘려 인구 150명에 도전하세요.'
        : 'R·C·I는 주거·상업·공업 수요예요. 높은 구역을 조금씩 늘리고 재정을 살펴보세요. 인구 150명이 첫 목표예요.',
    };
  },

  update() {
    if (!this.nodes) return;
    const hidden = !S || this.dismissed || S.stats.pop >= 150 && !this.needsCollection();
    const panel = this.nodes.guide;
    if (panel.classList.contains('hidden') !== hidden) {
      if (hidden) panel.classList.add('hidden');
      else panel.classList.remove('hidden');
    }
    if (hidden) { this.current = null; return; }
    const step = this.nextStep();
    this.current = step;
    const text = {
      progress: String(step.number).padStart(2, '0') + ' / 07',
      title: step.title,
      copy: step.copy,
      action: step.tool ? DEFS[step.tool].name + ' 선택' : UI.speed === 0 ? '성장 시작' : '재정 확인',
    };
    for (const [key, value] of Object.entries(text)) {
      if (this.nodes[key].textContent !== value) this.nodes[key].textContent = value;
    }
  },
};
