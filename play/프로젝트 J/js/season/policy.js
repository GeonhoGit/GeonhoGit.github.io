// 시즌 개막에 정하는 학교 운영 방침. 선택하지 않아도 기본 규칙으로 진행합니다.
"use strict";

const SEASON_POLICIES = {
  youth:{n:'신입생 육성', d:'1·2학년 훈련 성장 +20%. 3·4학년 훈련 성장 −10%.'},
  research:{n:'마법 연구', d:'공식 경기의 마법 숙련 경험치 +20%. 공격·수비·판단 훈련 후 컨디션 추가 −2.'},
  title:{n:'우승 집중', d:'출전 경기 후 컨디션 +3. 모든 학생의 훈련 성장 −15%.'},
};
function seasonPolicyKey(){
  const p = S && S.policy;
  return p && p.season === S.season && Object.hasOwn(SEASON_POLICIES,p.key) ? p.key : null;
}
function resetSeasonPolicy(){ if (S) S.policy = {season:S.season, key:null}; }
function canChooseSeasonPolicy(){
  return !!(S && S.week === 0 && S.phase === 'hub' && V.view === 'hub' && !seasonPolicyKey());
}
function chooseSeasonPolicy(key){
  if (!canChooseSeasonPolicy() || !Object.hasOwn(SEASON_POLICIES,key)) return false;
  S.policy = {season:S.season, key};
  addNews(`시즌 ${S.season} 운영 방침: ${SEASON_POLICIES[key].n}. ${SEASON_POLICIES[key].d}`);
  return true;
}
const policyOwnStudent = st => !!(S && st && me().students.some(s => s.id === st.id));
function policyGrowthMult(st){
  if (!policyOwnStudent(st)) return 1;
  const key = seasonPolicyKey();
  if (key === 'youth') return st.year <= 2 ? 1.2 : .9;
  if (key === 'title') return .85;
  return 1;
}
function policyMasteryMult(){ return seasonPolicyKey() === 'research' ? 1.2 : 1; }
function policyCondition(st, played, baseCondition){
  if (!policyOwnStudent(st)) return baseCondition;
  const key = seasonPolicyKey();
  if (key === 'research' && ['atk','def','int'].includes(st.train)) return clamp(baseCondition-2,20,100);
  if (key === 'title' && played) return clamp(baseCondition+3,20,100);
  return baseCondition;
}
function policyHtml(){
  if (!S) return '';
  const key = seasonPolicyKey(), canChoose = canChooseSeasonPolicy();
  return `<section class="panel" style="margin-bottom:1rem"><h3>시즌 ${S.season} 운영 방침</h3>
    ${key ? `<p><b>${SEASON_POLICIES[key].n}</b> · ${SEASON_POLICIES[key].d}</p><p class="muted" style="font-size:.8rem">이번 시즌 동안 유지됩니다. 다음 시즌 개막에 다시 선택할 수 있습니다.</p>`
      : canChoose ? `<p class="muted" style="font-size:.85rem">첫 경기 전에 한 번 선택합니다. 선택하지 않으면 추가 효과 없이 진행합니다.</p><div class="policy-pick">${Object.entries(SEASON_POLICIES).map(([id,p]) => `<button class="btn ghost policy-opt" data-a="seasonPolicy" data-v="${id}"><b>${p.n}</b><span>${p.d}</span></button>`).join('')}</div>`
      : '<p class="muted" style="font-size:.85rem">이번 시즌은 기본 운영 중입니다. 다음 시즌 첫 경기 전에 방침을 선택할 수 있습니다.</p>'}
    </section>`;
}
