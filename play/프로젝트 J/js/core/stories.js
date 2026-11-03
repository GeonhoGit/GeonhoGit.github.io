// 선택한 약속과 실제 출전 결과가 이어지는 학생 이야기
"use strict";

function storiesOf(){
  if (!S.stories || !Array.isArray(S.stories.history)) S.stories = {season:S.season, active:null, seen:[], history:[]};
  const stories = S.stories;
  if (stories.season !== S.season){
    if (stories.active && stories.active.stage !== 'resolved') finishSeasonStories();
    stories.season = S.season; stories.active = null; stories.seen = []; stories.lastMatch = null;
  }
  if (!Array.isArray(stories.seen)) stories.seen = [];
  return stories;
}
function storyMatchKey(){
  return [S.season, S.phase, S.week,
    S.phase === 'cup' && S.cup ? S.cup.round : '',
    S.phase === 'final' && S.final ? S.final.games.length : ''].join(':');
}
function storyMembers(story){ return story.ids.map(id => findSt(me(), id)); }
function completeStory(story, outcome, text){
  if (!story || story.stage === 'resolved') return [];
  story.stage = 'resolved'; story.outcome = outcome; story.result = text;
  const stories = S.stories;
  if (!stories.history.some(h => h.id === story.id)){
    stories.history.unshift({id:story.id, season:story.season, type:story.type, names:[...story.names], outcome, text});
    stories.history = stories.history.slice(0, 24);
    addNews(text);
  }
  return [text];
}
function startStoryIfEligible(){
  const stories = storiesOf();
  if (stories.active){
    if (stories.active.stage !== 'resolved' && storyMembers(stories.active).some(st => !st)){
      completeStory(stories.active, 'cancelled', '학생이 학교를 떠나 진행 중이던 이야기를 마무리했습니다.');
      return true;
    }
    return false;
  }
  if (S.event || S.week < 1 || !['hub','cup','final'].includes(S.phase)) return false;
  let type, students;
  if (!stories.seen.includes('bench')){
    // 출전 기록이 적고 사기가 낮은 학생부터 다음 기회를 요청합니다.
    const candidates = [...me().students].sort((a,b) => (a.rec?.g || 0) - (b.rec?.g || 0) || moraleOf(a) - moraleOf(b));
    if (candidates.length > 3){ type = 'bench'; students = candidates.slice(0,1); }
  }
  if (!type && S.week >= 2 && !stories.seen.includes('pair') && me().students.length >= 2){
    const pairs = [];
    const roster = me().students;
    roster.forEach((a,i) => roster.slice(i+1).forEach(b => pairs.push([a,b])));
    pairs.sort((a,b) => chemPts(a[0].id,a[1].id) - chemPts(b[0].id,b[1].id));
    type = 'pair'; students = pairs[0];
  }
  if (!type) return false;
  stories.seen.push(type);
  stories.active = {id:`s${S.season}-${type}`, season:S.season, type, stage:'choice',
    ids:students.map(st => st.id), names:students.map(st => st.name), week:S.week};
  return true;
}
function chooseStory(value){
  if (!S || typeof value !== 'string') return false;
  const stories = storiesOf(), story = stories.active, [id, choice] = value.split(':');
  if (!story || story.id !== id) return false;
  if (choice === 'close' && story.stage === 'resolved'){ stories.active = null; return true; }
  if (story.stage !== 'choice' || S.event || !['hub','cup','final'].includes(S.phase)) return false;
  if (storyMembers(story).some(st => !st)){
    completeStory(story, 'cancelled', '학생이 학교를 떠나 진행 중이던 이야기를 마무리했습니다.');
    return true;
  }
  const allowed = story.type === 'bench' ? ['chance','prepare'] : ['together','space'];
  if (!allowed.includes(choice)) return false;
  story.choice = choice; story.stage = 'waiting';
  return true;
}
function updateStories(res, iw){
  const stories = storiesOf(), key = res.storyMatchKey || storyMatchKey();
  if (stories.lastMatch === key) return [];
  stories.lastMatch = key;
  const story = stories.active;
  if (!story || story.stage === 'resolved') return [];
  const members = storyMembers(story);
  if (members.some(st => !st)) return completeStory(story, 'cancelled', '학생이 학교를 떠나 진행 중이던 이야기를 마무리했습니다.');
  if (story.stage !== 'waiting') return [];
  const played = id => (res.starters || []).includes(id);
  const morale = (st,n) => { st.morale = clamp(moraleOf(st) + n, 0, 100); };
  if (story.type === 'bench'){
    const st = members[0], record = (res.units || []).find(u => u.sid === st.id);
    if (story.choice === 'chance'){
      if (!played(st.id)){
        morale(st,-4);
        return completeStory(story, 'missed', `${st.name}에게 약속한 출전 기회를 주지 못했습니다. 사기 −4. 다음에는 약속과 명단을 함께 살펴보세요.`);
      }
      const shine = iw || res.mvp === st.id || record && record.k >= 2;
      morale(st, shine ? 6 : 4);
      return completeStory(story, 'fulfilled', `${st.name}이(가) 약속받은 경기에 출전해 ${shine ? '자신의 힘을 보여줬습니다. 사기 +6.' : '경험을 쌓았습니다. 패배했지만 믿음을 얻었습니다. 사기 +4.'}`);
    }
    const trained = !played(st.id) && st.train && st.train !== 'rest';
    morale(st,trained ? 4 : 2);
    return completeStory(story, 'prepared', `${st.name}이(가) ${trained ? '이번 경기에는 쉬며 훈련에 집중했습니다. 준비를 존중받아 사기 +4.' : '서두르지 말자는 격려를 기억합니다. 사기 +2.'}`);
  }
  const [a,b] = members, together = played(a.id) && played(b.id);
  if (story.choice === 'together'){
    if (together){
      addChem(a.id,b.id,3); members.forEach(st => morale(st,3));
      return completeStory(story, 'reconciled', `${a.name}과(와) ${b.name}이(가) 함께 뛰며 연습 방식의 차이를 이해했습니다. 관계 +3, 두 학생 사기 +3.`);
    }
    addChem(a.id,b.id,-1);
    return completeStory(story, 'missed', `${a.name}과(와) ${b.name}에게 함께 뛸 기회를 주지 못했습니다. 풀지 못한 오해로 관계 −1.`);
  }
  members.forEach(st => morale(st,together ? -2 : 3));
  return completeStory(story, together ? 'missed' : 'cooled', together
    ? `${a.name}과(와) ${b.name}이(가) 마음을 정리할 틈 없이 함께 출전했습니다. 두 학생 사기 −2.`
    : `${a.name}과(와) ${b.name}이(가) 잠시 떨어져 마음을 정리했습니다. 두 학생 사기 +3, 관계는 유지됩니다.`);
}
function finishSeasonStories(){
  const stories = S.stories, story = stories && stories.active;
  if (!story || story.stage === 'resolved') return [];
  return completeStory(story, 'cancelled', `${story.names.join(' · ')}의 이야기는 시즌 종료로 마무리됐습니다. 이루지 못한 약속은 다음 시즌에 이어지지 않습니다.`);
}
function storyHtml(){
  const story = S.stories && S.stories.active;
  if (!story) return '';
  const name = story.names.map(esc), title = story.type === 'bench' ? '다음 기회를 기다리는 학생' : '서로 다른 연습 방식';
  const button = (choice,label) => `<button class="btn ghost small" data-a="storyChoice" data-v="${story.id}:${choice}" ${S.event && choice !== 'close' ? 'disabled' : ''}>${label}</button>`;
  let content;
  if (story.stage === 'resolved') content = `<p>${esc(story.result)}</p>${button('close','이야기 마무리')}`;
  else if (story.stage === 'waiting'){
    const next = {chance:`다음 공식 경기에 ${name[0]}을(를) 출전시키기로 약속했습니다.`, prepare:`${name[0]}에게 서두르지 말고 훈련으로 다음 기회를 준비하자고 했습니다.`, together:`다음 공식 경기에 ${name.join(' · ')}을(를) 함께 출전시키기로 했습니다.`, space:`다음 공식 경기에는 ${name.join(' · ')}을(를) 동시에 출전시키지 않기로 했습니다.`}[story.choice];
    content = `<p>${next}</p><p class="muted" style="font-size:.85rem">리그·컵·결승 중 다음 경기가 끝나면 실제 출전 명단에 따라 이야기가 이어집니다.</p>`;
  } else if (story.type === 'bench') content = `<p>${name[0]}이(가) 다음 출전 기회를 기다립니다. 감독은 어떤 말을 건넬까요?</p>
    <div class="row">${button('chance','다음 경기 출전 약속')}${button('prepare','훈련하며 준비하자')}</div>
    <p class="muted" style="font-size:.85rem">출전 약속: 지키면 사기 +4~6, 어기면 −4. 훈련 준비: 다음 경기 벤치에서 훈련하면 +4, 그 외 +2.</p>`;
  else content = `<p>${name.join('과(와) ')}이(가) 서로의 연습 방식을 이해하지 못하고 있습니다.</p>
    <div class="row">${button('together','다음 경기 함께 뛰기')}${button('space','잠시 따로 준비하기')}</div>
    <p class="muted" style="font-size:.85rem">함께 뛰기: 두 학생 출전 시 관계 +3·사기 +3, 불발 시 관계 −1. 따로 준비: 동시 출전을 피하면 사기 +3, 함께 내보내면 −2.</p>`;
  return `<section class="panel" style="margin-bottom:1rem"><h3>학생 이야기 · ${title}</h3>${content}${S.event && story.stage === 'choice' ? '<p class="muted">이번 주 사건을 먼저 해결하면 이야기의 선택을 할 수 있습니다.</p>' : ''}</section>`;
}
function storyHistoryHtml(season){
  const history = ((S.stories && S.stories.history) || []).filter(h => season == null || h.season === season);
  return history.length ? `<section class="panel" style="margin-top:1rem"><h3>학생들의 이야기</h3>${history.slice(0,6).map(h => `<p><span class="muted">시즌 ${h.season}</span> ${esc(h.text)}</p>`).join('')}</section>` : '';
}
