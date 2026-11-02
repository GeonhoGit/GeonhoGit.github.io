(function(root){
  'use strict';
  const W=root.DalbitWorld||(typeof module!=='undefined'?require('./world.js'):null);
  const ITEMS={sapling:{name:'나무 묘목',icon:'🌳',buy:20},seed:{name:'순무 씨앗',icon:'🌱',buy:12},berrySeed:{name:'딸기 씨앗',icon:'🍓',buy:24},turnip:{name:'순무',icon:'🥬',sell:35},berry:{name:'딸기',icon:'🍓',sell:65},wood:{name:'나뭇가지',icon:'🪵',sell:5},stone:{name:'조약돌',icon:'🪨',sell:6},shell:{name:'조개껍데기',icon:'🐚',sell:12},flower:{name:'들꽃',icon:'🌼',sell:8},fish:{name:'은빛 물고기',icon:'🐟',sell:28},bench:{name:'나무 벤치',icon:'🪑',recipe:{wood:5}},pot:{name:'들꽃 화분',icon:'🪴',recipe:{flower:3,stone:2}}};
  const NPCS=[{id:'moru',name:'모루',animal:'🐻',job:'느긋한 목공가',color:'#a87b55',gift:'wood',line:'숲에서 주운 나뭇가지도 멋진 의자가 될 수 있어. 서두르지 말고 하나씩 모아 봐.',x:15,y:10},{id:'bomi',name:'보미',animal:'🐰',job:'꽃을 좋아하는 정원사',color:'#eee0c9',gift:'flower',line:'매일 물을 주면 작은 씨앗도 쑥쑥 자라. 오늘 네 텃밭엔 어떤 이야기가 자라고 있어?',x:11,y:7},{id:'naru',name:'나루',animal:'🦊',job:'바다를 사랑하는 낚시꾼',color:'#ce8456',gift:'fish',line:'강 옆에서 낚싯대를 꺼내 봐. 입질이 오면 한 번 더 E! 물고기도 느긋한 친구를 좋아하거든.',x:24,y:13}];
  const PLOTS=W.FARM_PLOTS;
  const RESOURCES=W.RESOURCES;
  const TREES=W.MAPS.village.trees;
  const SEASONS=['봄','여름','가을','겨울'];
  const CAPACITY=120,STORAGE_CAPACITY=600;
  const TOOL_UPGRADES={
    hoe:{name:'괭이',icon:'⛏',levels:[
      {tier:'기본',effect:'한 번에 1칸 · 기운 2',energy:2,span:1},
      {tier:'튼튼한',effect:'한 번에 1칸 · 기운 1',energy:1,span:1,gold:40,materials:{wood:3,stone:2}},
      {tier:'장인의',effect:'같은 줄 최대 3칸 · 기운 1',energy:1,span:3,gold:120,materials:{wood:8,stone:6}}
    ]},
    rod:{name:'낚싯대',icon:'🎣',levels:[
      {tier:'기본',effect:'초록 구역 32% · 제한 12초',zoneWidth:.32,seconds:12},
      {tier:'튼튼한',effect:'초록 구역 40% · 제한 14초',zoneWidth:.40,seconds:14,gold:60,materials:{wood:4,stone:2}},
      {tier:'장인의',effect:'초록 구역 48% · 제한 16초',zoneWidth:.48,seconds:16,gold:150,materials:{wood:8,stone:5}}
    ]},
    pickaxe:{name:'곡괭이',icon:'⛏️',levels:[
      {tier:'기본',effect:'바위 2회 작업 · 조약돌 3개',power:1,amount:3},
      {tier:'튼튼한',effect:'바위 1회 작업 · 조약돌 3개',power:2,amount:3,gold:60,materials:{wood:3,stone:4}},
      {tier:'장인의',effect:'바위 1회 작업 · 조약돌 5개',power:2,amount:5,gold:150,materials:{wood:6,stone:10}}
    ]}
  };
  const toolProfile=(s,id)=>TOOL_UPGRADES[id].levels[s.toolUpgrades[id]];
  const nodePower=(s,n)=>n.type==='rock'?toolProfile(s,'pickaxe').power:1;
  const nodeYield=(s,n)=>n.type==='rock'?toolProfile(s,'pickaxe').amount:n.amount;
  const FURNITURE=['bench','pot','lantern','fence'];
  Object.assign(ITEMS,{
    pumpkinSeed:{name:'달빛 호박 씨앗',icon:'🌱',buy:30},
    pumpkin:{name:'달빛 호박',icon:'🎃',sell:95},
    lantern:{name:'조개 등불',icon:'🏮',recipe:{wood:2,shell:1}},
    fence:{name:'나무 울타리',icon:'🪵',recipe:{wood:2}}
  });
  const CROPS={seed:{days:2,item:'turnip'},berrySeed:{days:3,item:'berry'},pumpkinSeed:{days:3,item:'pumpkin'}};
  const GREEN_PLOTS=W.GREEN_PLOTS;
  const SOIL_RESET_DAYS=3;
  const emptyPlot=()=>({tilled:false,crop:null,growth:0,watered:false,emptyDays:0,dryDays:0});
  const REQUESTS=[
    {id:'bomi_turnip',npc:'bomi',stage:0,title:'함께 나눌 첫 수확',item:'turnip',amount:2,gold:60,letter:'네가 기른 순무로 따뜻한 수프를 끓였어. 온실에서도 함께 씨앗을 심는 날이 기다려져. — 보미'},
    {id:'moru_wood',npc:'moru',stage:0,title:'낡은 온실의 설계도',item:'wood',amount:3,gold:35,letter:'온실 뼈대에 쓸 나무를 골랐어. 고마운 마음으로 조개 등불 제작법을 보내. 작은 공방에서 만들어 봐! — 모루'},
    {id:'naru_shell',npc:'naru',stage:0,title:'창가에 걸 바다의 소리',item:'shell',amount:2,gold:40,letter:'조개를 엮어 온실 창가에 걸었어. 바람이 불면 바다 소리가 날 거야. — 나루'},
    {id:'bomi_flower',npc:'bomi',stage:1,title:'온실을 채울 작은 생명',item:'flower',amount:3,gold:30,letter:'네가 가져온 꽃에서 씨앗을 받았어. 온실에 새 계절이 싹틀 준비가 됐어. — 보미'},
    {id:'moru_stone',npc:'moru',stage:1,title:'튼튼한 물길 만들기',item:'stone',amount:3,gold:35,letter:'조약돌로 물길을 만들었어. 온실이 완성되면 매일 자동으로 물이 흘러갈 거야. — 모루'},
    {id:'naru_fish',npc:'naru',stage:1,title:'복구단의 저녁 식사',item:'fish',amount:2,gold:65,letter:'다 같이 모여 네가 잡아 온 물고기로 저녁을 먹었어. 이제 지붕만 올리면 되겠지? — 나루'}
  ];
  const PROJECTS=[{title:'온실 뼈대 세우기',wood:4,stone:2,gold:60},{title:'유리 지붕과 물길 완성',wood:6,stone:3,gold:100}];
  function npcs(s){
    const slot=weather(s)==='rain'?'rain':s.time<720?'morning':s.time<1080?'afternoon':'evening';
    const schedule={morning:[[15,10,'광장'],[11,7,'집 앞 정원'],[24,13,'강가']],afternoon:[[18,14,'작은 공방'],[11,15,'마을 정원'],[25,17,'남쪽 강가']],evening:[[14,11,'광장'],[13,9,'광장'],[18,10,'상점 앞']],rain:[[14,10,'게시판 옆'],[11,9,'집 앞 처마'],[23,8,'상점 처마']]};
    return NPCS.map((n,i)=>({...n,x:schedule[slot][i][0],y:schedule[slot][i][1],place:schedule[slot][i][2]}));
  }
  function dialogue(s,id){
    const n=NPCS.find(n=>n.id===id);if(!n)return '';
    if(s.community.stage===2)return {moru:'온실에 불빛이 켜진 걸 보니 뿌듯해. 네가 없었다면 못 해냈을 거야.',bomi:'우리 온실에서는 매일 물이 흘러. 달빛 호박 씨앗도 초록 상점에 들여놓았어!',naru:'온실 창가의 조개 소리, 들어 봤어? 이제 마을 어디에 있어도 바다가 곁에 있는 것 같아.'}[id];
    if(weather(s)==='rain')return {moru:'비 오는 날에는 나무를 말리며 도면을 그려. 온실이 생기면 비가 와도 일할 수 있겠지.',bomi:'오늘은 하늘이 텃밭에 물을 주네. 잠깐 쉬면서 내 부탁도 읽어 봐 줄래?',naru:'오늘은 상점 처마 아래에서 비 구경 중이야. 강가에 갈 땐 천천히 걸어.'}[id];
    if(s.friends[id].hearts>=3)return {moru:'너와 함께라면 오래된 온실도 다시 살아날 것 같아. 나무 냄새가 벌써 나는걸.',bomi:'널 보면 우리 마을에 뿌리가 하나 더 내린 기분이야. 내일도 같이 정원을 돌보자.',naru:'저녁엔 광장 쪽에서 만나자. 오늘 강에서 본 반짝이는 물결 이야기를 들려줄게.'}[id];
    if(s.time>=1080)return '어느새 저녁이네. 오늘도 마을을 돌보느라 수고했어. 내일 또 만나!';
    return s.time>=720?{moru:'공방에서 온실에 쓸 자재를 손질하고 있어. 게시판에 필요한 것들을 적어 뒀어.',bomi:'오후엔 마을 정원을 산책해. 농장의 작물도 잘 자라고 있겠지?',naru:'남쪽 강가는 오후에 낚시하기 좋아. 잡은 물고기 두 마리로 함께 저녁을 먹을까?'}[id]:n.line;
  }
  function letters(s){const list=REQUESTS.filter(q=>s.requests[q.id]==='done').map(q=>({id:q.id,title:q.title,body:q.letter}));if(s.community.stage===2)list.push({id:'opening',title:'다시 열린 우리의 온실',body:'모두의 작은 손길이 모여 온실이 열렸어요. 초록 상점의 달빛 호박 씨앗과 자동 급수 텃밭 6칸을 이용해 보세요. 다음 계절도 함께 가꿔요. — 달빛골 이웃들'});return list;}
  const mature=p=>!!p.crop&&p.growth>=CROPS[p.crop].days;
  const count=s=>Object.values(s.bag).reduce((a,b)=>a+b,0);
  function fresh(){return {version:8,treeGrowth:{},extraPlots:[],toolUpgrades:{hoe:0,rod:0,pickaxe:0},storage:{},nodeHits:{},outdoorFurniture:[],map:'farm',day:1,time:480,gold:90,energy:100,player:{x:12,y:11},bag:{seed:5},plots:PLOTS.map(emptyPlot),gathered:[],friends:Object.fromEntries(NPCS.map(n=>[n.id,{hearts:0,talkDay:0,giftDay:0}])),furniture:[],stats:{planted:0,harvested:0,talked:0,crafted:0},festival:false,scene:'outside',selectedSeed:'seed',requests:{},community:{stage:0},greenhousePlots:GREEN_PLOTS.map(emptyPlot),readLetters:[]};}
  function season(s){return SEASONS[Math.floor((s.day-1)/7)%4];}
  function weather(s){return s.day%4===0?'rain':'sun';}
  function waterRainPlots(s){if(weather(s)==='rain')W.farmStates(s).forEach(p=>{if(p.tilled){p.watered=true;p.dryDays=0;}});}
  function roomFor(s,n){return count(s)+n<=CAPACITY;}
  function add(s,item,n){s.bag[item]=(s.bag[item]||0)+n;if(s.bag[item]<=0)delete s.bag[item];}
  function action(s,type,data={}){
    const fail=msg=>({ok:false,msg});
    const ok=msg=>({ok:true,msg});
    const spend=()=>{if(s.energy<2)return false;s.energy-=2;return true;};
    if(type==='upgradeTool'){
      if(s.scene!=='outside'||s.map!==W.WORKSHOP.map||!W.canReach(s,s.player,W.WORKSHOP.door))return fail('마을 공방 입구에서 업그레이드해 주세요.');
      if(!Object.hasOwn(TOOL_UPGRADES,data.tool))return fail('업그레이드할 도구를 골라 주세요.');
      const spec=TOOL_UPGRADES[data.tool],level=s.toolUpgrades[data.tool],next=spec.levels[level+1];
      if(!next)return fail('이미 최고 단계의 도구예요.');
      if(data.expectedLevel!==level)return fail('도구 단계가 바뀌었어요. 공방 목록을 다시 확인해 주세요.');
      if(s.gold<next.gold||Object.entries(next.materials).some(([id,n])=>(s.bag[id]||0)<n))return fail('동전과 배낭 속 재료를 더 모아 주세요. 창고 재료는 먼저 꺼내 주세요.');
      s.gold-=next.gold;for(const [id,n] of Object.entries(next.materials))add(s,id,-n);
      s.toolUpgrades[data.tool]=level+1;return ok(`${next.tier} ${spec.name} 완성! ${next.effect}`);
    }
    if(type==='harvestNode'){
      const n=W.NODES.find(n=>n.id===data.id);
      if(s.scene!=='outside'||!n||n.map!==s.map||!W.canReach(s,s.player,n))return fail('나무나 바위 옆으로 다가가 주세요.');
      if(n.type==='rock'&&(s.nodeHits[n.id]||0)>=n.hits){
        if(W.rockRemoved(s,n))return fail('이미 돌멩이를 주웠어요. 바위는 내일 다시 생겨요.');
        if(!roomFor(s,1))return fail('배낭에 조약돌 1개를 넣을 자리가 필요해요.');
        s.nodeHits[n.id]=n.hits+1;add(s,'stone',1);return ok('돌멩이를 주웠어요! 조약돌 1개 획득 · 기운 소모 없음');
      }
      if(data.tool!==n.tool)return fail(n.type==='tree'?'도끼로 작업해 주세요.':'곡괭이로 작업해 주세요.');
      const hits=s.nodeHits[n.id]||0,power=nodePower(s,n),amount=nodeYield(s,n);
      if(n.type==='tree'){
        if(W.treeRemoved(s,n))return fail('그루터기까지 제거했어요. 묘목을 심으면 새 나무가 자라요.');
        if(Object.hasOwn(s.treeGrowth,n.id))return fail(`묘목이 자라고 있어요. ${W.TREE_DAYS-s.treeGrowth[n.id]}일 뒤에 다 자라요.`);
        if(hits>=n.hits){
          const finished=hits+1>=n.hits+W.STUMP_HITS;
          if(finished&&!roomFor(s,1))return fail('배낭에 나뭇가지 1개를 넣을 자리가 필요해요.');
          if(!spend())return fail('기운이 부족해요. 집에서 쉬어 주세요.');
          s.nodeHits[n.id]=hits+1;
          if(!finished)return ok(`그루터기 제거 ${hits+1-n.hits}/${W.STUMP_HITS} · 도끼로 한 번 더 작업해 주세요.`);
          add(s,'wood',1);return ok('그루터기를 제거했어요! 나뭇가지 1개 획득 · 묘목을 심어 다시 길러 보세요.');
        }
      }
      if(hits+power>=n.hits&&!roomFor(s,amount))return fail(`배낭에 ${amount}칸이 필요해요. 창고에 짐을 맡겨 보세요.`);
      if(!spend())return fail('기운이 부족해요. 집에서 쉬어 주세요.');
      s.nodeHits[n.id]=Math.min(n.hits,hits+power);
      if(hits+power<n.hits)return ok(`${n.type==='tree'?'나무 베기':'돌 캐기'} ${hits+1}/${n.hits} · E를 눌러 계속 작업해요.`);
      add(s,n.item,amount);return ok(`${ITEMS[n.item].name} ${amount}개를 얻었어요! ${n.type==='tree'?'남은 그루터기도 도끼로 제거할 수 있어요.':'남은 돌멩이는 버튼이나 E로 바로 주울 수 있어요.'}`);
    }
    if(type==='plantTree'){
      const error=W.treePlantError(s,data.x,data.y);if(error)return fail(error);
      if(!W.canReach(s,s.player,data))return fail('묘목을 심을 자리 옆으로 다가가 주세요.');
      if(!(s.bag.sapling>0))return fail('묘목이 없어요. 초록 상점에서 살 수 있어요.');
      if(!W.preservesPaths(s,data.x,data.y))return fail('이곳에 나무를 심으면 통로가 막혀요.');
      if(!spend())return fail('기운이 부족해요. 집에서 쉬어 주세요.');
      const n=W.NODES.find(n=>n.map===s.map&&n.type==='tree'&&n.x===data.x&&n.y===data.y);
      add(s,'sapling',-1);delete s.nodeHits[n.id];s.treeGrowth[n.id]=0;
      return ok(`묘목을 심었어요. 물을 주지 않아도 ${W.TREE_DAYS}일 뒤에 나무로 자라요.`);
    }
    if(type==='store'||type==='withdraw'){
      if(s.scene!=='outside'||s.map!=='farm'||!W.canReach(s,s.player,W.STORAGE))return fail('집 앞 창고 옆에서 이용해 주세요.');
      const putting=type==='store',source=putting?s.bag:s.storage,dest=putting?s.storage:s.bag,amount=data.amount??1;
      if(!Object.hasOwn(ITEMS,data.item)||!Number.isInteger(amount)||amount<1||amount>(source[data.item]||0))return fail('물건과 수량을 확인해 주세요.');
      const limit=putting?STORAGE_CAPACITY:CAPACITY;
      if(Object.values(dest).reduce((a,b)=>a+b,0)+amount>limit)return fail(putting?'창고가 가득 찼어요.':'배낭 공간이 부족해요.');
      source[data.item]-=amount;if(!source[data.item])delete source[data.item];dest[data.item]=(dest[data.item]||0)+amount;
      return ok(`${ITEMS[data.item].name} ${amount}개를 ${putting?'보관했어요.':'꺼냈어요.'}`);
    }
    if(type==='acceptRequest'||type==='deliverRequest'){
      const q=REQUESTS.find(q=>q.id===data.id);
      if(!q||q.stage>s.community.stage)return fail('온실의 다음 복구 단계를 먼저 열어 주세요.');
      if(s.requests[q.id]==='done')return fail('이미 고마운 마음을 전한 부탁이에요.');
      if(type==='acceptRequest'){if(s.requests[q.id])return fail('이미 수락한 부탁이에요.');s.requests[q.id]='active';return ok('부탁을 수첩에 적었어요. 기한은 없으니 천천히 준비해요.');}
      if(s.requests[q.id]!=='active')return fail('먼저 부탁을 수락해 주세요.');
      if((s.bag[q.item]||0)<q.amount)return fail('전달할 물건이 아직 부족해요.');
      add(s,q.item,-q.amount);s.gold+=q.gold;s.requests[q.id]='done';s.friends[q.npc].hearts=Math.min(5,s.friends[q.npc].hearts+1);
      return ok(`부탁을 해결했어요! +${q.gold} 동전 · 호감도 +1 · 편지가 도착했어요.`);
    }
    if(type==='restoreGreenhouse'){
      const stage=s.community.stage,p=PROJECTS[stage];if(!p)return fail('온실이 이미 완성됐어요. 안으로 들어가 보세요.');
      if(REQUESTS.some(q=>q.stage===stage&&s.requests[q.id]!=='done'))return fail('이번 단계의 주민 부탁 3개를 먼저 해결해 주세요.');
      if((s.bag.wood||0)<p.wood||(s.bag.stone||0)<p.stone||s.gold<p.gold)return fail('복구에 필요한 자재와 동전을 더 모아 주세요.');
      add(s,'wood',-p.wood);add(s,'stone',-p.stone);s.gold-=p.gold;s.community.stage++;
      return ok(s.community.stage===2?'우리의 온실이 열렸어요! 달빛 호박과 자동 급수 텃밭이 기다려요.':'온실 뼈대가 튼튼해졌어요! 새로운 주민 부탁을 확인해 보세요.');
    }
    if(type==='readLetter'){if(!letters(s).some(l=>l.id===data.id))return fail('편지를 찾을 수 없어요.');if(!s.readLetters.includes(data.id))s.readLetters.push(data.id);return ok('이웃의 마음을 읽었어요.');}
    if(type==='till'){
      if(data.tool!=='hoe')return fail('괭이(2)를 선택해 빈 땅을 갈아 주세요.');
      const error=W.tillError(s,data.x,data.y);if(error)return fail(error);
      const points=W.farmPoints(s),plots=W.farmStates(s),index=points.findIndex(p=>p.x===data.x&&p.y===data.y);
      if(index>=0&&plots[index].tilled)return fail('이미 갈아 둔 땅이에요. 씨앗을 심어 주세요.');
      const profile=toolProfile(s,'hoe');if(s.energy<profile.energy)return fail('기운이 부족해요. 집에서 쉬어 주세요.');
      let count=0;
      for(let dx=-Math.floor(profile.span/2);dx<=Math.floor(profile.span/2);dx++){
        const x=data.x+dx,y=data.y,i=points.findIndex(p=>p.x===x&&p.y===y);
        if(W.tillError(s,x,y)||i>=0&&plots[i].tilled||dx&&W.fenceBetween(s,{x:data.x,y},{x,y}))continue;
        if(i>=0)Object.assign(plots[i],emptyPlot(),{tilled:true});else s.extraPlots.push({...emptyPlot(),x,y,tilled:true});
        count++;
      }
      s.energy-=profile.energy;waterRainPlots(s);return ok(`${count}칸의 흙을 갈았어요. 씨앗(3)을 골라 심어 주세요.`);
    }
    if(type==='plot'){
      const greenhouse=data.zone==='greenhouse';
      if(s.scene!==(greenhouse?'greenhouse':'outside')||!greenhouse&&s.map!=='farm')return fail('농장이나 온실의 텃밭에서 사용해 주세요.');
      if(greenhouse&&s.community.stage!==2)return fail('온실을 복구한 뒤 이용할 수 있어요.');
      const p=(greenhouse?s.greenhousePlots:W.farmStates(s))[data.index];if(!p)return fail('괭이로 밭을 만든 뒤 사용해 주세요.');
      if(mature(p)){
        if(!roomFor(s,1))return fail('배낭이 가득 찼어요. 상점에서 물건을 팔아 보세요.');
        const item=CROPS[p.crop].item;add(s,item,1);Object.assign(p,emptyPlot());s.stats.harvested++;return ok(`${ITEMS[item].name} 수확! 다시 심으려면 괭이로 땅을 갈아 주세요.`);
      }
      if(data.tool==='hoe'){
        if(!greenhouse)return action(s,'till',{...W.farmPoints(s)[data.index],tool:'hoe'});
        if(p.tilled)return fail('이미 잘 갈아 둔 땅이에요. 씨앗을 골라 주세요.');
        const profile=toolProfile(s,'hoe'),points=GREEN_PLOTS,plots=s.greenhousePlots,target=points[data.index],spacing=2;
        if(s.energy<profile.energy)return fail('기운이 부족해요. 집에서 쉬어 주세요.');
        const indices=points.map((point,i)=>({point,i})).filter(({point,i})=>!plots[i].tilled&&!plots[i].crop&&point.y===target.y&&Math.abs(point.x-target.x)<=Math.floor(profile.span/2)*spacing);
        s.energy-=profile.energy;indices.forEach(({i})=>plots[i].tilled=true);
        return ok(`${indices.length}칸의 흙을 갈았어요. 기운 ${profile.energy} 사용 · 이제 씨앗을 심어 봐요.`);
      }
      if(data.tool==='seed'){
        if(!greenhouse&&data.index>=PLOTS.length){const error=W.tillError(s,p.x,p.y);if(error)return fail(error);if(!W.preservesPaths(s,p.x,p.y))return fail('이곳에 심으면 통로가 막혀요. 걸어 다닐 길을 남겨 주세요.');}
        if(!p.tilled)return fail('먼저 괭이로 땅을 갈아 주세요.');if(p.crop)return fail('이곳에는 이미 작물이 자라고 있어요.');const seed=s.selectedSeed;if(seed==='pumpkinSeed'&&!greenhouse)return fail('달빛 호박은 따뜻한 온실 안에서 길러 주세요.');if(!(s.bag[seed]>0))return fail('씨앗이 없어요. 초록 상점에서 살 수 있어요.');if(!spend())return fail('기운이 부족해요. 집에서 쉬어 주세요.');
        add(s,seed,-1);p.crop=seed;p.growth=0;p.emptyDays=0;p.dryDays=0;p.watered=p.watered||greenhouse||weather(s)==='rain';s.stats.planted++;return ok(`${ITEMS[seed].name}을 심었어요. ${greenhouse?'온실이 매일 물을 줘요.':p.watered?'오늘은 비가 물을 줘요.':'물뿌리개로 물을 주세요.'}`);
      }
      if(data.tool==='water'){if(!p.crop)return fail('씨앗을 심은 뒤에 물을 주세요.');if(p.watered)return fail('오늘은 물을 충분히 줬어요.');if(!spend())return fail('기운이 부족해요. 집에서 쉬어 주세요.');p.watered=true;p.dryDays=0;return ok('촉촉하게 물을 줬어요. 밤사이 조금 더 자랄 거예요.');}
      return fail(p.crop?'아직 자라는 중이에요. 물을 주고 다음 날을 기다려요.':'괭이 → 씨앗 → 물뿌리개 순서로 사용해 보세요.');
    }
    if(type==='gather'){
      const r=RESOURCES[data.index];if(s.scene!=='outside'||r?.map!==s.map)return fail('이곳에서 주울 수 없는 물건이에요.');if(!r||s.gathered.includes(data.index))return fail('오늘은 이미 주웠어요. 내일 다시 찾아봐요.');if(!roomFor(s,1))return fail('배낭이 가득 찼어요.');if(!spend())return fail('기운이 부족해요. 집에서 쉬어 주세요.');s.gathered.push(data.index);add(s,r.item,1);return ok(`${ITEMS[r.item].name} 1개를 주웠어요.`);
    }
    if(type==='buy'){
      if(data.item==='pumpkinSeed'&&s.community.stage!==2)return fail('온실을 복구하면 달빛 호박 씨앗이 입고돼요.');
      const item=ITEMS[data.item];if(!item?.buy)return fail('살 수 없는 물건이에요.');if(s.gold<item.buy)return fail('동전이 부족해요. 채집한 물건을 팔아 보세요.');if(!roomFor(s,1))return fail('배낭이 가득 찼어요.');s.gold-=item.buy;add(s,data.item,1);return ok(`${item.name}를 샀어요.`);
    }
    if(type==='sell'){
      const item=ITEMS[data.item],amount=data.amount??1;if(!item?.sell||!Number.isInteger(amount)||amount<1||amount>(s.bag[data.item]||0))return fail('판매 수량과 보유 물건을 확인해 주세요.');s.gold+=item.sell*amount;add(s,data.item,-amount);return ok(`${item.name} ${amount}개 판매 · +${item.sell*amount} 동전`);
    }
    if(type==='craft'){
      if(data.item==='lantern'&&s.requests.moru_wood!=='done')return fail('모루의 첫 부탁을 해결하면 제작법을 배워요.');
      const item=ITEMS[data.item];if(!item?.recipe)return fail('아직 모르는 제작법이에요.');if(Object.entries(item.recipe).some(([id,n])=>(s.bag[id]||0)<n))return fail('재료가 조금 더 필요해요.');if(s.energy<5)return fail('기운이 부족해요. 쉬고 돌아오세요.');for(const [id,n] of Object.entries(item.recipe))add(s,id,-n);s.energy-=5;add(s,data.item,1);s.stats.crafted++;return ok(`${item.name} 완성! 집 안이나 농장에 배치할 수 있어요.`);
    }
    if(type==='talk'||type==='gift'){
      const npc=NPCS.find(n=>n.id===data.id);if(!npc)return fail('이웃을 찾지 못했어요.');const f=s.friends[npc.id];
      if(type==='talk'){if(f.talkDay!==s.day){f.talkDay=s.day;f.hearts=Math.min(5,f.hearts+1);s.stats.talked++;}return ok(dialogue(s,npc.id));}
      if(f.giftDay===s.day)return fail('선물은 하루 한 번이면 충분해요. 마음이 전해졌어요!');if(!(s.bag[npc.gift]>0))return fail(`${npc.name}에게 줄 ${ITEMS[npc.gift].name}가 없어요.`);add(s,npc.gift,-1);f.giftDay=s.day;f.hearts=Math.min(5,f.hearts+1);return ok('나를 생각해서 가져온 거야? 정말 고마워!');
    }
    if(type==='fish'){
      if(!W.fishingSpot(s))return fail('마을 강가나 바닷가의 물가에서 낚시해 주세요.');
      if(!roomFor(s,1))return fail('배낭이 가득 찼어요.');if(!spend())return fail('기운이 부족해요.');add(s,'fish',1);return ok('은빛 물고기를 낚았어요! 나루가 좋아할 것 같아요.');
    }
    if(type==='place'){
      if(!FURNITURE.includes(data.item)||!(s.bag[data.item]>0))return fail('배치할 가구가 없어요.');
      const outside=s.scene==='outside'&&s.map==='farm',list=outside?s.outdoorFurniture:s.furniture;
      if(data.item==='fence'&&!outside)return fail('울타리는 농장에 놓아 주세요.');
      const error=W.placementError(s,data.x,data.y);if(error)return fail(error);
      if(list.length>=96)return fail('이 공간에는 가구를 96개까지 놓을 수 있어요.');
      if(!W.preservesPaths(s,data.x,data.y))return fail('이곳에 놓으면 통로가 막혀요. 다른 자리를 골라 주세요.');
      list.push({item:data.item,x:data.x,y:data.y});add(s,data.item,-1);return ok(outside?'농장에 가구를 놓았어요. 손 도구로 회수할 수 있어요.':'우리 집이 조금 더 아늑해졌어요.');
    }
    if(type==='remove'){
      if(s.scene!=='inside'&&!(s.scene==='outside'&&s.map==='farm'))return fail('집이나 농장의 가구를 골라 주세요.');
      const list=s.scene==='inside'?s.furniture:s.outdoorFurniture,i=list.findIndex(f=>f.x===data.x&&f.y===data.y);
      if(i<0||!W.canReach(s,s.player,list[i]))return fail('가구 옆으로 다가가 주세요.');
      if(!roomFor(s,1))return fail('배낭이 가득 찼어요.');add(s,list[i].item,1);list.splice(i,1);return ok('가구를 배낭에 넣었어요.');
    }
    if(type==='festival'){
      if(s.festival)return fail('달빛 축제를 열었어요. 마을과 함께 다음 계절을 즐겨요!');if(s.stats.harvested<5||s.stats.crafted<1||NPCS.some(n=>s.friends[n.id].hearts<3))return fail('수확 5회, 가구 제작 1회, 모든 이웃 호감도 3칸을 모아 주세요.');s.festival=true;s.gold+=200;return ok('달빛 축제가 시작됐어요! 마을의 선물로 200 동전을 받았어요.');
    }
    return fail('이곳에서는 사용할 수 없어요.');
  }
  function nextDay(s){
    waterRainPlots(s);
    let restored=0,lostCrops=0;
    W.farmStates(s).forEach(p=>{
      if(!p.tilled){p.emptyDays=0;p.dryDays=0;return;}
      p.emptyDays=p.crop?0:p.emptyDays+1;
      p.dryDays=p.watered?0:p.dryDays+1;
      if(p.emptyDays>=SOIL_RESET_DAYS||p.dryDays>=SOIL_RESET_DAYS){
        if(p.crop)lostCrops++;
        restored++;Object.assign(p,emptyPlot());return;
      }
      if(p.crop&&p.watered&&!mature(p))p.growth++;
      p.watered=false;
    });s.greenhousePlots.forEach(p=>{if(p.crop){if(!mature(p))p.growth++;p.watered=true;}});s.day++;s.time=480;s.energy=100;s.gathered=[];s.nodeHits=Object.fromEntries(Object.entries(s.nodeHits).filter(([id])=>W.NODES.some(n=>n.id===id&&n.type==='tree')));for(const id of Object.keys(s.treeGrowth)){s.treeGrowth[id]++;if(s.treeGrowth[id]>=W.TREE_DAYS)delete s.treeGrowth[id];}s.scene='outside';s.map='farm';s.player={x:7,y:9};waterRainPlots(s);return `${season(s)} ${((s.day-1)%7)+1}일, 새로운 아침이에요. ${weather(s)==='rain'?'비가 텃밭에 물을 주네요.':'오늘도 나만의 속도로 보내요.'}${restored?` 방치한 밭 ${restored}칸이 원래 땅으로 돌아갔어요.${lostCrops?` 물을 못 받은 작물 ${lostCrops}개도 사라졌어요.`:''}`:''}`;}
  function validate(value){
    if(!value||![1,2,3,4,5,6,7,8].includes(value.version))throw Error('지원하지 않는 저장 버전이에요.');
    value=JSON.parse(JSON.stringify(value));
    if(value.version===1){value.version=2;value.requests={};value.community={stage:0};value.greenhousePlots=GREEN_PLOTS.map(emptyPlot);value.readLetters=[];}
    if(value.version===2){value.version=3;value.map='farm';if(value.scene==='outside')value.player={x:12,y:11};}
    if(value.version===3){value.version=4;value.storage={};value.nodeHits={};value.outdoorFurniture=[];}
    if(value.version===4){value.version=5;value.toolUpgrades={hoe:0,rod:0,pickaxe:0};}
    if(value.version===5){value.version=6;value.extraPlots=[];}
    if(value.version===6){value.version=7;value.treeGrowth={};}
    if(value.version===7){value.version=8;for(const plots of [value.plots,value.extraPlots,value.greenhousePlots])if(Array.isArray(plots))for(const p of plots)if(p&&typeof p==='object'){p.emptyDays=0;p.dryDays=0;}}
    if(value.scene==='greenhouse'&&value.map==='village')value.map=W.GREENHOUSE.map;
    if(!Object.hasOwn(W.MAPS,value.map)||value.scene==='inside'&&value.map!=='farm'||value.scene==='greenhouse'&&value.map!==W.GREENHOUSE.map)throw Error('맵 데이터가 올바르지 않아요.');
    const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
    // Retire the removed eastern farm rock without invalidating existing saves.
    if(value.nodeHits&&integer(value.nodeHits['farm:rock:26:16'],1,2))delete value.nodeHits['farm:rock:26:16'];
    if(!integer(value.day,1,100000)||!Number.isFinite(value.time)||value.time<480||value.time>1320||!integer(value.gold,0,1e9)||!integer(value.energy,0,100))throw Error('날짜나 재화 데이터가 올바르지 않아요.');
    if(!value.bag||typeof value.bag!=='object'||Array.isArray(value.bag)||Object.entries(value.bag).some(([id,n])=>!Object.hasOwn(ITEMS,id)||!integer(n,1,CAPACITY))||count(value)>CAPACITY)throw Error('배낭 데이터가 올바르지 않아요.');
    if(!value.toolUpgrades||typeof value.toolUpgrades!=='object'||Array.isArray(value.toolUpgrades)||Object.keys(value.toolUpgrades).length!==3||Object.keys(TOOL_UPGRADES).some(id=>!integer(value.toolUpgrades[id],0,2)))throw Error('도구 업그레이드 데이터가 올바르지 않아요.');
    if(!value.storage||typeof value.storage!=='object'||Array.isArray(value.storage)||Object.entries(value.storage).some(([id,n])=>!Object.hasOwn(ITEMS,id)||!integer(n,1,STORAGE_CAPACITY))||Object.values(value.storage).reduce((a,b)=>a+b,0)>STORAGE_CAPACITY)throw Error('창고 데이터가 올바르지 않아요.');
    if(!value.nodeHits||typeof value.nodeHits!=='object'||Array.isArray(value.nodeHits)||Object.entries(value.nodeHits).some(([id,n])=>{const node=W.NODES.find(p=>p.id===id);return !node||!integer(n,1,node.hits+(node.type==='tree'?W.STUMP_HITS:1));}))throw Error('벌목·채광 데이터가 올바르지 않아요.');
    if(!value.treeGrowth||typeof value.treeGrowth!=='object'||Array.isArray(value.treeGrowth)||Object.entries(value.treeGrowth).some(([id,age])=>!W.NODES.some(n=>n.id===id&&n.type==='tree')||!integer(age,0,W.TREE_DAYS-1)||(value.nodeHits[id]||0)>0))throw Error('묘목 성장 데이터가 올바르지 않아요.');
    if(!Array.isArray(value.outdoorFurniture)||value.outdoorFurniture.length>96||value.outdoorFurniture.some(f=>!f||!FURNITURE.includes(f.item)||!integer(f.x,1,30)||!integer(f.y,2,20)||W.blocked('farm',f.x,f.y,value))||new Set(value.outdoorFurniture.map(f=>`${f.x},${f.y}`)).size!==value.outdoorFurniture.length)throw Error('야외 가구 데이터가 올바르지 않아요.');
    const validPlots=(ps,length,seeds)=>Array.isArray(ps)&&ps.length===length&&ps.every(p=>p&&typeof p.tilled==='boolean'&&typeof p.watered==='boolean'&&integer(p.emptyDays,0,SOIL_RESET_DAYS-1)&&integer(p.dryDays,0,SOIL_RESET_DAYS-1)&&[null,...seeds].includes(p.crop)&&integer(p.growth,0,100000)&&(!p.crop||p.tilled));
    if(!validPlots(value.plots,PLOTS.length,['seed','berrySeed'])||!validPlots(value.greenhousePlots,GREEN_PLOTS.length,Object.keys(CROPS)))throw Error('텃밭 데이터가 올바르지 않아요.');
    if(!Array.isArray(value.extraPlots)||value.extraPlots.length>32*22||!validPlots(value.extraPlots,value.extraPlots.length,['seed','berrySeed'])||value.extraPlots.some(p=>(!W.farmSoil(p.x,p.y,value)&&(p.tilled||p.crop||!W.NODES.some(n=>n.map==='farm'&&n.type==='tree'&&n.x===p.x&&n.y===p.y)))||PLOTS.some(o=>o.x===p.x&&o.y===p.y)||p.crop&&value.outdoorFurniture.some(f=>f.x===p.x&&f.y===p.y))||new Set(value.extraPlots.map(p=>`${p.x},${p.y}`)).size!==value.extraPlots.length)throw Error('새로 만든 밭 데이터가 올바르지 않아요.');
    if(!Array.isArray(value.gathered)||new Set(value.gathered).size!==value.gathered.length||value.gathered.some(i=>!integer(i,0,RESOURCES.length-1)))throw Error('채집 데이터가 올바르지 않아요.');
    if(!value.player||!integer(value.player.x,0,31)||!integer(value.player.y,0,21)||!['outside','inside','greenhouse'].includes(value.scene))throw Error('위치 데이터가 올바르지 않아요.');
    if(!value.friends||NPCS.some(n=>{const f=value.friends[n.id];return !f||!integer(f.hearts,0,5)||!integer(f.talkDay,0,value.day)||!integer(f.giftDay,0,value.day);}))throw Error('이웃 데이터가 올바르지 않아요.');
    if(!value.stats||['planted','harvested','talked','crafted'].some(k=>!integer(value.stats[k],0,1e9))||typeof value.festival!=='boolean'||!Object.hasOwn(CROPS,value.selectedSeed))throw Error('진행 데이터가 올바르지 않아요.');
    if(!Array.isArray(value.furniture)||value.furniture.length>96||value.furniture.some(f=>!f||!['bench','pot','lantern'].includes(f.item)||!integer(f.x,10,21)||!integer(f.y,9,16)||(f.x===16&&f.y===16))||new Set(value.furniture.map(f=>`${f.x},${f.y}`)).size!==value.furniture.length)throw Error('가구 데이터가 올바르지 않아요.');
    if(!value.requests||Array.isArray(value.requests)||typeof value.requests!=='object'||Object.entries(value.requests).some(([id,status])=>!REQUESTS.some(q=>q.id===id)||!['active','done'].includes(status)))throw Error('주민 부탁 데이터가 올바르지 않아요.');
    if(!value.community||!integer(value.community.stage,0,2)||REQUESTS.some(q=>q.stage<value.community.stage&&value.requests[q.id]!=='done')||value.scene==='greenhouse'&&value.community.stage!==2)throw Error('온실 복구 데이터가 올바르지 않아요.');
    if(!Array.isArray(value.readLetters)||new Set(value.readLetters).size!==value.readLetters.length||value.readLetters.some(id=>!letters(value).some(l=>l.id===id)))throw Error('편지 데이터가 올바르지 않아요.');
    waterRainPlots(value);
    return JSON.parse(JSON.stringify(value));
  }
  const api={SOIL_RESET_DAYS,ITEMS,NPCS,PLOTS,GREEN_PLOTS,RESOURCES,TREES,SEASONS,CAPACITY,STORAGE_CAPACITY,TOOL_UPGRADES,toolProfile,nodePower,nodeYield,FURNITURE,CROPS,REQUESTS,PROJECTS,fresh,season,weather,count,action,nextDay,validate,npcs,dialogue,letters,mature};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.Dalbit=api;
})(typeof globalThis!=='undefined'?globalThis:this);
