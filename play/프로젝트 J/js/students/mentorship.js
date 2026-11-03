// 졸업생 코치가 한 학생에게 대표 마법을 전수합니다.
"use strict";

const MENTOR_XP = 6, MENTOR_SEASON_CAP = 60;
function mentorId(h){
  if (!h) return null;
  if (typeof h.id === 'string' && h.id) return h.id;
  const index = ((S && S.hall) || []).indexOf(h);
  return index >= 0 ? `legacy:${index}:${h.season}:${h.name}` : null;
}
function activeMentor(){
  if (!S || !coachActive()) return null;
  const hall = Array.isArray(S.hall) ? S.hall : [];
  const matches = S.myCoach.hallId
    ? hall.filter(h => mentorId(h) === S.myCoach.hallId)
    : hall.filter(h => h.name === S.myCoach.name);
  return matches.length === 1 ? matches[0] : null;
}
const mentorshipOf = () => S && S.mentorship && S.mentorship.season === S.season ? S.mentorship : null;
function mentorSpell(h){
  const best = h && h.best;
  return best && best.lv >= 1 && Object.hasOwn(CH, best.id) && CHK.includes(best.id) ? best.id : null;
}
function assignMentor(studentId){
  if (!S || !canInvest() || ['draft','battle'].includes(V.view) || mentorshipOf()) return false;
  const mentor = activeMentor(), champ = mentorSpell(mentor), student = findSt(me(), studentId);
  if (!mentor || !champ || !student) return false;
  const id = mentorId(mentor);
  S.mentorship = {season:S.season, mentorId:id, mentorName:mentor.name, studentId, champ, awarded:0, matches:[]};
  if (!Array.isArray(student.mentoredBy)) student.mentoredBy = [];
  student.mentoredBy.push({mentorId:id, name:mentor.name, season:S.season, champ, xp:0});
  if (!Array.isArray(mentor.mentees)) mentor.mentees = [];
  mentor.mentees.push({studentId, name:student.name, season:S.season, champ, xp:0});
  addNews(`${mentor.name} 코치가 ${student.name}의 멘토가 됐습니다. 이번 시즌 ${CH[champ].n}을(를) 전수합니다.`);
  return true;
}
function progressMentorship(res){
  if (!S || !res || res.practice || !Array.isArray(res.starters) || !canInvest()) return [];
  const bond = mentorshipOf(), mentor = activeMentor();
  if (!bond || !mentor || mentorId(mentor) !== bond.mentorId || mentorSpell(mentor) !== bond.champ) return [];
  const student = findSt(me(), bond.studentId);
  if (!student || bond.awarded >= MENTOR_SEASON_CAP) return [];
  const key = typeof res.storyMatchKey === 'string' ? res.storyMatchKey : storyMatchKey();
  if (!Array.isArray(bond.matches)) bond.matches = [];
  if (bond.matches.includes(key)) return [];
  bond.matches.push(key);
  student.mastery = student.mastery || {};
  const current = Number.isFinite(student.mastery[bond.champ]) ? Math.max(0,student.mastery[bond.champ]) : 0;
  const amount = Math.min(MENTOR_XP, MENTOR_SEASON_CAP - (bond.awarded || 0), Math.max(0,MAST_XP[5] - current));
  if (amount <= 0) return [];
  const before = mastLv(student,bond.champ), readyBefore = specializationReady(student);
  student.mastery[bond.champ] = current + amount;
  bond.awarded = (bond.awarded || 0) + amount;
  const heritage = (student.mentoredBy || []).find(h => h.mentorId === bond.mentorId && h.season === bond.season);
  if (heritage) heritage.xp = (heritage.xp || 0) + amount;
  const successor = (mentor.mentees || []).find(h => h.studentId === student.id && h.season === bond.season);
  if (successor) successor.xp = (successor.xp || 0) + amount;
  const after = mastLv(student,bond.champ);
  const out = [`${bond.mentorName}의 지도: ${student.name}의 ${CH[bond.champ].n} 숙련 경험치 +${amount}.`];
  if (after > before) out.push(`${student.name}의 ${CH[bond.champ].n} 숙련도가 Lv${after}이 됐습니다.`);
  if (!readyBefore && specializationReady(student)) out.push(`${student.name}의 성장 방향을 선택할 수 있습니다. 학생 화면에서 전문화를 골라 주세요.`);
  student.fav = student.fav || [];
  if (after >= 3 && !student.fav.includes(bond.champ) && student.fav.length < 4){
    student.fav.push(bond.champ);
    const note = `${student.name}이(가) ${bond.mentorName}에게 배운 ${CH[bond.champ].n}을(를) 주력 마법으로 익혔습니다.`;
    out.push(note); addNews(note);
  }
  return out;
}
function mentorshipLine(student){
  const history = Array.isArray(student && student.mentoredBy) ? student.mentoredBy : [];
  const successors = Array.isArray(student && student.mentees) ? student.mentees : [];
  const lines = history.map(h => `<div><span class="muted">시즌 ${h.season}</span> ${esc(h.name)}의 제자${Object.hasOwn(CH,h.champ) ? ` · ${CH[h.champ].n}` : ''} <span class="muted">숙련 +${R(h.xp || 0)}</span></div>`)
    .concat(successors.map(h => `<div><span class="muted">시즌 ${h.season}</span> 후계자 ${esc(h.name)}${Object.hasOwn(CH,h.champ) ? ` · ${CH[h.champ].n}` : ''} <span class="muted">전수 +${R(h.xp || 0)}</span></div>`));
  return lines.length ? `<div class="mentor-line" style="font-size:.85rem;margin:.4rem 0">${lines.join('')}</div>` : '';
}
function mentorshipHtml(){
  const bond = mentorshipOf(), mentor = activeMentor(), champ = mentorSpell(mentor);
  let content;
  if (bond){
    const student = findSt(me(),bond.studentId);
    content = `<p>${esc(bond.mentorName)} → ${student ? esc(student.name) : '학교를 떠난 제자'}</p>
      <p class="muted">${Object.hasOwn(CH,bond.champ) ? CH[bond.champ].n : '대표 마법'} 전수 · 이번 시즌 숙련 +${R(bond.awarded || 0)}/${MENTOR_SEASON_CAP}</p>
      <p class="muted" style="font-size:.85rem">${student ? '출전 여부와 관계없이 공식 경기마다 지도를 받습니다. 한 시즌에 제자를 다시 지정할 수 없습니다.' : '제자가 학교를 떠나 전수가 끝났습니다. 다음 시즌에 새 제자를 지정할 수 있습니다.'}</p>`;
  } else if (!coachActive()) content = '<p class="muted">졸업생 코치를 고용하면 재학생 한 명을 제자로 지정할 수 있습니다.</p>';
  else if (!mentor || !champ) content = '<p class="muted">현재 코치의 대표 마법 기록을 확인할 수 없어 제자를 지정할 수 없습니다.</p>';
  else content = `<p>${esc(mentor.name)} 코치가 <b>${CH[champ].n}</b>을(를) 전수합니다.</p>
    <p class="muted" style="font-size:.85rem">제자는 출전 여부와 관계없이 공식 경기 후 숙련 경험치 +${MENTOR_XP}를 얻습니다(시즌 최대 ${MENTOR_SEASON_CAP}, 숙련 Lv5까지). 연습 경기에서는 성장하지 않습니다. 제자 지정은 시즌당 한 번입니다.</p>
    <div class="row">${me().students.map(student => `<button class="btn ghost small" data-a="assignMentor" data-v="${student.id}" ${!canInvest() || ['draft','battle'].includes(V.view) ? 'disabled' : ''}>${esc(student.name)} 지정</button>`).join('')}</div>`;
  return `<section class="panel" style="margin-top:1rem"><h3>졸업생 멘토와 후계자</h3>${content}</section>`;
}
