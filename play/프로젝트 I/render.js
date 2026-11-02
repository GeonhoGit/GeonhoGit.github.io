(function(){
  'use strict';
  const G=Dalbit,T=32;
  let c,t=0;
  const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
  const tiles=(x,y,w,h,color)=>rect(x*T,y*T,w*T,h*T,color);
  // Ground boundaries use the same 32px grid as movement and selection.
  function paths(areas,color){
    const cells=new Set();
    for(const [x,y,w,h] of areas){tiles(x,y,w,h,color);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)cells.add(`${xx},${yy}`);}
    for(const cell of cells){const [x,y]=cell.split(',').map(Number);for(let i=0;i<2;i++)rect(x*T+5+noise(x+i,y)*20,y*T+5+noise(y+i,x)*20,3,2,'#c5b586');}
  }
  const oval=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  function poly(points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function label(text,x,y){c.font='11px "Malgun Gothic", sans-serif';c.textAlign='center';const w=c.measureText(text).width;rect(x-w/2-9,y-12,w+18,21,'#fffae6ef');c.fillStyle='#536143';c.fillText(text,x,y+2);}
  const noise=(x,y)=>{const a=Math.sin(x*127.1+y*311.7)*43758.5453;return a-Math.floor(a);};
  function tree(x,y,season){x=x*T+16;y=y*T+16;const colors=season==='가을'?['#9f7746','#b48d4d','#c4a254','#d8b064']:season==='겨울'?['#9caf97','#b8c8ad','#cfd9bf','#e8ead5']:['#4e7653','#618654','#749653','#8fae65'];oval(x+5,y+12,32,11,'#3a653330');rect(x-7,y-34,14,44,'#927656');rect(x-3,y-30,5,41,'#b19465');rect(x+5,y-21,11,6,'#8d7453');
    [[-22,-48,27,25],[-35,-65,33,25],[-11,-84,38,33],[14,-69,27,34],[-30,-43,56,21]].forEach(([a,b,w,h],i)=>{rect(x+a,y+b,w,h,colors[i%3]);});
    rect(x-26,y-65,15,10,colors[3]);rect(x-5,y-79,19,9,colors[3]);rect(x+16,y-59,17,10,colors[2]);rect(x-20,y-37,24,8,colors[1]);rect(x+8,y-29,14,4,colors[0]);if(season==='봄'){rect(x-17,y-55,4,4,'#e4d3a0');rect(x+18,y-46,4,4,'#e4d3a0');}}
  function fences(map){
    for(const [x1,y1,x2,y2] of DalbitWorld.FENCES[map]){
      const x=x1*T,y=y1*T,w=(x2-x1)*T,h=(y2-y1)*T;
      if(w){rect(x,y-18,w,5,'#c0aa7b');rect(x,y-7,w,4,'#ac9568');}
      else{rect(x-2,y-17,5,h,'#b39c70');rect(x-2,y-5,5,h,'#9f8c63');}
      const count=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
      for(let i=0;i<=count;i++){const px=x+w*i/count,py=y+h*i/count;rect(px-2,py-24,5,27,'#9f8c63');rect(px-1,py-24,3,4,'#d2bd85');}
    }
  }
  function house(x,y,shop=false){
    oval(x+84,y+120,102,24,'#38593722');rect(x-4,y+31,166,111,'#b0a786');rect(x+4,y+36,151,99,shop?'#e9dfb4':'#ede3c3');rect(x+4,y+121,151,14,'#bcb38b');
    for(let yy=50;yy<120;yy+=17)rect(x+7,y+yy-25,145,1,'#d4c7a1');
    rect(x+119,y-42,17,42,'#bd9b78');rect(x+115,y-45,25,8,'#d0b18a');
    if(!shop){oval(x+126+Math.sin(t*.7)*5,y-56-(t*6)%22,7,6,'#fff8e34a');oval(x+123,y-75-(t*6)%18,10,7,'#fff8e325');}
    poly([[x-19,y+40],[x+80,y-41],[x+177,y+40]],shop?'#567b64':'#ad7256');poly([[x-11,y+34],[x+80,y-34],[x+168,y+34]],shop?'#71927a':'#cb9167');
    for(let i=0;i<6;i++){const yy=y-24+i*11;const half=(yy-(y-36))*1.21;rect(x+80-half,yy,half*2,3,shop?'#5b806a':'#b9805b');}
    rect(x-20,y+38,197,7,shop?'#476d58':'#996b53');rect(x+65,y+78,33,57,'#967a54');rect(x+71,y+84,22,47,'#b29765');rect(x+89,y+110,3,4,'#f5d685');rect(x+61,y+135,41,8,'#b5ab83');
    [19,115].forEach(xx=>{rect(x+xx,y+67,27,30,'#9f986f');rect(x+xx+3,y+70,21,23,'#99c1b1');rect(x+xx+13,y+70,2,23,'#e6d7af');rect(x+xx+3,y+82,21,2,'#e6d7af');rect(x+xx-3,y+98,33,6,'#ab8d64');});
    if(shop){rect(x-7,y+49,173,18,'#f1e1af');for(let i=0;i<9;i++)rect(x-7+i*20,y+49,10,18,'#78937a');label('초록 상점',x+80,y+21);}else{rect(x+120,y+99,17,10,'#b58860');for(let i=0;i<4;i++){rect(x+120+i*5,y+93,3,8,'#738c4d');rect(x+120+i*5,y+90,4,4,'#e5b8ab');}}
  }
  function character(x,y,kind,bob=0,stride=0,facing='front'){x=x*T+16;y=y*T+23+bob;oval(x,y+6,12,5,'#355b3936');
    if(kind==='player'){
      c.save();
      if(facing==='left'){c.translate(x*2,0);c.scale(-1,1);}
      rect(x-8,y-6,6,13,'#695e4e');rect(x+3,y-6,6,13,'#695e4e');rect(x-10,y-22,21,20,'#e9d8a9');rect(x-6,y-20,13,19,'#78937e');rect(x-13,y-18,4,12,'#e7bd8d');rect(x+11,y-18,4,12,'#e7bd8d');rect(x-10,y-39,21,21,'#e6be90');rect(x-12,y-41,25,9,'#665e47');rect(x-12,y-37,5,15,'#665e47');rect(x+8,y-36,5,10,'#665e47');rect(x-19,y-40,38,5,'#b79759');rect(x-13,y-51,26,11,'#d5b56e');rect(x-13,y-43,26,4,'#8c8d61');rect(x-3,y-29,2,3,'#514e3c');rect(x+7,y-29,2,3,'#514e3c');rect(x+2,y-23,4,2,'#ae7c65');
      c.restore();
    }else{
      const npc=G.NPCS.find(n=>n.id===kind),col=npc.color;
      rect(x-8,y-5+stride,6,10,col);rect(x+3,y-5-stride,6,10,col);rect(x-12,y-23,25,22,kind==='moru'?'#678484':kind==='bomi'?'#ce9b88':'#84916c');rect(x-15,y-40,31,23,col);rect(x-11,y-44,23,8,col);
      if(kind==='bomi'){rect(x-11,y-60,8,20,col);rect(x+5,y-59,8,19,col);rect(x-8,y-56,3,14,'#d7b0a0');rect(x+7,y-55,3,13,'#d7b0a0');}else if(kind==='naru'){poly([[x-15,y-38],[x-16,y-55],[x-2,y-43]],col);poly([[x+2,y-43],[x+16,y-55],[x+16,y-37]],col);rect(x-10,y-28,21,9,'#ede0bd');}else{rect(x-16,y-47,10,11,col);rect(x+7,y-47,10,11,col);rect(x-6,y-27,13,9,'#d0ad7e');}
      rect(x-7,y-34,3,4,'#3f483c');rect(x+6,y-34,3,4,'#3f483c');rect(x,y-27,3,3,'#4d5040');rect(x-14,y-27,5,3,'#d9a48b');rect(x+11,y-27,5,3,'#d9a48b');
    }
  }
  function resource(r){const x=r.x*T+16,y=r.y*T+17;oval(x,y+7,11,4,'#47683e20');if(r.item==='wood'){rect(x-9,y-3,20,6,'#967e54');rect(x+1,y-10,5,13,'#967e54');rect(x-8,y-3,18,2,'#c3a16a');}if(r.item==='stone'){poly([[x-10,y+4],[x-7,y-6],[x+1,y-10],[x+10,y-3],[x+11,y+5]],'#9caa95');rect(x-4,y-6,7,3,'#c6cdb8');}if(r.item==='flower'){rect(x,y-1,2,11,'#739551');rect(x-5,y+3,6,3,'#7e9c54');for(let i=0;i<5;i++)rect(x+Math.cos(i*1.25)*5-2,y-5+Math.sin(i*1.25)*5-2,5,5,'#f6ead1');rect(x-1,y-7,4,4,'#d5b55a');}if(r.item==='shell'){poly([[x-10,y+3],[x-8,y-5],[x,y-9],[x+9,y-4],[x+11,y+3],[x+2,y+7]],'#edcdb0');rect(x-4,y-5,2,8,'#ceaf97');rect(x+2,y-6,2,9,'#ceaf97');}}
  function furniture(f){const x=f.x*T+16,y=f.y*T+16;if(f.item==='fence'){rect(x-15,y-16,5,31,'#92714d');rect(x+11,y-16,5,31,'#92714d');rect(x-15,y-9,31,5,'#c0aa7b');rect(x-15,y+3,31,5,'#b19666');rect(x-14,y-18,3,4,'#d7c290');rect(x+12,y-18,3,4,'#d7c290');}else if(f.item==='lantern'){oval(x,y-8,21,25,'#f7dc8833');rect(x-8,y-22,17,22,'#bc9366');rect(x-5,y-19,11,16,'#f5db91');rect(x-2,y-27,5,5,'#8e7852');rect(x-9,y,19,4,'#8e7852');}else if(f.item==='bench'){rect(x-14,y-8,28,5,'#92714d');rect(x-14,y-1,28,8,'#b18d5f');rect(x-11,y+7,4,8,'#816749');rect(x+8,y+7,4,8,'#816749');rect(x-13,y-14,3,13,'#9c7c50');rect(x+11,y-14,3,13,'#9c7c50');}else{rect(x-7,y,15,15,'#bd896c');rect(x-10,y-3,21,5,'#d2a382');rect(x-1,y-19,3,18,'#65885d');rect(x-9,y-15,9,5,'#8ca871');rect(x+2,y-23,10,7,'#87a66c');rect(x-4,y-26,9,8,'#e6c77d');}}
  function plot(p,f){
    if(!f.tilled&&!f.crop)return;
    const x=p.x*T,y=p.y*T;rect(x+1,y+1,30,30,f.watered?'#7e7754':f.tilled?'#a58e61':'#b6a473');
    if(f.tilled)for(let a=0;a<3;a++)rect(x+5,y+7+a*8,22,2,f.watered?'#686d4b':'#907d53');
    if(!f.crop)return;
    if(G.mature(f)){oval(x+16,y+20,f.crop==='pumpkinSeed'?10:7,7,f.crop==='seed'?'#f1e6c9':f.crop==='pumpkinSeed'?'#deb46b':'#d68b78');rect(x+12,y+5,5,12,'#5d8a54');rect(x+6,y+9,8,5,'#83aa63');rect(x+17,y+8,8,6,'#709b56');}
    else{rect(x+15,y+12-f.growth*2,3,11,'#638b4d');rect(x+8,y+11-f.growth*3,8,5,'#8baa58');rect(x+18,y+9-f.growth*3,6,5,'#749b4d');}
    if(f.watered)rect(x+25,y+25,3,3,'#a4caca');
  }
  function greenhouse(stage){
    const site=DalbitWorld.GREENHOUSE,x=site.x*T,y=site.y*T+22;oval(x+64,y+105,77,14,'#3b5c3826');
    rect(x+2,y+4,124,100,stage===2?'#afd1b5':'#b8b999');
    poly([[x-5,y+7],[x+64,y-48],[x+133,y+7]],stage===2?'#aecbb3':'#a3ae8a');
    poly([[x+5,y+3],[x+64,y-39],[x+122,y+3]],stage===2?'#c3ddc4':'#c3c5a6');
    for(let i=0;i<5;i++){rect(x+i*31,y+2,4,103,stage===0?'#948c69':'#849d78');}
    rect(x-6,y+5,140,6,'#819472');rect(x,y+52,128,4,'#8fa37f');rect(x,y+100,128,7,'#929d77');
    if(stage===0){rect(x+8,y+30,49,7,'#8e805a');rect(x+13,y+32,6,45,'#9a875b');poly([[x+82,y+12],[x+108,y+12],[x+92,y+33]],'#718b70');rect(x+93,y+63,21,7,'#7d9861');rect(x+103,y+43,6,53,'#718956');rect(x+14,y+66,24,25,'#96a46b');}
    if(stage===1){rect(x+12,y+64,35,26,'#dfd9b3');rect(x+18,y+70,22,2,'#93a387');rect(x+18,y+78,14,2,'#93a387');rect(x+85,y+62,26,12,'#9d8660');rect(x+85,y+78,26,12,'#9d8660');}
    if(stage===2){for(let i=0;i<3;i++){rect(x+12+i*37,y+26,13,23,'#f0edd270');}rect(x+12,y+81,23,16,'#b49a69');rect(x+18,y+68,5,15,'#628f5d');rect(x+12,y+67,18,6,'#81a266');rect(x+88,y+81,21,16,'#bca074');rect(x+96,y+66,4,17,'#759950');oval(x+94,y+77,8,6,'#dfba70');}
    rect(x+64,y+64,29,40,stage===2?'#739879':'#8b8b67');rect(x+68,y+68,21,32,stage===2?'#d3e3bb':'#b3b893');rect(x+85,y+86,3,3,'#aa965a');
    label(stage===2?'우리의 온실':stage===1?'온실 · 복구 중':'낡은 공동 온실',x+64,y-57);
  }
  function greenhouseInside(s){
    rect(0,0,1024,704,'#668879');rect(271,161,490,427,'#496b52');rect(281,171,470,405,'#dfdfb7');rect(288,178,456,115,'#c4dbba');
    for(let x=288;x<744;x+=57){rect(x,178,4,115,'#8ea685');rect(x+9,184,13,98,'#f2f2d755');}
    rect(288,236,456,4,'#8ea685');rect(288,291,456,277,'#c7c69a');
    for(let y=304;y<568;y+=32)rect(288,y,456,1,'#b7bb8d');
    rect(367,343,182,120,'#819171');rect(376,345,168,115,'#a5ae84');
    G.GREEN_PLOTS.forEach((p,i)=>plot(p,s.greenhousePlots[i]));
    rect(587,331,7,162,'#92b4a2');rect(582,331,18,5,'#b5d2bd');
    for(let i=0;i<3;i++){rect(618,337+i*50,44,8,'#99ac81');rect(624,311+i*50,15,26,'#b8a878');rect(628,301+i*50,4,13,'#65905a');rect(623,302+i*50,16,6,'#87a566');}
    rect(502,558,53,10,'#5d7d5c');label('우리의 공동 온실',512,153);label('자동 급수 · 모든 계절에 따뜻해요',511,275);label('농장으로',529,598);
  }
  function inside(s){rect(0,0,1024,704,'#718476');rect(270,174,494,412,'#415848');rect(280,180,474,400,'#c3b896');rect(288,188,458,99,'#e6ddbe');for(let i=0;i<14;i++)rect(288+i*33,188,1,99,'#d5cba9');rect(288,283,458,9,'#ad9572');rect(288,292,458,276,'#bc9d70');for(let y=292;y<566;y+=24){rect(288,y,458,2,'#ad8e62');for(let x=288+(y%48?40:0);x<740;x+=100)rect(x,y,2,24,'#ad8e62');}rect(330,209,63,51,'#92794f');rect(336,214,51,38,'#a8c9b4');rect(359,214,4,38,'#f0e4c0');rect(336,232,51,4,'#f0e4c0');rect(416,355,175,133,'#ded0a0');rect(423,362,161,119,'#b8bd91');rect(437,375,132,92,'#cbd0a6');rect(630,279,77,108,'#9c7958');rect(632,283,73,34,'#eee7ce');rect(632,317,73,63,'#8a9d81');rect(635,321,67,4,'#b4c2a1');rect(502,558,53,10,'#4d674a');s.furniture.forEach(furniture);label('나의 작은 집',512,167);label('잠자기',669,405);label('농장으로',529,597);}
  function exits(s){
    for(const e of DalbitWorld.MAPS[s.map].exits){
      const x=e.x*T+16,y=e.y*T+16;
      oval(x,y,14,9,'#faf0c780');
      c.fillStyle='#607954';c.font='bold 22px sans-serif';c.textAlign='center';c.fillText({right:'→',left:'←',up:'↑',down:'↓'}[e.direction],x,y+7);
      label(e.name,Math.max(80,Math.min(938,x)),e.direction==='up'?y+36:y-24);
    }
  }
  function workshopBuilding(){
    const w=DalbitWorld.WORKSHOP,x=w.x*T,y=w.y*T,width=w.width*T,height=w.height*T;
    oval(x+width/2,y+height+3,width/2+9,10,'#3a55352b');
    rect(x,y,width,height,'#d9c49b');rect(x+5,y+5,width-10,height-10,'#c8ad80');
    for(let i=1;i<6;i++)rect(x+4,y+i*10,width-8,2,'#b89b70');
    rect(x+width-30,y-43,18,41,'#898778');rect(x+width-33,y-47,24,7,'#a3a08a');
    poly([[x-10,y+5],[x+14,y-27],[x+width/2,y-43],[x+width-14,y-27],[x+width+10,y+5]],'#96765f');
    poly([[x-4,y-1],[x+17,y-24],[x+width/2,y-37],[x+width-17,y-24],[x+width+4,y-1]],'#b68c68');
    for(let i=0;i<3;i++)rect(x+12-i*5,y-21+i*9,width-24+i*10,2,'#947456');
    rect(x-10,y+3,width+20,7,'#765f49');
    rect(x+12,y+17,36,29,'#796b51');rect(x+16,y+21,28,21,'#b3c2a0');rect(x+29,y+21,3,21,'#e9dfb9');rect(x+16,y+31,28,3,'#e9dfb9');
    rect(x+65,y+19,31,45,'#816647');rect(x+69,y+23,23,41,'#aa885d');rect(x+69,y+24,23,15,'#d2c49d');rect(x+87,y+45,3,4,'#edd893');
    rect(x+106,y+31,14,5,'#596b64');rect(x+110,y+36,6,9,'#596b64');rect(x+106,y+44,15,4,'#718278');
    rect(x+64,y+height,35,5,'#c7b588');label('모루의 공방',x+width/2,y-54);
  }
  function storageChest(){
    const {x,y}=DalbitWorld.STORAGE,px=x*T+16,py=y*T+22;
    oval(px,py+5,19,6,'#355b392c');rect(px-15,py-21,31,24,'#9b7852');rect(px-16,py-25,33,10,'#c7a575');rect(px-16,py-16,33,4,'#7f644a');rect(px-10,py-25,3,29,'#d5bf8b');rect(px+9,py-25,3,29,'#d5bf8b');rect(px-3,py-16,7,8,'#e6cf82');label('창고',px,py+26);
  }
  function sapling(x,y,age=0){
    const px=x*T+16,py=y*T+25,height=12+age*9;
    oval(px,py+2,7+age*3,3,'#355b3929');rect(px-2,py-height,4,height,'#9d8057');
    rect(px-10-age*3,py-height-5,11+age*3,7+age*2,'#749653');rect(px+1,py-height-10,10+age*4,8+age*3,'#8fae65');
    if(age>0)rect(px-7-age*2,py-height-17,17+age*4,10+age*2,'#618654');
  }
  function nodeObjects(s,season){return DalbitWorld.NODES.filter(n=>n.map===s.map&&!DalbitWorld.treeRemoved(s,n)&&!DalbitWorld.rockRemoved(s,n)).map(n=>({y:n.y,draw:()=>{
    const hits=s.nodeHits[n.id]||0,done=hits>=n.hits,x=n.x*T+16,y=n.y*T+20;
    if(n.type==='tree'){
      if(Object.hasOwn(s.treeGrowth||{},n.id))sapling(n.x,n.y,s.treeGrowth[n.id]);
      else if(!done)tree(n.x,n.y,season);
      else{oval(x,y+8,16,6,'#355b3929');rect(x-9,y-5,18,13,'#90704f');oval(x,y-5,10,5,'#d2b17e');oval(x,y-5,5,2,'#a9885c');}
    }else if(done){resource({...n,item:'stone'});rect(x-15,y+6,5,3,'#aab2a0');}
    else{oval(x,y+7,20,7,'#355b392b');poly([[x-18,y+6],[x-16,y-12],[x-5,y-23],[x+10,y-20],[x+19,y-6],[x+16,y+7]],'#8f9e92');poly([[x-16,y-12],[x-5,y-23],[x+10,y-20],[x+4,y-8]],'#c1c9b4');rect(x-12,y+1,21,3,'#778c7f');if(hits){rect(x,y-12,3,10,'#5b7168');rect(x+2,y-5,8,3,'#5b7168');}}
    if(hits&&!done){rect(x-14,y+13,28,4,'#677454');rect(x-14,y+13,28*hits/n.hits,4,'#e8d493');}
    if(n.type==='tree'&&hits>n.hits){rect(x-14,y+13,28,4,'#677454');rect(x-14,y+13,28*(hits-n.hits)/DalbitWorld.STUMP_HITS,4,'#e8d493');}
  }}));}
  function placementPreview(s,view){
    if(view.placement==='sapling'){
      if(s.scene!=='outside')return;
      for(const n of DalbitWorld.NODES.filter(n=>n.map===s.map&&DalbitWorld.treeRemoved(s,n))){c.strokeStyle=DalbitWorld.treePlantError(s,n.x,n.y)?'#c77770':'#e5ef9a';c.lineWidth=2;c.strokeRect(n.x*T+2,n.y*T+2,28,28);}
      if(view.pointer){const p=view.pointer,valid=!DalbitWorld.treePlantError(s,p.x,p.y);rect(p.x*T,p.y*T,T,T,valid?'#87b87c88':'#c7777088');c.globalAlpha=.65;sapling(p.x,p.y);c.globalAlpha=1;}
      return;
    }
    if(!view.placement||!view.pointer)return;
    const p=view.pointer,valid=!DalbitWorld.placementError(s,p.x,p.y)&&!(view.placement==='fence'&&s.scene!=='outside');
    rect(p.x*T,p.y*T,T,T,valid?'#87b87c88':'#c7777088');c.globalAlpha=.65;furniture({item:view.placement,...p});c.globalAlpha=1;
  }
  function localResources(s){G.RESOURCES.forEach((r,i)=>{if(r.map===s.map&&!s.gathered.includes(i))resource(r);});}
  function farm(s,view,season){
    // The front path meets the east coast road and the south village lane.
    paths(DalbitWorld.FARM_PATHS,'#dac89a');
    G.PLOTS.forEach((p,i)=>plot(p,s.plots[i]));
    (s.extraPlots||[]).forEach(p=>plot(p,p));
    rect(161,290,5,24,'#947c5b');rect(151,283,24,15,'#81987c');rect(169,280,8,8,'#c78c76');
    localResources(s);
    const objects=nodeObjects(s,season);
    objects.push({y:DalbitWorld.STORAGE.y,draw:storageChest},...s.outdoorFurniture.map(f=>({y:f.y,draw:()=>furniture(f)})),{y:8,draw:()=>house(5*T,4*T)},{y:8,draw:()=>greenhouse(s.community.stage)},{y:view.y,draw:()=>character(view.x,view.y,'player',view.walking?Math.sin(t*14)*1.5:0,0,view.facing)});
    objects.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    label('나의 집',239,297);exits(s);
  }
  function beach(s,view,season){
    tiles(0,0,32,22,'#decda4');tiles(0,0,23,4,'#acbd84');
    for(let i=0;i<200;i++){const x=noise(i,61)*(23*T-3),y=4*T+noise(i,62)*(18*T-2);rect(x,y,3,2,i%2?'#c7b58b':'#eee0bb');}
    paths([[0,10,10,2]],'#cbbc91');
    tiles(22,0,1,22,'#e9deba');tiles(23,0,9,22,'#8abbb3');tiles(26,0,6,22,'#78aaa8');
    for(let i=0;i<32;i++){
      const y=(i*29+t*7)%704,x=23*T+3+Math.sin(t*.9+i*.2)*3;
      rect(x,y,4,21,'#f0f0dba8');rect(772+noise(i,63)*223,y+8,14,2,'#c1dcd080');
    }
    // Pier aligns exactly with the two walkable tiles across the water.
    rect(695,321,234,67,'#638c8550');rect(704,320,224,64,'#9d825d');
    for(let x=706;x<928;x+=16)rect(x,323,14,58,'#c5ad7d');
    fences('beach');
    // A small lighthouse above the sand.
    oval(218,224,39,12,'#917f5c25');rect(194,110,46,116,'#f1e6c4');rect(194,152,46,19,'#bc8b70');rect(190,104,54,10,'#9d8262');rect(199,81,36,23,'#a4c2b6');rect(215,81,3,23,'#ebe1bb');poly([[187,81],[218,60],[247,81]],'#7e9783');rect(210,202,15,24,'#9d8561');label('조개빛 등대',219,254);
    localResources(s);
    const objects=nodeObjects(s,season);
    objects.push({y:view.y,draw:()=>character(view.x,view.y,'player',view.walking?Math.sin(t*14)*1.5:0,0,view.facing)});objects.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    label('조개가 쉬어 가는 모래사장',391,603);label('낚시 부두',844,420);exits(s);
  }
  function outdoorEffects(s,view){
    placementPreview(s,view);
    if(view.work&&performance.now()<view.work.until){const p=view.work;c.font='23px sans-serif';c.textAlign='center';c.fillStyle='#fff1c5';c.fillText(p.icon,p.x*T+32,p.y*T-22);}

    if(view.pointer){const p=view.pointer,hoeing=view.tool==='hoe'&&s.map==='farm'&&!view.placement;c.strokeStyle=hoeing?(DalbitWorld.tillError(s,p.x,p.y)?'#d17b66':'#e5ef9a'):'#fff5cb99';if(hoeing)rect(p.x*T+2,p.y*T+2,28,28,DalbitWorld.tillError(s,p.x,p.y)?'#ba625133':'#91bb6344');c.lineWidth=2;c.strokeRect(p.x*T+2,p.y*T+2,28,28);}
    if(view.active){c.strokeStyle='#ffe7a1';c.lineWidth=3;c.strokeRect(view.active.x*T+1,view.active.y*T+1,30,30);}
    if(view.fishing){const p=s.player,target=DalbitWorld.fishingTarget(s);if(target){c.strokeStyle='#e9e1b3';c.lineWidth=1;c.beginPath();c.moveTo(p.x*T+24,p.y*T);c.lineTo(target.x,target.y);c.stroke();oval(target.x,target.y,4,2,'#ead4ab');if(view.fishing==='bite')label('! 지금 E !',target.x,target.y-28);}}
    if(s.time>1050){c.fillStyle=`rgba(39,53,73,${Math.min(.35,(s.time-1050)/700)})`;c.fillRect(0,0,1024,704);}
    if(G.weather(s)==='rain'){c.fillStyle='#66848b20';c.fillRect(0,0,1024,704);c.strokeStyle='#e1eadb66';c.lineWidth=1;for(let i=0;i<75;i++){const x=noise(i,51)*1024,y=(noise(i,52)*704+t*190)%704;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y+11);c.stroke();}}
    if(s.festival&&s.map==='village'){for(let i=0;i<15;i++){const x=174+i*43,y=240+Math.sin(i*.3)*18;rect(x,y,9,13,['#dab285','#e5ca83','#9ebaa2'][i%3]);rect(x+2,y+2,5,8,'#ffebbb');}}
  }
  function draw(canvas,s,view){
    c=canvas.getContext('2d');c.imageSmoothingEnabled=false;t=performance.now()/1000;const season=G.season(s),winter=season==='겨울';
    if(s.scene==='greenhouse'){greenhouseInside(s);character(view.x,view.y,'player',view.walking?Math.sin(t*14)*1.5:0,0,view.facing);if(view.active){c.strokeStyle='#ffefab';c.lineWidth=3;c.strokeRect(view.active.x*T+1,view.active.y*T+1,30,30);}return;}
    if(s.scene==='inside'){inside(s);character(view.x,view.y,'player',view.walking?Math.sin(t*14)*1.5:0,0,view.facing);placementPreview(s,view);return;}
    rect(0,0,1024,704,winter?'#ced8bc':season==='가을'?'#b9bd7c':season==='여름'?'#9aba78':'#acc487');
    for(let y=0;y<22;y++)for(let x=0;x<32;x++){
      const n=noise(x,y);if(n>.65)rect(x*T,y*T,T,T,winter?'#d8dfc8':season==='가을'?'#c2c58a':'#b5ca91');if(n<.27){rect(x*T+8,y*T+15,2,5,winter?'#b3c2a3':'#93b373');rect(x*T+11,y*T+12,2,6,winter?'#b3c2a3':'#93b373');}
    }
    if(s.map==='farm'){farm(s,view,season);outdoorEffects(s,view);return;}
    if(s.map==='beach'){beach(s,view,season);outdoorEffects(s,view);return;}
    for(let y=19;y<22;y++)rect(0,y*T,1024,32,y===19?'#d7d4a0':y===20?'#e2d6ac':'#d2d6b5');
    rect(0,688,1024,16,'#90b9ae');rect(0,688,1024,3,'#f0eed255');
    // Winding paths and stepping stones.
    paths([[11,0,2,10],[12,6,2,14],[5,9,21,2],[7,8,1,3],[18,7,2,3],[12,13,6,2]],'#d9c899');
    // River, banks, animated ripples, and a footbridge.
    tiles(26,0,3,21,'#79aeab');rect(26*T+6,0,3*T-12,21*T,'#88bbb5');rect(26*T,0,6,21*T,'#b6d0ac');rect(29*T-6,0,6,21*T,'#b6d0ac');
    for(let i=0;i<36;i++){let y=(i*43+t*5)%(21*T-5),x=26*T+11+noise(i,11)*58;rect(x,y,9,2,'#c0d9c777');rect(x+4,y+4,12,1,'#a8cfc388');}
    tiles(25,10,4,2,'#917c58');for(let x=25*T+2;x<29*T;x+=16)rect(x,10*T+2,12,2*T-4,'#c6b381');
    // Garden, fence, small village details.
    tiles(6,12,5,3,winter?'#9a9673':'#97ad72');
    DalbitWorld.PLANTS.village.forEach(p=>resource({...p,item:'flower'}));fences('village');
    rect(451,272,5,31,'#967b52');rect(437,257,34,28,'#8e8058');rect(441,261,26,19,'#e9deb8');rect(446,265,14,2,'#c2aa72');rect(446,270,11,2,'#c2aa72');
    rect(163,290,5,24,'#947c5b');rect(153,283,24,15,'#81987c');rect(170,280,8,8,'#c78c76');
    localResources(s);
    const sorted=[...nodeObjects(s,season),{y:DalbitWorld.WORKSHOP.y+DalbitWorld.WORKSHOP.height-1,draw:workshopBuilding},{y:8,draw:()=>house(5*T,4*T)},{y:7,draw:()=>house(17*T,3*T,true)},...(view.npcs||G.npcs(s)).map(n=>({y:n.drawY??n.y,draw:()=>{const x=n.drawX??n.x,y=n.drawY??n.y,walk=n.walking&&!view.npcPaused?Math.sin(t*12):0;character(x,y,n.id,n.walking?Math.abs(walk)*1.3:Math.sin(t*1.4+n.x)*.5,walk*2.5);const ready=G.REQUESTS.some(q=>q.npc===n.id&&s.requests[q.id]==='active'&&(s.bag[q.item]||0)>=q.amount);label(n.name+(ready?' !':''),x*T+16,y*T-38);}})),{y:view.y,draw:()=>character(view.x,view.y,'player',view.walking?Math.sin(t*14)*1.5:0,0,view.facing)}];sorted.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    label('이웃들의 집',239,297);label('마을 꽃 정원',270,520);exits(s);
    for(let i=0;i<18;i++){const x=40+noise(i,45)*720,y=60+noise(i,46)*530;if((x>150&&x<760&&y>90&&y<480))continue;rect(x,y,2,7,'#799a63');rect(x-2,y-2,6,4,i%2?'#e4d59c':'#e9c5b5');}
    // Moving butterflies and soft drifting light.
    for(let i=0;i<4;i++){const x=330+Math.sin(t*.4+i*4)*230,y=180+Math.cos(t*.3+i)*150;rect(x,y,3,3,'#fcf0be');rect(x+(Math.sin(t*8)>0?4:2),y-1,3,4,'#e6d0a0');}
    outdoorEffects(s,view);
  }
  window.DalbitRender={draw};
})();
