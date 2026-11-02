(() => {
  'use strict';
  const G=Dalbit,W=DalbitWorld,$=id=>document.getElementById(id),canvas=$('world'),modal=$('modal'),KEY='dalbit-village-save-v8',TREEKEY='dalbit-village-save-v7',FARMKEY='dalbit-village-save-v6',TOOLKEY='dalbit-village-save-v5',PREVIOUSKEY='dalbit-village-save-v4',MAPKEY='dalbit-village-save-v3',LEGACYKEY='dalbit-village-save-v1';
  let state=G.fresh(),tool='hand',path=[],pending=null,held=new Set(),lastMove=0,lastFrame=performance.now(),lastSave=performance.now(),toastTimer,dirty=false,canSave=true,placement=null,fish=null,sound=false,audioContext=null,firstVisit=true;
  let rawSave=null,loadError=null;
  let farmQueue=[],bedtimePrompted=false;
  try{rawSave=localStorage.getItem(KEY)||localStorage.getItem(TREEKEY)||localStorage.getItem(FARMKEY)||localStorage.getItem(TOOLKEY)||localStorage.getItem(PREVIOUSKEY)||localStorage.getItem(MAPKEY)||localStorage.getItem(LEGACYKEY);if(rawSave){const parsed=JSON.parse(rawSave);state=G.validate(parsed);if(parsed.version<8&&!localStorage.getItem(KEY+'-before-upgrade'))localStorage.setItem(KEY+'-before-upgrade',rawSave);firstVisit=false;}}catch(e){loadError=e;canSave=false;}
  const view={x:state.player.x,y:state.player.y,pointer:null,walking:false,facing:'front',tool:'hand',aim:{x:0,y:1},placement:null,fishing:null};
  let residentState=null,residentDay=0,residentList=[];
  function residents(){
    if(residentState!==state||residentDay!==state.day){
      residentState=state;residentDay=state.day;
      residentList=G.npcs(state).map((n,i)=>({...n,drawX:n.x,drawY:n.y,fromX:n.x,fromY:n.y,walking:false,steps:[],wait:.8+i*.65,anchor:`${n.x},${n.y}`}));
    }
    return residentList;
  }
  function residentOccupies(n,x,y){return n.x===x&&n.y===y||n.walking&&n.fromX===x&&n.fromY===y;}
  function findPath(start,reached,passable){
    const queue=[start],visited=new Set([`${start.x},${start.y}`]),parents=new Map();let goal=null;
    for(let i=0;i<queue.length;i++){
      const p=queue[i];if(reached(p)){goal=p;break;}
      for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){
        const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;
        if(!visited.has(key)&&passable(x,y,p)){visited.add(key);parents.set(key,p);queue.push({x,y});}
      }
    }
    if(!goal)return null;const result=[];
    for(let p=goal;p.x!==start.x||p.y!==start.y;p=parents.get(`${p.x},${p.y}`))result.unshift({x:p.x,y:p.y});
    return result;
  }
  function moveResidents(dt){
    const list=residents();view.npcs=list;if(state.scene!=='outside'||state.map!=='village')return;
    const schedule=G.npcs(state);
    for(const n of list){
      const home=schedule.find(p=>p.id===n.id),anchor=`${home.x},${home.y}`;
      if(n.anchor!==anchor){n.anchor=anchor;n.steps=[];n.wait=0;}
      n.place=Math.abs(n.x-home.x)+Math.abs(n.y-home.y)>2?`${home.place}로 이동 중`:home.place;
      if(n.walking){
        const distance=Math.hypot(n.x-n.drawX,n.y-n.drawY),step=dt*1.5;
        if(distance<=step){n.drawX=n.x;n.drawY=n.y;n.walking=false;}
        else{n.drawX+=(n.x-n.drawX)/distance*step;n.drawY+=(n.y-n.drawY)/distance*step;}
        continue;
      }
      if(pending?.kind==='npc'&&pending.id===n.id){n.wait=1.5;continue;}
      n.wait-=dt;if(n.wait>0)continue;
      const passable=(x,y,from)=>!W.occupied(state,x,y)&&(!from||W.canStep(state,from,{x,y}))&&!playerOccupies(x,y)&&!path.some(p=>p.x===x&&p.y===y)&&!list.some(other=>other!==n&&residentOccupies(other,x,y))&&!W.MAPS.village.exits.some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)<=1)&&![[7,9],[19,8],[16,14],[14,9]].some(p=>p[0]===x&&p[1]===y);
      if(!n.steps.length){
        let goal=home;
        if(Math.abs(n.x-home.x)+Math.abs(n.y-home.y)<=2){
          const radius=G.weather(state)==='rain'?1:2,spots=[];
          for(let y=home.y-radius;y<=home.y+radius;y++)for(let x=home.x-radius;x<=home.x+radius;x++)if(Math.abs(x-home.x)+Math.abs(y-home.y)<=radius&&(x!==n.x||y!==n.y)&&passable(x,y))spots.push({x,y});
          goal=spots[Math.floor(Math.random()*spots.length)]||home;
        }
        n.steps=findPath(n,p=>p.x===goal.x&&p.y===goal.y,passable)||[];
      }
      const next=n.steps.shift();
      if(!next||!passable(next.x,next.y,n)){n.steps=[];n.wait=1;continue;}
      n.fromX=n.x;n.fromY=n.y;n.x=next.x;n.y=next.y;n.walking=true;
      if(!n.steps.length)n.wait=2+Math.random()*3;
    }
  }
  const TOOLS=[['hand','✋','살펴보기'],['hoe','⛏','괭이'],['seed','🌱','씨앗'],['water','💧','물뿌리개']];
  function tone(success=true){if(!sound)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(success?660:230,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(success?880:180,audioContext.currentTime+.13);g.gain.setValueAtTime(.035,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.2);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+.22);}catch{sound=false;}}
  function toast(msg,success=true){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3800);tone(success);}
  function save(manual=false){if(!canSave){if(manual)toast('기존 저장을 복구하거나, 도움말에서 백업을 내려받아 주세요.',false);return false;}try{localStorage.setItem(KEY,JSON.stringify(state));dirty=false;lastSave=performance.now();$('save-status').textContent='✓ 이 브라우저에 저장했어요';if(manual)toast('오늘의 이야기를 저장했어요.');return true;}catch{$('save-status').textContent='저장 공간에 접근할 수 없어요 · 도움말에서 백업하세요';if(manual)toast('저장하지 못했어요. 도움말에서 백업을 내려받아 주세요.',false);return false;}}
  function update(){
    $('date').textContent=`${G.season(state)} ${((state.day-1)%7)+1}일 · ${Math.floor((state.day-1)/28)+1}년`;
    const h=Math.floor(state.time/60),m=Math.floor(state.time%60/10)*10;$('clock').textContent=`${h<12?'오전':'오후'} ${h%12||12}:${String(m).padStart(2,'0')}`;
    $('weather').textContent=G.weather(state)==='rain'?'☂':'☀';$('gold').textContent=`◉ ${state.gold.toLocaleString()}`;
    $('energy-fill').style.width=state.energy+'%';$('energy-value').textContent=state.energy;
    $('bag-summary').textContent=`${G.count(state)} / ${G.CAPACITY}개 · 소중한 것들을 모아요`;
    const qs=G.REQUESTS.filter(q=>q.stage===Math.min(1,state.community.stage)).map(q=>[q.title,`${G.NPCS.find(n=>n.id===q.npc).name} · ${G.ITEMS[q.item].name} ${Math.min(state.bag[q.item]||0,q.amount)}/${q.amount} · ${state.requests[q.id]==='done'?'전달 완료':state.requests[q.id]==='active'?'준비 중':'수락 가능'}`,state.requests[q.id]==='done']);
    $('quests').innerHTML=qs.map(([title,desc,done])=>`<div class="quest ${done?'done':''}"><span class="quest-check">${done?'✓':''}</span><span class="quest-text">${title}<small>${desc}</small></span></div>`).join('');
    $('storage-summary').textContent=`${Object.values(state.storage).reduce((a,b)=>a+b,0)} / ${G.STORAGE_CAPACITY}개 · 집 앞 창고로 걷기`;
    $('community-progress').textContent=['1 / 2 · 온실 뼈대 세우기','2 / 2 · 지붕과 물길 완성','복구 완료 · 우리 온실이 열렸어요'][state.community.stage];
    $('community-fill').style.width=(state.community.stage*50)+'%';
    $('mail-count').textContent=G.letters(state).filter(l=>!state.readLetters.includes(l.id)).length;
    $('neighbors').innerHTML=residents().map(n=>`<button class="neighbor neighbor-locate" data-npc="${n.id}" title="${n.name}에게 걸어가기"><span class="portrait">${n.animal}</span><span><strong>${n.name}</strong><small>마을 · ${n.place} ↗</small></span><span class="hearts" aria-label="호감도 ${state.friends[n.id].hearts} / 5">${'♥'.repeat(state.friends[n.id].hearts)}${'♡'.repeat(5-state.friends[n.id].hearts)}</span></button>`).join('');
    // Keep each button mounted so the first click cannot break a double-click.
    if(!$('toolbar').children.length)$('toolbar').innerHTML=TOOLS.map(([id,icon,name],i)=>`<button class="tool" data-tool="${id}"><kbd>${i+1}</kbd><span>${icon}</span><small>${name}</small></button>`).join('');
    TOOLS.forEach(([id,icon,name],i)=>{const b=$('toolbar').children[i];b.classList.toggle('active',tool===id);b.setAttribute('aria-pressed',tool===id);b.title=id==='seed'?`씨앗 (3) · ${G.ITEMS[state.selectedSeed].name} 선택 중 · 더블클릭으로 종류 선택`:`${name} (${i+1})`;b.querySelector('small').textContent=name+(state.toolUpgrades[id]?` +${state.toolUpgrades[id]}`:'');});
    $('decorate-button').hidden=state.scene!=='inside';
    $('decorate-button').setAttribute('aria-pressed',tool==='decorate');
    $('scene-label').textContent=state.scene==='greenhouse'?'⌂   우리의 온실':state.scene==='inside'?'⌂   나의 작은 집':'⌁   '+W.MAPS[state.map].name;$('location').textContent=state.scene==='greenhouse'?'농장 · 공동 온실':state.scene==='inside'?'농장 · 나의 집':W.MAPS[state.map].name;canvas.setAttribute('aria-label',W.MAPS[state.map].name+'. 방향키로 이동하고 E 키로 상호작용하세요.');
  }
  function act(type,data){const result=G.action(state,type,data);toast(result.msg,result.ok);if(result.ok){ensurePosition();dirty=true;save();update();}return result;}
  function open(title,body,tag='DALBIT VILLAGE'){held.clear();path=[];farmQueue=[];pending=null;fish=null;view.fishing=null;$('modal-title').textContent=title;$('modal-body').innerHTML=body;$('modal-tag').textContent=tag;if(!modal.open)modal.showModal();}
  function close(){modal.close();canvas.focus({preventScroll:true});}
  function travel(exit){
    if(!W.travel(state,exit.id))return false;
    held.clear();path=[];pending=null;farmQueue=[];fish=null;placement=null;view.fishing=null;view.placement=null;
    view.x=state.player.x;view.y=state.player.y;view.walking=false;dirty=true;
    save();update();toast(W.MAPS[state.map].name+'에 도착했어요.');return true;
  }
  function checkExit(){
    if(state.scene!=='outside')return false;
    const exit=W.MAPS[state.map].exits.find(e=>e.x===state.player.x&&e.y===state.player.y);
    return exit?travel(exit):false;
  }
  function showMap(){
    const current=state.map;
    open('우리 동네 산책 지도',`<p class="modal-copy">현재 위치: <b>${W.MAPS[current].name}${state.scene==='inside'?' · 집 안':state.scene==='greenhouse'?' · 온실 안':''}</b><br>농장 오른쪽은 바닷가, 아래쪽은 마을이에요.</p><div class="region-map" aria-label="농장 동쪽 바닷가, 농장 남쪽 마을"><div class="region farm ${current==='farm'?'current':''}"><b>⌂ 나의 농장</b><small>집 · 텃밭 · 온실</small></div><span class="east">↔</span><div class="region beach ${current==='beach'?'current':''}"><b>≈ 바닷가</b><small>조개 · 부두 낚시</small></div><span class="south">↕</span><div class="region village ${current==='village'?'current':''}"><b>♧ 마을</b><small>상점 · 이웃 · 공방</small></div></div>`,'A WALK FROM HOME');
    if(state.scene!=='outside'){
      button('농장으로 나가는 문까지 걷기',()=>{close();const exit=targets().find(t=>t.kind==='exit');route(exit.x,exit.y,exit);},true);
    }else for(const exit of W.MAPS[current].exits)button(exit.name+' · 길 끝까지 걷기',()=>{close();route(exit.x,exit.y,{...exit,kind:'travel'});},true);
    if(state.scene==='outside'&&current===W.WORKSHOP.map)button('모루의 공방으로 걷기',goToWorkshop);
  }
  $('modal-close').onclick=close;modal.addEventListener('close',()=>{held.clear();lastFrame=performance.now();});
  function button(text,handler,primary=false){const b=document.createElement('button');b.className='btn wide'+(primary?' primary':'');b.textContent=text;b.onclick=handler;$('modal-body').appendChild(b);return b;}
  function row(icon,name,detail,label,callback,disabled=false){const r=document.createElement('div');r.className='modal-row';r.innerHTML=`<span>${icon}</span><div class="row-detail"><b>${name}</b><small>${detail}</small></div>`;if(label){const b=document.createElement('button');b.className='btn';b.textContent=label;b.onclick=callback;b.disabled=disabled;r.appendChild(b);}$('modal-body').appendChild(r);}
  function chooseSeed(id){
    if(!Object.hasOwn(G.CROPS,id)||!(state.bag[id]>0)){toast('보유한 씨앗을 골라 주세요.',false);return;}
    state.selectedSeed=id;tool='seed';view.tool='seed';placement=null;view.placement=null;
    dirty=true;save();update();close();toast(`${G.ITEMS[id].name}을 골랐어요.`);
  }
  function seedPicker(){
    open('심을 씨앗 고르기','<p class="modal-copy">보유한 씨앗을 선택하세요. 선택한 종류로 씨앗 도구를 사용해 심을 수 있어요.</p>','CHOOSE YOUR SEEDS');
    for(const [id,crop] of Object.entries(G.CROPS)){
      const item=G.ITEMS[id],count=state.bag[id]||0,selected=state.selectedSeed===id;
      row(item.icon,item.name,`${count}개 보유 · 성장 ${crop.days}일${id==='pumpkinSeed'?' · 온실 전용':''}${selected?' · 현재 선택':''}`,count?'선택하기':'보유 없음',()=>chooseSeed(id),!count);
    }
    if(!Object.keys(G.CROPS).some(id=>state.bag[id]>0))$('modal-body').insertAdjacentHTML('beforeend','<p class="empty">보유한 씨앗이 없어요. 마을 초록 상점에서 씨앗을 구매해 주세요.</p>');
  }
  function inventory(){open('주머니 속 작은 보물',`<p class="modal-copy">${G.count(state)} / ${G.CAPACITY}개. 씨앗은 클릭해서 심을 종류를 고를 수 있어요.</p>`,'MY POCKET');const entries=Object.entries(state.bag);if(!entries.length)$('modal-body').innerHTML+='<p class="empty">배낭이 비어 있어요. 마을 주변에서 재료를 주워 봐요.</p>';for(const [id,n] of entries){const it=G.ITEMS[id];row(it.icon,it.name,`${n}개${it.sell?' · 판매가 '+it.sell+' 동전':''}`,it.buy?'선택':it.recipe?'배치':null,()=>{if(id==='sapling'){chooseSapling();return;}if(it.buy){chooseSeed(id);}else chooseFurniture(id);});}}
  function goToStorage(){
    if(state.scene!=='outside'||state.map!=='farm'){toast('창고는 나의 농장 집 오른쪽 앞에 있어요.');return;}
    close();const target={kind:'storage',...W.STORAGE,name:'창고 열기'};route(target.x,target.y,target);
  }
  function storage(tab='store'){
    if(state.scene!=='outside'||state.map!=='farm'||!W.canReach(state,state.player,W.STORAGE)){toast('집 앞 창고 옆으로 가 주세요.');return;}
    const stored=Object.values(state.storage).reduce((a,b)=>a+b,0),putting=tab==='store';
    open('집 앞 작은 창고',`<p class="modal-copy">창고 <b>${stored} / ${G.STORAGE_CAPACITY}</b>개 · 배낭 <b>${G.count(state)} / ${G.CAPACITY}</b>개<br>제작·선물에 쓸 재료는 배낭으로 꺼내 주세요.</p><div class="tabs"><button class="btn ${putting?'primary':''}" id="storage-store">맡기기</button><button class="btn ${!putting?'primary':''}" id="storage-withdraw">꺼내기</button></div>`,'A PLACE FOR LITTLE TREASURES');
    $('storage-store').onclick=()=>storage('store');$('storage-withdraw').onclick=()=>storage('withdraw');
    const source=putting?state.bag:state.storage,free=putting?G.STORAGE_CAPACITY-stored:G.CAPACITY-G.count(state),entries=Object.entries(source);
    if(!entries.length)$('modal-body').insertAdjacentHTML('beforeend','<p class="empty">'+(putting?'맡길 물건이 없어요.':'아직 보관한 물건이 없어요.')+'</p>');
    for(const [id,n] of entries){
      const it=G.ITEMS[id],label=putting?'맡기기':'꺼내기';
      row(it.icon,it.name,`${n}개 · ${putting?'창고':'배낭'}에 ${((putting?state.storage:state.bag)[id]||0)}개`,'1개 '+label,()=>{act(tab,{item:id,amount:1});storage(tab);},free<1);
      if(n>1){const b=document.createElement('button'),amount=Math.min(n,free);b.className='btn';b.textContent=`${amount===n?'전부 ':''}${amount}개 ${label}`;b.disabled=!amount;b.onclick=()=>{act(tab,{item:id,amount});storage(tab);};$('modal-body').lastElementChild.appendChild(b);}
    }
  }
  function shop(tab='buy'){
    open('어서 와요, 초록 상점',`<p class="modal-copy">가진 동전 <b>${state.gold}</b> · 부탁에 필요한 물건은 남겨 두어도 좋아요.</p><div class="tabs"><button class="btn ${tab==='buy'?'primary':''}" id="tab-buy">씨앗 사기</button><button class="btn ${tab==='sell'?'primary':''}" id="tab-sell">물건 팔기</button></div>`,'THE GREEN STORE');
    $('tab-buy').onclick=()=>shop('buy');$('tab-sell').onclick=()=>shop('sell');let added=0;
    for(const [id,it] of Object.entries(G.ITEMS)){
      if(tab==='buy'&&it.buy){added++;const locked=id==='pumpkinSeed'&&state.community.stage!==2;row(it.icon,it.name,`${locked?'온실 복구 후 입고':(id==='sapling'?W.TREE_DAYS:G.CROPS[id].days)+'일 성장'} · 보유 ${state.bag[id]||0}개`,`${it.buy} 동전`,()=>{act('buy',{item:id});shop(tab);},locked||state.gold<it.buy||G.count(state)>=G.CAPACITY);}
      if(tab==='sell'&&it.sell&&state.bag[id]){added++;const amount=state.bag[id];row(it.icon,it.name,`${amount}개 보유 · 개당 ${it.sell} 동전`,'1개 판매',()=>{act('sell',{item:id});shop(tab);});if(amount>1){const b=document.createElement('button');b.className='btn';b.textContent=`전부 ${amount}개 · ${amount*it.sell}`;b.onclick=()=>{act('sell',{item:id,amount});shop(tab);};$('modal-body').lastElementChild.appendChild(b);}}
    }
    if(!added)$('modal-body').innerHTML+='<p class="empty">판매할 물건이 없어요. 나뭇가지나 조개를 모아 보세요.</p>';
  }
  function goToWorkshop(){
    if(state.scene!=='outside'||state.map!==W.WORKSHOP.map){toast('모루의 공방은 마을 광장 아래에 있어요. 지도(M)로 마을에 가 주세요.');return;}
    close();const target={kind:'workshop',...W.WORKSHOP.door,name:'모루의 공방'};route(target.x,target.y,target);
  }
  function workshop(tab='tools'){
    open('모루의 공방',`<p class="modal-copy">낡은 도구에 새 힘을, 나의 농장에 새 가구를.<br>가진 동전 <b>${state.gold}</b> · 재료는 배낭에서 사용해요. 창고 재료는 먼저 꺼내 주세요.</p><div class="tabs"><button class="btn ${tab==='tools'?'primary':''}" id="workshop-tools">도구 업그레이드</button><button class="btn ${tab==='furniture'?'primary':''}" id="workshop-furniture">가구 제작</button></div>`,'MORU’S WORKSHOP');
    $('workshop-tools').onclick=()=>workshop('tools');$('workshop-furniture').onclick=()=>workshop('furniture');
    if(tab==='tools'){
      for(const [id,spec] of Object.entries(G.TOOL_UPGRADES)){
        const level=state.toolUpgrades[id],current=spec.levels[level],next=spec.levels[level+1],card=document.createElement('section');card.className='upgrade-card';
        card.innerHTML=`<div class="upgrade-heading"><strong>${spec.icon} ${current.tier} ${spec.name}</strong><span>${level} / 2 단계</span></div><p class="upgrade-current">현재 · ${current.effect}</p>`;
        if(next){
          const enough=state.gold>=next.gold&&Object.entries(next.materials).every(([item,n])=>(state.bag[item]||0)>=n);
          card.innerHTML+=`<div class="upgrade-next"><b>→ ${next.tier} ${spec.name}</b><p>${next.effect}</p></div><p class="upgrade-cost">동전 ${state.gold}/${next.gold} · ${Object.entries(next.materials).map(([item,n])=>`${G.ITEMS[item].name} ${state.bag[item]||0}/${n}`).join(' · ')}</p>`;
          const b=document.createElement('button');b.className='btn primary';b.textContent=enough?`${next.gold} 동전 + 재료로 업그레이드`:'동전과 재료가 더 필요해요';b.disabled=!enough;b.onclick=()=>{act('upgradeTool',{tool:id,expectedLevel:level});workshop('tools');};card.appendChild(b);
        }else card.innerHTML+='<p class="upgrade-complete">✦ 최고 단계 · 모루의 손길로 완성했어요.</p>';
        $('modal-body').appendChild(card);
      }
      return;
    }
    $('modal-body').insertAdjacentHTML('beforeend','<p class="note">가구 제작에는 기운 5가 필요해요. 만든 가구는 집 안이나 농장에 놓을 수 있어요.</p>');
    for(const [id,it] of Object.entries(G.ITEMS)){if(!it.recipe)continue;const locked=id==='lantern'&&state.requests.moru_wood!=='done';row(it.icon,it.name,locked?'모루의 첫 부탁을 해결하면 열려요':Object.entries(it.recipe).map(([k,n])=>`${G.ITEMS[k].name} ${state.bag[k]||0}/${n}`).join(' · '),'만들기',()=>{act('craft',{item:id});workshop('furniture');},locked||state.energy<5||Object.entries(it.recipe).some(([k,n])=>(state.bag[k]||0)<n));}
  }
  function talk(n){
    const result=G.action(state,'talk',{id:n.id});dirty=true;save();update();open(`${n.animal} ${n.name}`,`<p class="modal-copy">“${result.msg}”</p><p class="note">${n.job} · 호감도 ${'♥'.repeat(state.friends[n.id].hearts)}${'♡'.repeat(5-state.friends[n.id].hearts)}</p>`,'OUR NEIGHBORS');
    button('도와줄 일이 있을까?',()=>requestList(n.id),true);
    const it=G.ITEMS[n.gift];button(`${it.icon} ${it.name} 선물하기 (보유 ${state.bag[n.gift]||0}개)`,()=>{const r=act('gift',{id:n.id});if(r.ok){$('modal-body').innerHTML=`<p class="modal-copy">“${r.msg}”</p>`;button('내일 또 만나!',close,true);}}).disabled=!(state.bag[n.gift]>0)||state.friends[n.id].giftDay===state.day;
    button('다음에 또 이야기해요',close);
  }
  function requestList(npc){
    open(npc?`${G.NPCS.find(n=>n.id===npc).name}의 부탁`:'이웃의 작은 부탁','<p class="modal-copy">기한은 없어요. 수락한 뒤 물건을 모아 여기서 전달해 주세요. 동전과 호감도, 이웃의 편지를 받습니다.</p>','LITTLE FAVORS');
    G.REQUESTS.filter(q=>!npc||q.npc===npc).forEach(q=>{
      const status=state.requests[q.id],locked=q.stage>state.community.stage;
      row(G.NPCS.find(n=>n.id===q.npc).animal,q.title,`${G.ITEMS[q.item].name} ${state.bag[q.item]||0}/${q.amount} · ${q.gold} 동전${q.id==='moru_wood'?' + 등불 제작법':''}`,locked?'뼈대 복구 후':status==='done'?'전달 완료':status==='active'?'전달하기':'부탁 수락',()=>{act(status==='active'?'deliverRequest':'acceptRequest',{id:q.id});requestList(npc);},locked||status==='done'||status==='active'&&(state.bag[q.item]||0)<q.amount);
    });
    button('온실 복구 현황',board);
  }
  function mailbox(){
    const letters=G.letters(state);open('이웃에게서 온 편지','<p class="modal-copy">우리 마을에 쌓인 작은 마음들을 꺼내 읽어요.</p>','LETTERS FROM HOME');
    if(!letters.length)$('modal-body').innerHTML+='<p class="empty">이웃의 부탁을 해결하면 첫 편지가 도착해요.</p>';
    letters.forEach(l=>row('✉',l.title,state.readLetters.includes(l.id)?'읽은 편지':'새 편지','읽기',()=>{G.action(state,'readLetter',{id:l.id});save();update();open(l.title,`<p class="letter-paper">${l.body}</p>`,'DEAR MY NEIGHBOR');button('편지함으로',mailbox);}));
  }
  function board(){
    const stage=state.community.stage,p=G.PROJECTS[stage];
    open('다시 여는 우리의 온실',`<div class="project-art stage-${stage}">${stage===2?'🌿':'⌂'}<span>${['잊힌 정원에 다시 첫걸음','튼튼한 뼈대 위에 새 계절을','모두의 손길로 열린 온실'][stage]}</span></div><p class="modal-copy">주민의 부탁을 해결하고 자재를 모아 농장 오른쪽 위의 낡은 온실을 복구해요.</p>`,'CHAPTER 02 · GROWING TOGETHER');
    if(p){const done=G.REQUESTS.filter(q=>q.stage===stage&&state.requests[q.id]==='done').length;$('modal-body').innerHTML+=`<div class="note"><b>${stage+1}단계 · ${p.title}</b><br>이번 단계 부탁 ${done}/3개 해결<br>나뭇가지 ${state.bag.wood||0}/${p.wood} · 조약돌 ${state.bag.stone||0}/${p.stone} · 동전 ${state.gold}/${p.gold}</div>`;button('주민 부탁 확인하기',()=>requestList());button('자재를 전달하고 복구하기',()=>{if(act('restoreGreenhouse').ok)board();},true).disabled=done<3||(state.bag.wood||0)<p.wood||(state.bag.stone||0)<p.stone||state.gold<p.gold;}
    else{$('modal-body').innerHTML+='<p class="note">자동 급수 텃밭 6칸과 달빛 호박이 열렸어요. 농장 오른쪽 위의 온실을 클릭해 들어가세요. 씨앗은 초록 상점에서 살 수 있어요.</p>';button('온실로 걸어가기',()=>{close();goToGreenhouse();},true);}
    button('우리의 첫 달빛 축제',festival);
  }
  function festival(){open('우리의 첫 달빛 축제',`<p class="modal-copy">등불 아래 이웃과 함께 모여요.</p><div class="note">수확 ${Math.min(5,state.stats.harvested)}/5 · 제작 ${Math.min(1,state.stats.crafted)}/1<br>이웃 호감도 3칸: ${G.NPCS.filter(n=>state.friends[n.id].hearts>=3).length}/3</div>`);button(state.festival?'축제를 열었어요!':'함께 축제 열기 · 200 동전',()=>{if(act('festival').ok)close();},true).disabled=state.festival;}
  function goToGreenhouse(){if(state.scene!=='outside'||state.map!==W.GREENHOUSE.map){toast('공동 온실은 농장 오른쪽 위에 있어요. 농장으로 돌아가 주세요.');return;}const target=targets().find(o=>o.kind==='greenhouse');route(target.x,target.y,target);}
  function enterGreenhouse(){if(state.community.stage!==2){board();return;}state.scene='greenhouse';state.map=W.GREENHOUSE.map;state.player={x:16,y:15};view.x=16;view.y=15;path=[];pending=null;farmQueue=[];placement=null;view.placement=null;save();update();toast('온실에 오신 걸 환영해요. 매일 자동으로 물을 줍니다.');}
  function home(){open('포근한 집으로',`<p class="modal-copy">창가로 따뜻한 빛이 들어와요. 오늘 모은 가구를 놓거나, 푹 자고 내일을 맞이해요.</p>`,'HOME, SWEET HOME');button('집 안으로 들어가기',()=>{state.scene='inside';state.player={x:16,y:15};ensurePosition();view.x=state.player.x;view.y=state.player.y;close();dirty=true;save();update();},true);button('잠자기 · 다음 날로',rest);}
  function rest(){const plots=W.farmStates(state),empty=plots.filter(p=>p.tilled&&!p.crop&&p.emptyDays>=G.SOIL_RESET_DAYS-1).length,withering=plots.filter(p=>p.crop&&!p.watered&&G.weather(state)!=='rain'&&p.dryDays>=G.SOIL_RESET_DAYS-1).length;const warning=(empty?`<br><b>씨앗 없이 방치한 밭 ${empty}칸이 내일 원래 땅으로 돌아가요.</b>`:'')+(withering?`<br><b>작물 ${withering}개가 내일 가뭄으로 사라져요. 자기 전에 물을 주세요.</b>`:'');const dry=W.farmStates(state).filter(p=>p.crop&&!p.watered&&p.growth<(p.crop==='seed'?2:3)).length;open('오늘도 수고했어요.',`<p class="modal-copy">잠을 자면 기운이 모두 회복되고, 물을 준 작물이 한 뼘 자라요. ${dry?`<br><b>아직 물을 주지 않은 작물이 ${dry}개 있어요.</b>`:'텃밭도 편안한 밤을 보낼 준비가 됐어요.'}${warning}</p>`,'GOOD NIGHT');button('푹 자고 새로운 아침 맞이하기',()=>{const msg=G.nextDay(state);view.x=state.player.x;view.y=state.player.y;placement=null;view.placement=null;dirty=true;save();update();close();toast(msg);},true);button('조금 더 둘러볼게요',close);}
  function canDecorate(){return state.scene==='inside'||state.scene==='outside'&&state.map==='farm';}
  function chooseSapling(){if(state.scene!=='outside'){toast('묘목은 야외에서 심어 주세요.');return;}close();placement='sapling';view.placement='sapling';tool='seed';view.tool='seed';update();toast('그루터기를 제거한 나무 자리를 클릭해 묘목을 심으세요.');}
  function nodeLabel(n){const hits=state.nodeHits[n.id]||0;if(n.type==='tree'){if(Object.hasOwn(state.treeGrowth,n.id))return `묘목 성장 중 · ${W.TREE_DAYS-state.treeGrowth[n.id]}일 남음`;return hits>=n.hits?`그루터기 제거 (${hits-n.hits}/${W.STUMP_HITS})`:`벌목하기 (${hits}/${n.hits})`;}return hits>=n.hits?'돌멩이 줍기 · 조약돌 1개':`돌 캐기 · ${Math.ceil((n.hits-hits)/G.nodePower(state,n))}회 남음 · 조약돌 ${G.nodeYield(state,n)}개`;}
  function decoration(){if(!canDecorate()){toast('나의 집이나 농장에서 가구를 놓을 수 있어요.');return;}open('나만의 공간 꾸미기','<p class="modal-copy">가구를 고르고 빈칸을 클릭해 놓아요. 초록 표시는 배치 후보, 빨간 표시는 놓을 수 없는 자리예요. 통로를 막는 배치는 제한됩니다.<br>손 도구로 놓인 가구를 클릭하면 옆으로 걸어가 회수해요.</p>','MAKE YOURSELF AT HOME');let found=false;for(const id of G.FURNITURE)if(state.bag[id]&&(id!=='fence'||state.scene==='outside')){found=true;row(G.ITEMS[id].icon,G.ITEMS[id].name,`${state.bag[id]}개`,'놓기',()=>chooseFurniture(id));}if(!found)$('modal-body').innerHTML+='<p class="empty">마을의 작은 공방에서 벤치·화분·등불·울타리를 만들어 보세요.</p>';}
  function chooseFurniture(id){if(!canDecorate()||id==='fence'&&state.scene!=='outside'){close();toast('가구는 집이나 농장에, 울타리는 농장에 놓아 주세요.');return;}placement=id;view.placement=id;tool='decorate';update();close();toast('빈칸을 클릭해 놓으세요. Esc 키로 취소할 수 있어요.');}
  function selectTool(id){if(id==='rod'){fishing();canvas.focus({preventScroll:true});return;}farmQueue=[];path=[];pending=null;placement=null;view.placement=null;fish=null;view.fishing=null;tool=id;view.tool=id;update();if(id==='decorate')decoration();canvas.focus({preventScroll:true});}
  function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function help(){open('달빛골 생활 안내',`<div class="help-grid"><b>이동</b><span>WASD · 방향키 · 지도 클릭</span><b>상호작용</b><span>대상 옆에서 E 또는 Space · 대상 클릭</span><b>도구 선택</b><span>숫자 1–4 · 아래 도구 클릭 · 씨앗 버튼 더블클릭으로 종류 선택</span><b>농사</b><span>농장 빈 땅에서 괭이(2)를 들고 원하는 칸을 클릭하면 새 밭을 만들어요. E는 바라보는 방향의 빈 땅을 갈아요. 초록 테두리는 경작 가능, 붉은 테두리는 보호된 자리예요. 길·출입구·나무·채집물 자리는 남겨 두어요. 만든 밭 옆에서 괭이 → 씨앗 → 물. 건물·나무·식물은 돌아가고 울타리는 입구로 드나들어요. 물을 준 날만 성장해요. 다 자라면 어떤 도구로도 수확해요. 수확한 칸은 원래 땅으로 돌아가요. 씨앗 없이 3일 둔 밭은 원래 땅으로 돌아가요. 작물이 있어도 3일 연속 물을 못 받으면 작물과 밭이 함께 사라져요. 비나 물뿌리개로 물을 받으면 가뭄 일수가 초기화돼요. 온실은 자동 급수로 보호돼요. 다시 괭이질 → 씨앗 → 물주기를 반복하고, 수확물은 마을 상점에서 팔아 다음 씨앗과 도구를 마련하세요.</span><b>낚시</b><span>강가·물가·부두 끝에서 머리 위 낚시하기 버튼 또는 E. 입질이 뜨면 2초 안에 버튼이나 E를 한 번 더! 이어지는 미니게임(기본 12초, 업그레이드 시 최대 16초)에서 Space·당기기를 누르면 초록 구역이 오른쪽, 놓으면 왼쪽으로 움직여요. 물고기를 구역 안에 유지해 포획 게이지를 채우세요. Esc로 취소할 수 있어요.</span><b>도구 업그레이드</b><span>마을 광장 아래 모루의 공방에서 괭이·낚싯대·곡괭이를 두 단계까지 강화해요. 필요한 재료·동전과 효과를 확인할 수 있어요.</span><b>벌목·채광</b><span>나무·그루터기·바위 옆에 서면 머리 위 작업 버튼이 나타나요. 버튼 또는 E로 알맞은 도구를 자동 사용해요. 나무를 3번, 기본 곡괭이로 바위를 2번 작업해 재료 3개를 얻어요. 강화하면 한 번에 캐고 최대 5개를 얻어요. 작업마다 기운 2를 써요. 벌목 후 그루터기를 도끼로 2번 더 치면 제거되어 나뭇가지 1개를 얻어요. 나무는 자동으로 다시 자라지 않아요. 상점의 묘목(20동전)을 배낭에서 선택해 제거한 나무 자리에 심으면 3일 뒤 자라요. 바위를 다 캔 뒤 남는 돌멩이는 버튼이나 E로 기운 소모 없이 주워 조약돌 1개를 더 얻어요. 바위만 다음 날 복구돼요.</span><b>창고</b><span>집 오른쪽 앞 상자를 클릭하거나 창고 버튼으로 걸어가요. 600개까지 맡기고 꺼낼 수 있어요.</span><b>꾸미기</b><span>공방에서 만든 가구는 배낭에서 선택해 집 안이나 농장에 배치해요. 집 안에서는 왼쪽 위 가구 버튼도 사용할 수 있어요. 손 도구로 회수할 수 있어요. 울타리는 야외 전용이에요.</span><b>시간과 계절</b><span>하루 약 12분 · 계절마다 7일. 메뉴와 다른 탭에서는 멈춰요. 작물은 계절이 바뀌어도 시들지 않아요.</span><b>저장</b><span>이 브라우저에 자동 저장돼요. 다른 브라우저로 옮기기 전 백업을 받아 주세요.</span></div>`,'A GUIDE TO SLOW LIVING');button('저장 파일 내려받기',()=>download(JSON.stringify(state,null,2),`달빛골-${state.day}일차.json`));const label=document.createElement('label');label.className='file-label';label.textContent='저장 파일 불러오기';const input=document.createElement('input');input.type='file';input.accept='.json,application/json';label.appendChild(input);$('modal-body').appendChild(label);input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>100000)throw Error('저장 파일이 너무 커요.');const loaded=G.validate(JSON.parse(await file.text()));open('이 이야기로 이어갈까요?',`<p class="modal-copy">${loaded.day}일차 · ${loaded.gold} 동전. 현재 진행 상황을 바꿉니다. 필요하다면 먼저 현재 이야기를 백업해 주세요.</p>`);button('현재 이야기 백업',()=>download(JSON.stringify(state,null,2),'달빛골-불러오기-전-백업.json'));button('불러오기',()=>{state=loaded;canSave=true;rawSave=null;placement=null;view.placement=null;ensurePosition();view.x=state.player.x;view.y=state.player.y;save();update();close();toast('저장된 마을로 돌아왔어요.');},true);}catch(e){toast('불러오지 못했어요. '+e.message,false);}};}
  function playerOccupies(x,y){return state.player.x===x&&state.player.y===y||x>=Math.floor(view.x)&&x<=Math.ceil(view.x)&&y>=Math.floor(view.y)&&y<=Math.ceil(view.y);}
  function blocked(x,y){return W.occupied(state,x,y)||state.scene==='outside'&&state.map==='village'&&residents().some(n=>residentOccupies(n,x,y));}
  function canMove(from,to){return W.canStep(state,from,to)&&!blocked(to.x,to.y);}
  function motionReady(){return Math.hypot(view.x-state.player.x,view.y-state.player.y)<.001;}
  function ensurePosition(){
    if(!blocked(state.player.x,state.player.y))return;
    const safe=W.safePosition(state,state.player,(x,y)=>blocked(x,y));
    if(safe){state.player=safe;view.x=safe.x;view.y=safe.y;path=[];pending=null;farmQueue=[];dirty=true;}
  }
  function plotTargets(){if(state.scene!=='greenhouse'&&(state.scene!=='outside'||state.map!=='farm'))return [];const greenhouse=state.scene==='greenhouse',ps=greenhouse?state.greenhousePlots:W.farmStates(state);return (greenhouse?G.GREEN_PLOTS:W.farmPoints(state)).map((p,index)=>({...p,index,zone:greenhouse?'greenhouse':'outside',kind:'plot',name:G.mature(ps[index])?'작물 수확':!ps[index].tilled?'괭이(2)로 땅 갈기':tool==='hoe'?'땅 갈기':tool==='seed'?`${G.ITEMS[state.selectedSeed].name} 심기`:tool==='water'?'물 주기':'텃밭 살펴보기'})).filter(p=>greenhouse||ps[p.index].crop||!W.occupied(state,p.x,p.y));}
  function bareSoilTarget(x,y){return tool==='hoe'&&!W.tillError(state,x,y)&&!W.farmPoints(state).some(p=>p.x===x&&p.y===y)?{kind:'till',x,y,name:'새 밭 만들기 · 괭이'}:null;}
  function targets(){
    if(state.scene==='greenhouse')return [{kind:'exit',x:16,y:17,name:'농장으로 나가기'},...plotTargets()];
    if(state.scene==='inside')return [{kind:'exit',x:16,y:17,name:'농장으로 나가기'},{kind:'bed',x:20,y:11,name:'잠자기'},...state.furniture.map(f=>({...f,kind:'furniture',name:'가구 회수'}))];
    const local=state.map==='farm'?[{kind:'home',x:7,y:9,name:'집으로 들어가기'},{kind:'storage',...W.STORAGE,name:'창고 열기'},...state.outdoorFurniture.map(f=>({...f,kind:'furniture',name:G.ITEMS[f.item].name+' 회수'})),{kind:'greenhouse',...W.GREENHOUSE.door,name:state.community.stage===2?'온실로 들어가기':'공동 온실 복구'},...plotTargets()]:state.map==='village'?[{kind:'shop',x:19,y:8,name:'초록 상점'},{kind:'workshop',...W.WORKSHOP.door,name:'모루의 공방 · 도구 업그레이드'},{kind:'board',x:14,y:9,name:'마을 게시판'},...residents().map(n=>({...n,kind:'npc',name:`${n.name}와 대화`}))]:[];
    return [...W.NODES.filter(n=>n.map===state.map&&!W.treeRemoved(state,n)&&!W.rockRemoved(state,n)).map(n=>({...n,kind:'node',name:nodeLabel(n)})),...W.MAPS[state.map].exits.map(e=>({...e,kind:'travel'})),...local,...G.RESOURCES.map((r,index)=>({...r,index,kind:'resource',name:G.ITEMS[r.item].name+' 줍기'})).filter(r=>r.map===state.map&&!state.gathered.includes(r.index))];
  }
  function clickedTarget(x,y){const all=targets();return all.find(o=>o.kind==='npc'&&Math.abs(o.drawX-x)<.8&&y>=o.drawY-1.6&&y<=o.drawY+.6)||all.find(o=>o.x===x&&o.y===y)||all.find(o=>o.kind==='node'&&o.type==='tree'&&(state.nodeHits[o.id]||0)<o.hits&&!Object.hasOwn(state.treeGrowth,o.id)&&o.x===x&&y>=o.y-2&&y<=o.y)||all.find(o=>o.kind==='workshop'&&x>=W.WORKSHOP.x&&x<W.WORKSHOP.x+W.WORKSHOP.width&&y>=W.WORKSHOP.y-1&&y<W.WORKSHOP.y+W.WORKSHOP.height)||all.find(o=>o.kind==='board'&&x>=13&&x<=14&&y===8)||all.find(o=>o.kind==='bed'&&x>=19&&x<=21&&y>=8&&y<=11);}
  function nearest(){const p=state.player,soil=bareSoilTarget(p.x+view.aim.x,p.y+view.aim.y);if(soil&&W.canReach(state,p,soil))return soil;return targets().map(o=>({...o,d:Math.hypot(p.x-o.x,p.y-o.y)})).filter(o=>W.canReach(state,p,o)).sort((a,b)=>(b.kind==='node'&&b.tool===tool?1:0)-(a.kind==='node'&&a.tool===tool?1:0)||a.d-b.d)[0];}
  function fishing(){
    if(modal.open)return;
    if(!W.fishingSpot(state)){fish=null;view.fishing=null;toast('마을 강가나 바닷가 물가·부두 끝으로 가 주세요.');return;}
    if(!motionReady())return;
    if(fish){if(fish.status==='bite')startFishingGame();else if(fish.status==='waiting')toast('아직이에요. 찌가 움직일 때를 기다려요.');return;}
    if(state.energy<2||G.count(state)>=G.CAPACITY){toast('기운과 배낭 공간이 필요해요.',false);return;}
    held.clear();path=[];pending=null;farmQueue=[];placement=null;view.placement=null;
    fish={status:'waiting',remaining:1.8+Math.random()*1.8};view.fishing='waiting';toast('찌를 바라보며 기다려요…');
  }
  function startFishingGame(){
    held.clear();path=[];pending=null;
    const profile=G.toolProfile(state,'rod');
    fish={status:'reeling',remaining:profile.seconds,elapsed:0,zone:.5,zoneWidth:profile.zoneWidth,position:.5,target:.72,turnIn:1.4,progress:.15,keyHeld:false,pointerId:null,tracking:true};
    view.fishing='reeling';updateFishingGameUI();canvas.focus({preventScroll:true});
    toast('Space 또는 당기기를 누르면 오른쪽, 놓으면 왼쪽! 물고기를 초록 구역에 유지하세요.');
  }
  function cancelFishingGame(){fish=null;view.fishing=null;held.clear();updateFishingGameUI();canvas.focus({preventScroll:true});toast('낚시를 취소했어요. 다시 도전할 수 있어요.');}
  function tickFishing(dt){
    if(!fish)return;
    if(fish.status!=='reeling'){
      fish.remaining-=dt;
      if(fish.remaining<=0){
        if(fish.status==='waiting'){fish.status='bite';fish.remaining=2;view.fishing='bite';toast('입질이에요! 머리 위 버튼이나 E를 누르세요!');}
        else{fish=null;view.fishing=null;toast('물고기가 달아났어요. 다시 도전해 봐요.');}
      }
      return;
    }
    const game=fish,step=Math.min(dt,game.remaining),pulling=game.keyHeld||game.pointerId!==null;
    game.remaining=Math.max(0,game.remaining-step);game.elapsed+=step;game.turnIn-=step;
    if(game.turnIn<=0){game.target=.12+Math.random()*.76;game.turnIn=.9+Math.random()*1.3;}
    const half=game.zoneWidth/2;
    game.zone=Math.max(half,Math.min(1-half,game.zone+(pulling?.44:-.32)*step));
    const difference=game.target-game.position;
    game.position+=Math.sign(difference)*Math.min(Math.abs(difference),(.14+Math.abs(difference)*.22)*step);
    game.tracking=Math.abs(game.position-game.zone)<=half;
    game.progress=Math.max(0,Math.min(1,game.progress+(game.tracking?.24:-.075)*step));
    if(game.progress>=1){fish=null;view.fishing=null;act('fish');}
    else if(game.remaining<=0){fish=null;view.fishing=null;toast('시간이 다 되어 물고기가 도망갔어요. 다시 도전해 봐요.');}
  }
  function updateFishingGameUI(){
    const panel=$('fishing-game'),game=fish?.status==='reeling'?fish:null;
    panel.hidden=!game||modal.open;if(panel.hidden)return;
    $('fishing-rod-level').textContent=G.toolProfile(state,'rod').tier+' 낚싯대';
    $('fishing-timer').textContent=Math.ceil(game.remaining)+'초';
    $('fishing-zone').style.left=(game.zone-game.zoneWidth/2)*100+'%';
    $('fishing-zone').style.width=game.zoneWidth*100+'%';
    $('fishing-marker').style.left=game.position*100+'%';
    const progress=Math.round(game.progress*100);
    $('fishing-progress-fill').style.width=progress+'%';
    $('fishing-progress').setAttribute('aria-valuenow',progress);
    $('fishing-progress-value').textContent=progress+'%';
    $('fishing-tracking').textContent=game.tracking?'잘 잡고 있어요!':'초록 구역으로 따라가요';
    panel.dataset.tracking=game.tracking;
    $('fishing-pull').setAttribute('aria-pressed',game.keyHeld||game.pointerId!==null);
  }
  function updateFishingButton(){
    const button=$('fishing-button'),visible=fish?.status!=='reeling'&&W.fishingSpot(state)&&!modal.open&&!placement&&!path.length&&motionReady();
    button.hidden=!visible;if(!visible)return;
    const status=fish?.status||'ready',text=status==='bite'?'❗ 지금 낚아채기!':status==='waiting'?'찌를 기다리는 중…':'🎣 낚시하기';
    if(button.textContent!==text)button.textContent=text;
    button.dataset.status=status;button.setAttribute('aria-disabled',status==='waiting');
    button.style.left=`clamp(76px, ${(view.x+.5)/32*100}%, calc(100% - 76px))`;
    button.style.top=`${Math.max(5,(view.y*32-38)/704*100)}%`;
  }
  function nodeActionTarget(){
    if(state.scene!=='outside'||modal.open||placement||fish||W.fishingSpot(state)||path.length||!motionReady())return null;
    const p=state.player;
    return W.NODES.filter(n=>n.map===state.map&&W.canReach(state,p,n)&&(n.type==='tree'?!W.treeRemoved(state,n)&&!Object.hasOwn(state.treeGrowth,n.id):!W.rockRemoved(state,n)))
      .sort((a,b)=>{
        const facing=n=>n.x===p.x+view.aim.x&&n.y===p.y+view.aim.y?1:0;
        return facing(b)-facing(a)||Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y);
      })[0]||null;
  }
  function updateNodeButton(){
    const button=$('node-button'),n=nodeActionTarget();
    button.hidden=!n;if(!n)return;
    const hits=state.nodeHits[n.id]||0,stump=n.type==='tree'&&hits>=n.hits;
    const remaining=stump?n.hits+W.STUMP_HITS-hits:Math.ceil((n.hits-hits)/G.nodePower(state,n));
    const label=n.type==='tree'?(stump?'🪓 그루터기 제거':'🪓 벌목하기'):'⛏️ 채광하기';
    const text=n.type==='rock'&&hits>=n.hits?'🪨 돌멩이 줍기 · E':`${label} · ${remaining}회 남음 · E`;
    if(button.textContent!==text)button.textContent=text;
    button.title=`${nodeLabel(n)} · E`;
    button.style.left=`clamp(105px, ${(view.x+.5)/32*100}%, calc(100% - 105px))`;
    button.style.top=`${Math.max(5,(view.y*32-38)/704*100)}%`;
  }
  function interact(target){
    if(modal.open)return;if(!target&&!placement&&W.fishingSpot(state)){fishing();return;}const node=!target&&nodeActionTarget(),o=target||(node?{...node,kind:'node'}:nearest());if(!o){toast('조금 더 가까이 가서 사용해 보세요.');return;}
    if(o.kind==='npc'){const n=residents().find(n=>n.id===o.id);o.x=n.x;o.y=n.y;}
    if(!W.canReach(state,state.player,o)){toast('장애물을 돌아 대상 옆으로 가 주세요.');farmQueue=[];return;}
    if(['plot','till'].includes(o.kind)&&o.x===state.player.x&&o.y===state.player.y){route(o.x,o.y,o);return;}
    switch(o.kind){
      case 'plantTree':if(act('plantTree',{x:o.x,y:o.y}).ok){placement=null;view.placement=null;}break;
      case 'till':act('till',{x:o.x,y:o.y,tool});break;
      case 'plot':{const r=act('plot',{index:o.index,zone:o.zone,tool});if(r.ok)continueFarm();else farmQueue=[];break;}
      case 'node':{const pickup=o.type==='rock'&&(state.nodeHits[o.id]||0)>=o.hits;if(act('harvestNode',{id:o.id,tool:pickup?'hand':o.tool}).ok)view.work={x:o.x,y:o.y,icon:pickup?'🪨':o.tool==='axe'?'🪓':'⛏',until:performance.now()+550};break;}
      case 'storage':storage();break;
      case 'resource':act('gather',{index:o.index});break;
      case 'travel':travel(o);break;
      case 'npc':talk(G.NPCS.find(n=>n.id===o.id));break;
      case 'shop':shop();break;case 'workshop':workshop();break;case 'home':home();break;case 'board':board();break;case 'bed':rest();break;case 'greenhouse':enterGreenhouse();break;
      case 'exit':{const greenhouse=state.scene==='greenhouse';state.scene='outside';state.map='farm';state.player=greenhouse?{...W.GREENHOUSE.door}:{x:7,y:9};view.x=state.player.x;view.y=state.player.y;placement=null;view.placement=null;dirty=true;save();update();break;}
      case 'furniture':if(tool==='hand')act('remove',o);else toast('손 도구를 선택하면 가구를 회수해요.');break;
    }
  }
  function continueFarm(){const plots=state.scene==='greenhouse'?state.greenhousePlots:W.farmStates(state);while(farmQueue.length&&tool==='hoe'&&plots[farmQueue[0].index].tilled)farmQueue.shift();if(!farmQueue.length)return;const target=farmQueue.shift();route(target.x,target.y,target);}
  function tendGarden(){
    if(!plotTargets().length||!['hand','hoe','seed','water'].includes(tool)){toast('텃밭에서 손·괭이·씨앗·물뿌리개 중 하나를 골라 주세요.');return;}
    const ps=state.scene==='greenhouse'?state.greenhousePlots:W.farmStates(state);
    farmQueue=plotTargets().filter(o=>{const p=ps[o.index];return tool==='hand'?G.mature(p):tool==='hoe'?!p.tilled:tool==='seed'?p.tilled&&!p.crop:p.crop&&!p.watered&&!G.mature(p);});
    if(!farmQueue.length){toast('선택한 도구로 돌볼 밭이 없어요.');return;}
    path=[];pending=null;toast(`${farmQueue.length}칸을 차례대로 돌봐요. 이동하거나 Esc를 누르면 멈춰요.`);continueFarm();canvas.focus({preventScroll:true});
  }
  function faceMovement(dx,dy){if(dx||dy){view.facing=dx<0?'left':'front';view.aim={x:dx,y:dy};}}
  function move(dx,dy){if(fish?.status==='reeling')return false;farmQueue=[];if(dx)dy=0;faceMovement(dx,dy);if(!motionReady())return false;const x=state.player.x+dx,y=state.player.y+dy;if(!canMove(state.player,{x,y}))return false;state.player={x,y};fish=null;view.fishing=null;dirty=true;if(!checkExit())update();return true;}
  function route(tx,ty,target){fish=null;view.fishing=null;const adjacent=target&&(['plot','till','plantTree','resource','npc','furniture','bed','node','storage'].includes(target.kind)||blocked(tx,ty)),result=findPath(state.player,p=>adjacent?(p.x!==tx||p.y!==ty)&&W.canReach(state,p,{x:tx,y:ty}):p.x===tx&&p.y===ty,(x,y,from)=>canMove(from,{x,y}));if(!result){path=[];pending=null;farmQueue=[];toast('그쪽으로는 걸어갈 수 없어요.');return;}path=result;pending=target||null;if(!path.length&&pending){const o=pending;pending=null;interact(o);}}
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();view.pointer={x:Math.floor((e.clientX-r.left)/r.width*32),y:Math.floor((e.clientY-r.top)/r.height*22)};});canvas.addEventListener('pointerleave',()=>view.pointer=null);
  canvas.addEventListener('click',e=>{
    if(modal.open||fish?.status==='reeling')return;
    farmQueue=[];
    canvas.focus({preventScroll:true});
    const r=canvas.getBoundingClientRect();
    const x=Math.floor((e.clientX-r.left)/r.width*32),y=Math.floor((e.clientY-r.top)/r.height*22);
    if(placement==='sapling'){const error=W.treePlantError(state,x,y);if(error){toast(error);return;}route(x,y,{kind:'plantTree',x,y,name:'묘목 심기'});return;}
    if(placement){
      if(x===state.player.x&&y===state.player.y){toast('서 있는 자리를 비운 뒤 놓아 주세요.');return;}
      const error=W.placementError(state,x,y);if(error){toast(error);return;}
      if(act('place',{item:placement,x,y}).ok){placement=null;view.placement=null;tool='hand';update();}
      return;
    }
    const exit=state.scene==='outside'&&W.MAPS[state.map].exits.find(o=>Math.abs(o.x-x)<=1&&Math.abs(o.y-y)<=1);if(exit){route(exit.x,exit.y,{...exit,kind:'travel'});return;}
    const target=clickedTarget(x,y)||bareSoilTarget(x,y);
    if(!target&&tool==='hoe'&&state.scene==='outside'&&state.map==='farm'){toast(W.tillError(state,x,y)||'괭이로 갈 수 있는 빈 땅을 골라 주세요.');return;}
    if(state.scene==='outside'&&state.map===W.GREENHOUSE.map&&x>=W.GREENHOUSE.x&&x<W.GREENHOUSE.x+W.GREENHOUSE.width&&y>=W.GREENHOUSE.y-1&&y<W.GREENHOUSE.y+W.GREENHOUSE.height){goToGreenhouse();return;}
    if(state.scene==='outside'&&state.map==='farm'&&x>=4&&x<=10&&y>=3&&y<=8){route(7,9,targets().find(o=>o.kind==='home'));return;}
    if(state.scene==='outside'&&state.map==='village'&&x>=16&&x<=22&&y>=2&&y<=7){route(19,8,targets().find(o=>o.kind==='shop'));return;}
    route(target?.x??x,target?.y??y,target);
  });
  document.addEventListener('keydown',e=>{
    if(!modal.open&&fish?.status==='reeling'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){
      const key=e.key.toLowerCase();
      if(key===' '){e.preventDefault();fish.keyHeld=true;return;}
      if(key==='escape'){e.preventDefault();cancelFishingGame();return;}
      if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','e','b','m','1','2','3','4'].includes(key)){e.preventDefault();return;}
    }
    if(modal.open||['INPUT','TEXTAREA','BUTTON','SELECT'].includes(e.target.tagName))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','e','b','m','1','2','3','4'].includes(k))e.preventDefault();if(k==='escape'){placement=null;view.placement=null;path=[];pending=null;fish=null;view.fishing=null;return;}if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){held.add(k);path=[];pending=null;}if(e.repeat)return;if(k==='e'||k===' ')interact();if(k==='b')inventory();if(k==='m')showMap();if(+k>=1&&+k<=TOOLS.length)selectTool(TOOLS[+k-1][0]);});document.addEventListener('keyup',e=>{held.delete(e.key.toLowerCase());if(e.key===' '&&fish?.status==='reeling')fish.keyHeld=false;});const clearFishingInput=()=>{held.clear();if(fish?.status==='reeling'){fish.keyHeld=false;fish.pointerId=null;}};window.addEventListener('blur',clearFishingInput);document.addEventListener('visibilitychange',()=>{clearFishingInput();if(document.hidden&&dirty)save();lastFrame=performance.now();});
  function newVillage(){
    open('새로운 첫날을 맞이할까요?','<p class="modal-copy">지금 이야기는 이전 저장으로 보관하고 새 마을을 시작해요. 도움말에서 이전 저장을 내려받아 다시 불러올 수 있습니다. 이전 저장은 가장 최근 한 개만 보관됩니다.</p>');
    button('현재 이야기 내려받기',()=>download(JSON.stringify(state,null,2),'달빛골-새게임-전-백업.json'));
    button('새로운 마을 시작하기',()=>{
      try{localStorage.setItem(KEY+'-previous',rawSave&&loadError?rawSave:JSON.stringify(state));}
      catch{toast('이전 저장을 보관하지 못했어요. 백업을 먼저 내려받아 주세요.',false);return;}
      state=G.fresh();canSave=true;loadError=null;rawSave=null;tool='hand';placement=null;view.placement=null;view.x=state.player.x;view.y=state.player.y;save();update();close();toast('새로운 첫날이에요. 씨앗 5개와 90 동전을 챙겼어요.');
    },true);
    button('현재 마을 계속하기',close);
  }
  function showHelp(){
    help();
    const note=document.createElement('p');note.className='note';note.textContent='맵 이동: 농장 오른쪽은 바닷가, 아래쪽은 마을입니다. 길 끝이나 지도(M)의 길 안내를 이용하세요. 주민 부탁 6개 → 농장 오른쪽 위 온실 2단계 복구 → 자동 급수와 달빛 호박. 도구를 선택하고 지도 위 연속 작업을 누르면 기존 텃밭과 직접 만든 밭을 차례로 돌봐요. 새 밭은 괭이를 들고 농장 빈 땅을 클릭해 만드세요. 이웃 목록을 누르면 현재 위치로 걸어가요.';$('modal-body').prepend(note);
    try{const prior=localStorage.getItem(KEY+'-previous')||localStorage.getItem(TREEKEY+'-previous')||localStorage.getItem(FARMKEY+'-previous')||localStorage.getItem(TOOLKEY+'-previous')||localStorage.getItem(PREVIOUSKEY+'-previous')||localStorage.getItem(MAPKEY+'-previous');if(prior)button('이전 이야기 백업 내려받기',()=>download(prior,'달빛골-이전-이야기.json'));}catch{}
    try{const prior=localStorage.getItem(KEY+'-before-upgrade');if(prior)button('밭 복구 업데이트 전 원본 백업 내려받기',()=>download(prior,'달빛골-v8-업그레이드-전.json'));
      const tree=localStorage.getItem(TREEKEY+'-before-upgrade');if(tree)button('묘목 업데이트 전 원본 백업 내려받기',()=>download(tree,'달빛골-v7-업그레이드-전.json'));
      const farm=localStorage.getItem(FARMKEY+'-before-upgrade');if(farm)button('자유 농장 추가 전 원본 백업 내려받기',()=>download(farm,'달빛골-v6-업그레이드-전.json'));
      const tools=localStorage.getItem(TOOLKEY+'-before-upgrade');if(tools)button('공방 업그레이드 전 원본 백업 내려받기',()=>download(tools,'달빛골-v5-업그레이드-전.json'));
      const older=localStorage.getItem(PREVIOUSKEY+'-before-upgrade');if(older)button('창고·꾸미기 추가 전 원본 백업 내려받기',()=>download(older,'달빛골-v4-업그레이드-전.json'));}catch{}
    try{const legacy=localStorage.getItem(LEGACYKEY+'-v1-backup');if(legacy)button('1번째 버전 원본 백업 내려받기',()=>download(legacy,'달빛골-v1-원본.json'));}catch{}
    try{const old=localStorage.getItem(MAPKEY+'-before-maps');if(old)button('맵 확장 전 원본 백업 내려받기',()=>download(old,'달빛골-맵-확장-전.json'));}catch{}
    button('새로운 마을 시작',newVillage);
  }
  $('toolbar').onclick=e=>{const b=e.target.closest('[data-tool]');if(b)selectTool(b.dataset.tool);};
  $('toolbar').ondblclick=e=>{if(e.target.closest('[data-tool]')?.dataset.tool==='seed'){e.preventDefault();seedPicker();}};
  $('bag-button').onclick=inventory;
  $('community-button').onclick=board;
  $('requests-button').onclick=()=>requestList();
  $('mail-button').onclick=mailbox;
  $('tend-button').onclick=tendGarden;
  $('decorate-button').onclick=()=>selectTool('decorate');
  $('fishing-cancel').onclick=cancelFishingGame;
  $('fishing-pull').addEventListener('pointerdown',e=>{
    if(e.button!==0||fish?.status!=='reeling'||fish.pointerId!==null)return;
    e.preventDefault();fish.pointerId=e.pointerId;
    $('fishing-pull').setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('fishing-pull').addEventListener(type,e=>{if(fish?.status==='reeling'&&fish.pointerId===e.pointerId)fish.pointerId=null;});
  $('node-button').onclick=()=>{const n=nodeActionTarget();if(n)interact({...n,kind:'node'});canvas.focus({preventScroll:true});updateNodeButton();};
  $('fishing-button').onclick=()=>{if(fish?.status!=='waiting')fishing();canvas.focus({preventScroll:true});updateFishingButton();};
  $('neighbors').onclick=e=>{const b=e.target.closest('[data-npc]');if(!b)return;if(state.scene!=='outside'||state.map!=='village'){toast('이웃들은 마을에 있어요. 농장 아래쪽 길로 내려가 보세요.');return;}farmQueue=[];const n=targets().find(n=>n.kind==='npc'&&n.id===b.dataset.npc);route(n.x,n.y,n);canvas.focus({preventScroll:true});};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')farmQueue=[];});
  $('rest-button').onclick=rest;
  $('rest-button').setAttribute('aria-label','하루 마무리');
  $('help-button').onclick=showHelp;
  $('map-button').onclick=showMap;
  $('storage-button').onclick=goToStorage;
  $('workshop-button').onclick=goToWorkshop;
  $('save-button').onclick=()=>save(true);
  $('audio-button').onclick=()=>{sound=!sound;$('audio-button').setAttribute('aria-pressed',sound);$('audio-button').setAttribute('aria-label',sound?'효과음 끄기':'효과음 켜기');$('audio-button').title=sound?'효과음 끄기':'효과음 켜기';tone();};
  $('touch-action').onclick=()=>interact();
  document.querySelectorAll('[data-move]').forEach(b=>{b.onclick=()=>{const [dx,dy]={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[b.dataset.move];move(dx,dy);};});
  function frame(now){const dt=Math.max(0,Math.min((now-lastFrame)/1000,.1));lastFrame=now;if(!modal.open&&!document.hidden){state.time=Math.min(1320,state.time+dt*840/720);dirty=true;moveResidents(dt);if(now-lastMove>145){lastMove=now;const dx=held.has('a')||held.has('arrowleft')?-1:held.has('d')||held.has('arrowright')?1:0,dy=held.has('w')||held.has('arrowup')?-1:held.has('s')||held.has('arrowdown')?1:0;if(dx||dy)move(dx,dy);else if(path.length&&motionReady()){const p=path.shift();if(!canMove(state.player,p)){path=[];pending=null;farmQueue=[];toast('길이 막혔어요. 목적지를 다시 선택해 주세요.');}else{faceMovement(p.x-state.player.x,p.y-state.player.y);state.player=p;dirty=true;checkExit();update();if(!path.length&&pending){const o=pending;pending=null;interact(o);}}}}tickFishing(dt);if(state.time>=1320&&!bedtimePrompted&&fish?.status!=='reeling'){bedtimePrompted=true;rest();}if(state.time<1320)bedtimePrompted=false;if(now-lastSave>8000&&dirty){save();update();}}
    const delta=Math.hypot(view.x-state.player.x,view.y-state.player.y);view.walking=delta>.001;const fraction=delta?Math.min(1,dt*8/delta):1;view.x+=(state.player.x-view.x)*fraction;view.y+=(state.player.y-view.y)*fraction;view.active=pending;updateFishingButton();updateNodeButton();updateFishingGameUI();const nearby=nearest();const hint=placement?(placement==='sapling'?'그루터기를 제거한 자리 클릭 · 묘목 심기 · Esc 취소':'바닥을 클릭해 가구 놓기 · Esc 취소'):farmQueue.length?`연속 작업 중 · 남은 ${farmQueue.length+1}칸 · Esc 취소`:W.fishingSpot(state)?fish?.status==='bite'?'E · 지금 낚아채기!':fish?'찌를 기다리는 중 · 이동하면 취소':'':!$('node-button').hidden?'':nearby?'E · '+nearby.name:'';$('interaction-hint').textContent=hint;$('interaction-hint').classList.toggle('visible',!!hint&&fish?.status!=='reeling');view.npcPaused=modal.open||document.hidden||state.scene!=='outside'||state.map!=='village';DalbitRender.draw(canvas,state,view);requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide',()=>{if(dirty)save();});
  ensurePosition();view.x=state.player.x;view.y=state.player.y;
  update();if(!firstVisit)$('save-status').textContent='✓ 저장된 이야기를 불러왔어요';requestAnimationFrame(frame);
  if(loadError){open('저장된 이야기를 확인해 주세요.','<p class="modal-copy">저장 데이터를 읽지 못했어요. 기존 데이터는 자동으로 덮어쓰지 않습니다. 백업하거나 새로운 이야기를 시작할 수 있어요.</p>');if(rawSave)button('기존 데이터 그대로 내려받기',()=>download(rawSave,'달빛골-복구용-백업.json'));button('새 이야기로 저장하기',()=>{canSave=true;state=G.fresh();view.x=state.player.x;view.y=state.player.y;save();update();close();},true);button('저장 없이 둘러보기',close);}else if(firstVisit){open('달빛골에 오신 걸 환영해요.',`<div class="welcome-art">🌱 &nbsp; 🏡 &nbsp; ☀</div><p class="modal-copy">작은 텃밭, 느긋한 이웃, 그리고 온전히 나의 하루.<br>주머니에 <b>순무 씨앗 5개와 90 동전</b>을 챙겨 두었어요.</p><p class="note">① 방향키 또는 클릭으로 농장의 빈 땅을 골라요.<br>② 괭이(2) → 씨앗(3) → 물뿌리개(4)를 골라 E.<br>③ 아래쪽 길로 마을에 가서 이웃을 만나요.<br>④ 오른쪽 길은 바닷가예요. 지도(M)로 길을 확인해요.</p>`,'YOUR FIRST LITTLE SEASON');button('나의 첫날 시작하기',()=>{save();close();toast('괭이(2)를 들고 농장 빈 땅을 클릭해 밭을 만들어 봐요.');},true);}
})();
