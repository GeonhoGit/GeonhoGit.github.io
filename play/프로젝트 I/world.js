(function(root){
  'use strict';
  const MAPS={
    farm:{name:'나의 농장',description:'나의 집 · 텃밭 · 공동 온실 · 오른쪽 바닷가 · 아래쪽 마을',spawn:{x:12,y:11},
      trees:[[2,3],[3,5],[1,9],[11,3],[13,2],[18,3],[22,2],[25,4],[30,3],[30,7],[2,15],[3,18],[8,20],[19,20],[23,15],[28,18]],
      exits:[{id:'farm-beach',x:30,y:11,to:'beach',arrival:{x:2,y:11},direction:'right',name:'바닷가로 →'},{id:'farm-village',x:15,y:20,to:'village',arrival:{x:11,y:3},direction:'down',name:'마을로 ↓'}]},
    village:{name:'달빛골 마을',description:'광장 · 초록 상점 · 공방 · 이웃들의 집',spawn:{x:11,y:3},
      trees:[[2,3],[3,5],[1,9],[13,2],[22,2],[24,4],[30,3],[30,7],[2,15],[3,18],[15,18],[18,16],[23,15],[30,15]],
      exits:[{id:'village-farm',x:11,y:2,to:'farm',arrival:{x:15,y:19},direction:'up',name:'농장으로 ↑'}]},
    beach:{name:'조개빛 바닷가',description:'조개가 놓인 모래사장 · 바다낚시 부두',spawn:{x:2,y:11},
      trees:[[2,3],[12,2],[17,3]],
      exits:[{id:'beach-farm',x:1,y:11,to:'farm',arrival:{x:29,y:11},direction:'left',name:'농장으로 ←'}]}
  };
  for(const map of Object.values(MAPS))map.trees=map.trees.map(([x,y])=>({x,y}));
  const GREENHOUSE={map:'farm',x:20,y:5,width:4,height:4,door:{x:22,y:9}};
  const STORAGE={x:10,y:9};
  const WORKSHOP={map:'village',x:14,y:12,width:4,height:2,door:{x:16,y:14}};
  const NODES=Object.entries(MAPS).flatMap(([map,data])=>data.trees.map((p,i)=>({...p,map,id:`${map}:tree:${i}`,type:'tree',tool:'axe',hits:3,item:'wood',amount:3})));
  for(const [map,x,y] of [['farm',17,5],['village',20,18],['beach',15,16]])NODES.push({map,x,y,id:`${map}:rock:${x}:${y}`,type:'rock',tool:'pickaxe',hits:2,item:'stone',amount:3});
  const TREE_DAYS=3,STUMP_HITS=2;
  function rockRemoved(s,n){return n.type==='rock'&&(s.nodeHits[n.id]||0)>n.hits;}
  function treeRemoved(s,n){return n.type==='tree'&&(s.nodeHits[n.id]||0)>=n.hits+STUMP_HITS;}
  function treePlantError(s,x,y){
    if(s.scene!=='outside')return '묘목은 야외에서 심어 주세요.';
    const n=NODES.find(n=>n.map===s.map&&n.type==='tree'&&n.x===x&&n.y===y);
    if(!n||!treeRemoved(s,n))return '나무와 그루터기를 모두 제거한 자리에 묘목을 심어 주세요.';
    if(occupied(s,x,y)||s.player.x===x&&s.player.y===y)return '나무를 심을 자리를 비워 주세요.';
    if(s.map==='farm'&&farmPoints(s).some((p,i)=>p.x===x&&p.y===y&&farmStates(s)[i].tilled))return '경작한 밭에는 묘목을 심을 수 없어요. 수확 후에 심어 주세요.';
    return null;
  }
  const FARM_PLOTS=Array.from({length:15},(_,i)=>({x:6+i%5,y:12+Math.floor(i/5)*2}));
  const FARM_PATHS=[[7,9,1,3],[7,10,25,2],[15,10,2,12],[22,9,1,2]];
  function farmPoints(s){return [...FARM_PLOTS,...(s.extraPlots||[]).map(({x,y})=>({x,y}))];}
  function farmStates(s){return [...s.plots,...(s.extraPlots||[])];}
  function farmSoil(x,y,s){
    if(!Number.isInteger(x)||!Number.isInteger(y)||blocked('farm',x,y,s))return false;
    if(NODES.some(n=>n.map==='farm'&&n.type==='rock'&&n.x===x&&n.y===y))return false;
    if(FARM_PLOTS.some(p=>p.x===x&&p.y===y))return true;
    if(FARM_PATHS.some(([a,b,w,h])=>x>=a&&x<a+w&&y>=b&&y<b+h))return false;
    if(x>=6&&x<=11&&y===9||x>=21&&x<=23&&y===9)return false;
    if(MAPS.farm.exits.some(p=>Math.abs(p.x-x)+Math.abs(p.y-y)<=1))return false;
    return !RESOURCES.some(p=>p.map==='farm'&&p.x===x&&p.y===y);
  }
  function tillError(s,x,y){
    if(s.scene!=='outside'||s.map!=='farm')return '새 밭은 나의 농장에서 만들 수 있어요.';
    if(!farmSoil(x,y,s))return '길·출입구·건물·식물·채집물 자리를 피해 빈 땅을 골라 주세요.';
    if(occupied(s,x,y))return '작물이나 가구가 없는 빈 땅을 골라 주세요.';
    return null;
  }
  const GREEN_PLOTS=Array.from({length:6},(_,i)=>({x:12+(i%3)*2,y:11+Math.floor(i/3)*2}));
  // Fence segments lie on tile borders; the gaps are real entrances.
  const FENCES={
    farm:[],
    village:[[6,12,11,12],[6,15,11,15],[6,12,6,15],[11,12,11,13],[11,14,11,15],[25,10,29,10],[25,12,29,12]],
    beach:[[23,10,29,10],[23,12,29,12]],
    inside:[],greenhouse:[]
  };
  const PLANTS={
    farm:[],
    village:Array.from({length:12},(_,i)=>({x:6+i%4,y:12+Math.floor(i/4)})),beach:[]
  };
  // IDs are the original array indices, so already gathered items survive migration.
  const RESOURCES=[
    {map:'farm',x:3,y:11,item:'wood'},{map:'farm',x:4,y:16,item:'wood'},
    {map:'farm',x:16,y:17,item:'wood'},{map:'farm',x:21,y:16,item:'stone'},
    {map:'village',x:18,y:18,item:'stone'},{map:'farm',x:10,y:18,item:'flower'},
    {map:'village',x:19,y:11,item:'flower'},{map:'village',x:23,y:7,item:'flower'},
    {map:'beach',x:8,y:15,item:'shell'},{map:'beach',x:18,y:18,item:'shell'},
    {map:'farm',x:3,y:7,item:'wood'},{map:'farm',x:20,y:17,item:'wood'}
  ];
  function blocked(map,x,y,s){
    if(x<1||x>30||y<2||y>20)return true;
    if(NODES.some(n=>n.map===map&&n.type==='tree'&&n.x===x&&n.y===y&&(!s||!treeRemoved(s,n))))return true;
    if(NODES.some(p=>p.map===map&&p.type==='rock'&&p.x===x&&p.y===y&&(!s||!rockRemoved(s,p))))return true;
    if(map==='farm'&&x===STORAGE.x&&y===STORAGE.y)return true;
    if(PLANTS[map].some(p=>p.x===x&&p.y===y))return true;
    if((map==='farm'||map==='village')&&x===5&&y===9)return true;
    if(map==='farm')return x>=4&&x<=10&&y>=3&&y<=8||x>=GREENHOUSE.x&&x<GREENHOUSE.x+GREENHOUSE.width&&y>=GREENHOUSE.y&&y<GREENHOUSE.y+GREENHOUSE.height;
    if(map==='beach')return x>=23&&!(x<=28&&(y===10||y===11))||x>=5&&x<=8&&y>=2&&y<=6;
    return x>=26&&x<=28&&y!==10&&y!==11||x>=4&&x<=10&&y>=3&&y<=8||x>=16&&x<=22&&y>=2&&y<=7||x>=WORKSHOP.x&&x<WORKSHOP.x+WORKSHOP.width&&y>=WORKSHOP.y&&y<WORKSHOP.y+WORKSHOP.height||x===14&&y===8;
  }
  function occupied(s,x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y))return true;
    if(s.scene==='inside')return x<9||x>22||y<9||y>17||x>=19&&x<=21&&y<=11||s.furniture.some(p=>p.x===x&&p.y===y);
    if(s.scene==='greenhouse')return x<9||x>22||y<9||y>17||x===18&&y>=10&&y<=15||x===19&&[10,12,14].includes(y)||GREEN_PLOTS.some((p,i)=>p.x===x&&p.y===y&&s.greenhousePlots[i].crop);
    return blocked(s.map,x,y,s)||(s.outdoorFurniture||[]).some(p=>s.map==='farm'&&p.x===x&&p.y===y)||RESOURCES.some((p,i)=>p.map===s.map&&p.x===x&&p.y===y&&!s.gathered.includes(i))||s.map==='farm'&&(FARM_PLOTS.some((p,i)=>p.x===x&&p.y===y&&s.plots[i].crop)||(s.extraPlots||[]).some(p=>p.x===x&&p.y===y&&p.crop));
  }
  function fenceBetween(s,from,to){
    const key=s.scene==='outside'?s.map:s.scene;
    const ax=from.x+.5,ay=from.y+.5,bx=to.x+.5,by=to.y+.5;
    return FENCES[key].some(([x1,y1,x2,y2])=>{
      if(x1===x2){
        if(ax===bx)return false;const t=(x1-ax)/(bx-ax),y=ay+t*(by-ay);
        return t>=0&&t<=1&&y>=Math.min(y1,y2)&&y<=Math.max(y1,y2);
      }
      if(ay===by)return false;const t=(y1-ay)/(by-ay),x=ax+t*(bx-ax);
      return t>=0&&t<=1&&x>=Math.min(x1,x2)&&x<=Math.max(x1,x2);
    });
  }
  function canStep(s,from,to){return Math.abs(from.x-to.x)+Math.abs(from.y-to.y)===1&&!occupied(s,to.x,to.y)&&!fenceBetween(s,from,to);}
  function canReach(s,from,to){
    const distance=Math.hypot(from.x-to.x,from.y-to.y);
    if(distance>1.45||fenceBetween(s,from,to))return false;
    if(from.x!==to.x&&from.y!==to.y)return !occupied(s,to.x,from.y)&&!occupied(s,from.x,to.y);
    return true;
  }
  function safePosition(s,preferred=s.player,extraBlocked=()=>false){
    const candidates=[];
    for(let y=s.scene==='outside'?2:9;y<=(s.scene==='outside'?20:17);y++)for(let x=s.scene==='outside'?1:9;x<=(s.scene==='outside'?30:22);x++){
      if(!occupied(s,x,y)&&!extraBlocked(x,y))candidates.push({x,y});
    }
    candidates.sort((a,b)=>Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y)-Math.abs(b.x-preferred.x)-Math.abs(b.y-preferred.y));
    return candidates[0]||null;
  }
  function fishingTarget(s){
    if(s.scene!=='outside')return null;
    const {x,y}=s.player;
    // Cast beyond the bridge/pier rail, rather than onto its deck (rows 10–11).
    const waterY=y===10?9*32:y===11?13*32:y*32+16;
    if(s.map==='village'&&x>=26&&x<=28&&(y===10||y===11))return {x:x*32+16,y:waterY};
    if(s.map==='village'&&[25,29].includes(x)&&y>=2&&y<=19)return {x:872,y:waterY};
    if(s.map==='beach'){
      if(x===28&&(y===10||y===11))return {x:954,y:y*32+16};
      if(x===22&&y>=5&&y<=20)return {x:758,y:waterY};
    }
    return null;
  }
  function fishingSpot(s){return fishingTarget(s)!==null;}
  function placementError(s,x,y){
    const outside=s.scene==='outside'&&s.map==='farm';
    if(!outside&&s.scene!=='inside')return '가구는 집 안이나 나의 농장에 놓아 주세요.';
    if(!Number.isInteger(x)||!Number.isInteger(y)||occupied(s,x,y))return '건물·식물·가구가 없는 빈칸을 골라 주세요.';
    if(s.player.x===x&&s.player.y===y)return '서 있는 자리를 비운 뒤 놓아 주세요.';
    if(!outside&&(x<10||x>21||y<9||y>16||x===16&&y>=15))return '집 출입구를 비우고 밝은 바닥에 놓아 주세요.';
    if(outside){
      if(NODES.some(n=>n.map==='farm'&&n.type==='rock'&&n.x===x&&n.y===y))return '내일 바위가 다시 생기는 자리예요.';
      if(y===10||y===11||x>=14&&x<=16&&y>=10||x>=6&&x<=11&&y===9||x>=21&&x<=23&&y===9)return '집 앞길·마을과 바닷가로 가는 길은 비워 두어요.';
      if(RESOURCES.some(p=>p.map==='farm'&&p.x===x&&p.y===y))return '내일 채집물이 다시 생기는 자리예요.';
      if(FENCES.farm.some(([a,b,c,d])=>a===c?(x===a||x===a-1)&&y>=b&&y<d:(y===b||y===b-1)&&x>=a&&x<c))return '울타리 바로 옆은 통로로 남겨 주세요.';
    }
    return null;
  }
  function preservesPaths(s,x,y){
    const flood=extra=>{
      const queue=[s.player],seen=new Set([`${s.player.x},${s.player.y}`]);
      for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const from=queue[i],to={x:from.x+dx,y:from.y+dy},key=`${to.x},${to.y}`;
        if(seen.has(key)||extra&&to.x===x&&to.y===y||!canStep(s,from,to))continue;
        seen.add(key);queue.push(to);
      }
      return seen;
    };
    const before=flood(false),after=flood(true),placed=`${x},${y}`;
    return before.has(placed)&&[...before].every(key=>key===placed||after.has(key));
  }
  function travel(s,id){
    const exit=MAPS[s.map]?.exits.find(e=>e.id===id);
    if(s.scene!=='outside'||!exit||Math.hypot(s.player.x-exit.x,s.player.y-exit.y)>1.45)return false;
    s.map=exit.to;s.player={...exit.arrival};return true;
  }
  const api={MAPS,GREENHOUSE,STORAGE,WORKSHOP,NODES,TREE_DAYS,STUMP_HITS,rockRemoved,treeRemoved,treePlantError,FARM_PLOTS,FARM_PATHS,farmPoints,farmStates,farmSoil,tillError,GREEN_PLOTS,FENCES,PLANTS,RESOURCES,blocked,occupied,fenceBetween,canStep,canReach,safePosition,placementError,preservesPaths,fishingTarget,fishingSpot,travel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.DalbitWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this);
