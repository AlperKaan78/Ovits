/* Shared browser/server rules for the civilization expansion. */
(function(){
  const E=window.Civilization={};
  const move=Game.moveTo;
  Game.moveTo=function(u,x,y,speed,dt){
    const G=Game.G;if(!G||u.owner!=='player')return move(u,x,y,speed,dt);
    const blocks=G.buildings.concat(G.visitors?.buildings||[]).filter(alive);
    const inside=(px,py,b)=>px>b.x-.15&&px<b.x+b.size+.15&&py>b.y-.15&&py<b.y+b.size+.15;
    const goal=blocks.find(b=>inside(x,y,b));if(goal){const c=Game.center(goal),dx=u.x-c.x,dy=u.y-c.y,r=goal.size/2+.3;if(Math.abs(dx)>Math.abs(dy)){x=c.x+Math.sign(dx||1)*r;y=Math.max(goal.y-.1,Math.min(goal.y+goal.size+.1,y));}else{y=c.y+Math.sign(dy||1)*r;x=Math.max(goal.x-.1,Math.min(goal.x+goal.size+.1,x));}}
    const clear=(ax,ay,bx,by)=>{const n=Math.ceil(Math.hypot(bx-ax,by-ay)*4);for(let i=1;i<=n;i++)if(blocks.some(b=>inside(ax+(bx-ax)*i/n,ay+(by-ay)*i/n,b)))return false;return true;};
    if(clear(u.x,u.y,x,y)){u._route=null;return move(u,x,y,speed,dt);}
    const key=Math.floor(x)+','+Math.floor(y)+','+blocks.length;let route=u._route;
    if(!route||route.key!==key){const w=G.map.w,h=G.map.h,start=Math.floor(u.y)*w+Math.floor(u.x),end=Math.floor(y)*w+Math.floor(x),q=[start],prev=new Map([[start,-1]]);let index=0;
      while(index<q.length&&!prev.has(end)){const k=q[index++],cx=k%w,cy=Math.floor(k/w);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy,nk=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=h||prev.has(nk)||blocks.some(b=>inside(nx+.5,ny+.5,b)))continue;prev.set(nk,k);q.push(nk);}}
      if(!prev.has(end)){u.state='blocked';return false;}const points=[];for(let k=end;k!==start;k=prev.get(k))points.unshift({x:k%w+.5,y:Math.floor(k/w)+.5});route=u._route={key,points};
    }
    const p=route.points[0];if(!p)return move(u,x,y,speed,dt);if(move(u,p.x,p.y,speed,dt))route.points.shift();return false;
  };
  Object.assign(CONFIG.buildings,{
    hastane:{ad:'Hastane',cost:{tas:100,oz:20},hp:260,size:2,buildTime:25},
    duvar:{ad:'Duvar',cost:{tas:15},hp:500,size:1,buildTime:5},
    gozetleme:{ad:'Savunma Kulesi',cost:{tas:100,oz:15},hp:400,size:1,buildTime:20,range:7,dps:12}
  });
  const worker=u=>['isci','tasiyici'].includes(u.kind),alive=e=>e.hp>0;
  E.setFlag=(G,flag)=>{if(!['#c9773a','#388fc4','#799c44','#aa64bd'].includes(flag))return false;G.flag=flag;for(const b of G.buildings)b.flag=flag;return true;};
  E.locked=u=>u.order?.type==='build'&&u.order.b?.hp>0&&u.order.b.built===false;
  E.select=(G,kind)=>{G.ui.unitFilter=kind||null;G.ui.unitPage=0;G.ui.selection=G.units.filter(u=>u.owner==='player'&&alive(u)&&(!kind||u.kind===kind)&&!['yumurta','yavru'].includes(u.kind));G.ui.selected=G.ui.selection[0]||null;};
  E.assign=function(G,units,type,target){
    let count=0;
    for(const u of units){if(!alive(u)||E.locked(u)||u.owner!=='player')continue;
      if(['mine','repair'].includes(type)&&!worker(u))continue;
      if(['hospital','upgrade'].includes(type)&&u.kind!=='bilimci')continue;
      if(type==='mine'&&(!target||target.type!=='ocak'||target.built===false))continue;
      if(['hospital','heal'].includes(type)&&(!target||target.type!=='hastane'||target.built===false))continue;
      if(type==='repair'&&(!target||target.built===false))continue;
      if(!['hold','return','mine','repair','hospital','upgrade','heal','gather'].includes(type))continue;
      if(type==='upgrade'&&(!target||target.built===false||!['ev','ocak'].includes(target.type)))continue;
      if(type==='upgrade'&&!target.data.upgrading){const level=target.level||1,cost={tas:60*level,oz:15*level};if(level>=5||!Game.pay(G,cost))continue;target.data.upgrading=true;target.data.upgradeProgress=0;}
      if(u.target?.claimedBy===u.id)u.target.claimedBy=null;u.target=null;u.huntTarget=null;u.post=null;u.chip=null;
      u.assignment=type;u.order={type,target};u.state=type;count++;
    }
    Game.msg(G,count?count+' birim: '+({hold:'Dur',return:'Merkeze dön',gather:'Yıldız topla',mine:'Taş kaz',repair:'Tamir',hospital:'Tedavi',upgrade:'Geliştir'}[type]||type):'Uygun birim yok; inşaat işçileri iş bitene kadar meşgul.');return count>0;
  };
  E.upgradeUnit=function(G,units){let count=0;for(const u of units){if(!['isci','asker'].includes(u.kind)||E.locked(u)||(u.level||1)>=5)continue;const cost={tas:30*(u.level||1),oz:10*(u.level||1)};if(!Game.pay(G,cost))continue;u.level=(u.level||1)+1;u.maxHp+=10;u.hp=Math.min(u.maxHp,u.hp+10);count++;}return count;};
  E.repair=(G,b)=>E.assign(G,G.units.filter(u=>worker(u)), 'repair',b);
  E.upgrade=(G,b)=>E.assign(G,G.units.filter(u=>u.kind==='bilimci'),'upgrade',b);
  E.recall=G=>E.assign(G,G.units.filter(worker),'return');
  E.ensure=function(G){
    if(!G.deposits)G.deposits=[{id:'ore-a',x:3,y:7,remaining:8000},{id:'ore-b',x:15,y:29,remaining:8000},{id:'ore-c',x:29,y:11,remaining:10000},{id:'ore-d',x:38,y:30,remaining:10000}];
    for(const d of G.deposits){d.kind='stoneDeposit';d.hp=d.remaining>0?1:0;}
    for(const u of G.units){if(!u.gender){const female=G.units.filter(v=>v.gender==='female').length,male=G.units.filter(v=>v.gender==='male').length;u.gender=female===male?(Math.random()<.5?'female':'male'):female<male?'female':'male';}u.level=u.level||1;}
  };
  const canPlace=City.canPlace;
  City.canPlace=function(G,type,x,y){E.ensure(G);if(type==='ocak'&&!G.deposits.some(d=>d.remaining>0&&Game.dist(x+.5,y+.5,d.x+.5,d.y+.5)<1.5))return {ok:false,reason:'Taş ocağı yalnızca işaretli taş yatağı üzerine kurulabilir.'};if((G.visitors?.buildings||[]).some(b=>x<b.x+b.size&&x+CONFIG.buildings[type]?.size>b.x&&y<b.y+b.size&&y+CONFIG.buildings[type]?.size>b.y))return {ok:false,reason:'Başka medeniyetin binası.'};return canPlace(G,type,x,y);};
  const command=City.command,release=City.release,build=City.build;
  City.command=(G,units,info)=>command(G,units.filter(u=>!E.locked(u)),info);
  City.release=(G,units)=>{units=units.filter(u=>!E.locked(u));E.assign(G,units,'hold');};
  City.build=function(G,type,x,y){const selection=G.ui.selection;G.ui.selection=selection.filter(u=>!E.locked(u));const b=build(G,type,x,y);G.ui.selection=selection;return b;};
  const city=Game.modules.find(m=>m.name==='city'),update=city.update;
  city.update=function(G,dt){
    E.ensure(G);
    const managed=G.units.filter(u=>['hold','return','mine','repair','hospital','upgrade','heal'].includes(u.order?.type));
    for(const u of G.units)u.externalOrder=managed.includes(u);
    // Original city production for quarries is replaced by staffed mining below.
    const rate=G.cfg.buildings.ocak.tasPerSec;G.cfg.buildings.ocak.tasPerSec=0;
    try{update(G,dt);}finally{G.cfg.buildings.ocak.tasPerSec=rate;}
    E.ensure(G);
    for(const b of G.buildings){if(!alive(b)||b.built===false)continue;const lv=b.level||1;if(b.type==='ev'&&lv>1)b.data.eggT+=(lv-1)*.25*dt;
      if(b.type==='gozetleme'){const c=Game.center(b),t=Game.nearest([...G.enemies,...G.colonies.flatMap(c=>c.members.filter(m=>m.state==='hostile'))],c.x,c.y,alive);if(t&&Game.dist(c.x,c.y,t.x,t.y)<=7){t.hp-=12*dt;if(b.civ)t.killerCiv=b.civ;b.firingAt={x:t.x,y:t.y};}else b.firingAt=null;}
    }
    for(const u of managed){if(!alive(u))continue;const o=u.order;if(!o)continue;const sp=(G.cfg.units[u.kind]?.speed||2)*(1+(u.level-1)*.08);const b=o.target;
      if(['mine','repair','hospital','upgrade','heal'].includes(o.type)&&(!b||!alive(b)||!G.buildings.includes(b))){u.order={type:'hold'};u.state='hold';continue;}
      if(o.type==='hold'){u.state='hold';continue;}
      const target=o.type==='return'?Game.merkez(G):b;if(!target)continue;const p=Game.center(target),reach=target.size/2+.65;
      if(Game.dist(u.x,u.y,p.x,p.y)>reach){u.state='move';Game.moveTo(u,p.x,p.y,sp,dt);continue;}
      u.state=o.type;
      if(o.type==='return'){
        if(u.carrying){const cr=u.carrying;Game.gain(G,{oz:cr.oz});G.crystals=G.crystals.filter(c=>c!==cr);u.carrying=null;}u.order={type:'hold'};u.state='hold';
      }
      if(o.type==='repair'&&b.hp<b.maxHp){const amount=Math.min(12*dt,b.maxHp-b.hp,G.res.tas*5);b.hp+=amount;G.res.tas-=amount/5;}
      if(o.type==='mine'){const d=G.deposits.find(d=>Game.dist(d.x+.5,d.y+.5,p.x,p.y)<1.5);if(d&&d.remaining>0){const amount=Math.min(d.remaining,2*(b.level||1)*(1+(u.level-1)*.2)*dt);d.remaining-=amount;G.res.tas+=amount;}}
      if(o.type==='hospital')for(const patient of G.units)if(alive(patient)&&patient.hp<patient.maxHp&&Game.dist(patient.x,patient.y,p.x,p.y)<4){patient.hp=Math.min(patient.maxHp,patient.hp+5*dt);patient.healingUntil=G.time+.3;}
      if(o.type==='heal'&&u.hp>=u.maxHp){u.order={type:'hold'};u.state='hold';}
      if(o.type==='upgrade'&&b.data.upgrading){b.data.upgradeProgress+=dt;if(b.data.upgradeProgress>=20*(b.level||1)){b.level=(b.level||1)+1;b.maxHp+=50;b.hp=Math.min(b.maxHp,b.hp+50);b.data.upgrading=false;if(b.type==='ev')b.data.capacity=2+b.level;Game.msg(G,CONFIG.buildings[b.type].ad+' seviye '+b.level);}}
      if(o.type==='upgrade'&&!b.data.upgrading){u.order={type:'hold'};u.state='hold';}
    }
    // Keep bodies outside solid footprints and inside the playable map.
    for(const u of G.units){if(['yumurta'].includes(u.kind))continue;for(const b of G.buildings){if(!alive(b))continue;const gap=.18;if(u.x>b.x-gap&&u.x<b.x+b.size+gap&&u.y>b.y-gap&&u.y<b.y+b.size+gap){const edges=[{d:Math.abs(u.x-b.x+gap),x:b.x-gap,y:u.y},{d:Math.abs(u.x-b.x-b.size-gap),x:b.x+b.size+gap,y:u.y},{d:Math.abs(u.y-b.y+gap),x:u.x,y:b.y-gap},{d:Math.abs(u.y-b.y-b.size-gap),x:u.x,y:b.y+b.size+gap}].sort((a,b)=>a.d-b.d);u.x=edges[0].x;u.y=edges[0].y;}}u.x=Math.max(.2,Math.min(G.map.w-.2,u.x));u.y=Math.max(.2,Math.min(G.map.h-.2,u.y));}
  };
})();
