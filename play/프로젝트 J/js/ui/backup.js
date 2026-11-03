// 저장 관리 (백업 코드, 파일)
"use strict";

/* =========================================================
   저장 관리 (백업 코드, 파일)
   ========================================================= */
function saveCode(){ return 'ML1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
function parseSave(text){
  text = (text || '').trim(); if (!text) throw new Error('empty');
  const json = text.startsWith('ML1:') ? decodeURIComponent(escape(atob(text.slice(4).replace(/\s+/g, '')))) : text;
  const s = JSON.parse(json);
  if (!s || !Array.isArray(s.schools) || !s.schools[0] || !s.schools[0].player || typeof s.season !== 'number') throw new Error('bad');
  return s;
}
function loadBackup(text){
  V.importDraft = text;
  let s;
  try { s = parseSave(text); } catch(e){ V.importErr = '저장 코드나 파일을 읽을 수 없습니다. 내보낸 내용을 빠짐없이 붙여 넣었는지 확인하세요.'; render(); return false; }
  S = s; migrate(S); applyExpansion(); unlockExpansion(); save();
  V = {view:S.phase === 'graduation' ? 'graduation' : 'hub', startElem:'water'};
  addNews('저장을 불러왔습니다.'); render(); window.scrollTo(0, 0);
  return true;
}
function importBoxHtml(btnAction, btnLabel){
  return `<textarea id="importText" class="code-box" rows="5" aria-label="불러올 저장 코드" placeholder="저장 코드(ML1:로 시작)나 저장 파일 내용을 붙여 넣으세요.">${esc(V.importDraft || '')}</textarea>
    <div class="row" style="margin-top:.5rem"><label class="btn ghost small file-btn">저장 파일 고르기<input type="file" id="importFile" accept=".json,.txt,application/json,text/plain" hidden></label>
    <button class="btn small" data-a="${btnAction}">${btnLabel}</button></div>
    ${V.importErr ? `<p class="bad" style="font-size:.88rem;margin-top:.4rem">${esc(V.importErr)}</p>` : ''}`;
}
function viewBackup(){
  return `<div class="spread" style="margin-bottom:1rem"><div><h2 style="margin:0">저장 관리</h2><p class="muted">진행 상황을 코드나 파일로 보관하고, 다른 기기나 브라우저에서 불러올 수 있습니다.</p></div></div>
    <div class="grid2">
      <section class="panel"><h3>내보내기</h3>
        <p class="muted" style="font-size:.9rem">지금 진행 상황(시즌 ${S.season}, ${divName()})을 저장 코드로 만듭니다. 메모장 등에 붙여 두면 언제든 되살릴 수 있습니다.</p>
        <div class="row" style="margin:.6rem 0"><button class="btn small" data-a="makeCode">저장 코드 만들기</button><button class="btn ghost small" data-a="downloadSave">파일로 받기</button></div>
        ${V.saveCode ? `<textarea id="exportText" class="code-box" rows="5" readonly>${esc(V.saveCode)}</textarea>
          <div class="row" style="margin-top:.5rem"><button class="btn ghost small" data-a="copyCode">코드 복사</button><span class="muted" style="font-size:.85rem">${V.saveCode.length.toLocaleString()}자</span></div>` : ''}
        ${V.backupNote ? `<p class="good" style="font-size:.88rem;margin-top:.4rem">${esc(V.backupNote)}</p>` : ''}
      </section>
      <section class="panel"><h3>불러오기</h3>
        <p class="muted" style="font-size:.9rem">불러오면 지금 진행 상황을 덮어씁니다. 먼저 내보내 두는 것을 권합니다.</p>
        ${importBoxHtml('importSave', V.confirmImport ? '한 번 더 누르면 덮어씁니다' : '불러오기')}
      </section>
    </div>`;
}
// 아티팩트 화면에서는 플랫폼 저장 기능, 일반 브라우저에서는 바로 다운로드
async function downloadSave(){
  const data = JSON.stringify(S), filename = `magic-league-season${S.season}.json`;
  let dl = null;
  if (window.claude && typeof window.claude.use === 'function'){ try { dl = await window.claude.use('downloads'); } catch(e){ dl = null; } }
  if (dl){
    try { await dl.save({filename, data}); V.backupNote = '저장 파일을 받았습니다.'; }
    catch(e){ V.backupNote = e && e.code === 'declined' ? '파일 받기를 취소했습니다.' : '이 화면에서는 파일로 받을 수 없습니다. 저장 코드를 만들어 복사해 두세요.'; }
    render(); return;
  }
  try {
    const blob = new Blob([data], {type:'application/json'});
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = filename;
    document.body.appendChild(el); el.click(); setTimeout(() => { URL.revokeObjectURL(el.href); el.remove(); }, 1000);
    V.backupNote = '파일 저장을 요청했습니다. 파일이 받아지지 않으면 저장 코드를 만들어 복사해 두세요.';
  } catch(e){ V.backupNote = '이 화면에서는 파일로 받을 수 없습니다. 저장 코드를 만들어 복사해 두세요.'; }
  render();
}
function copyCode(){
  const t = document.getElementById('exportText'); if (!t) return;
  const done = () => { V.backupNote = '저장 코드를 복사했습니다.'; render(); };
  const fallback = () => { t.select(); try { document.execCommand('copy'); done(); } catch(e){ V.backupNote = '자동 복사가 막혀 있습니다. 코드 칸을 길게 눌러 직접 복사하세요.'; render(); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(done, fallback); else fallback();
}
