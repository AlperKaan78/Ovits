/* Kişi 3 — Kül Göçebeleri. docs/CONTRACT.md ile uyumlu. */
(function () {
  'use strict';
  const cfg=G=>G.cfg.enemies;
  const alive=e=>e&&e.hp>0&&!e.escaped;
  const point=e=>e.size?Game.center(e):e;
  const dist=(a,b)=>{a=point(a);b=point(b);return Game.dist(a.x,a.y,b.x,b.y);};
  const nearest=(list,e,filter)=>Game.nearest(list,e.x,e.y,filter);
  function init(G){G.flags.nextRaidIn=cfg(G).firstRaid;G.flags.raidNumber=0;}
  function spawn(G){const c=cfg(G),count=c.baseSize+c.growPerRaid*G.flags.raidNumber;
    for(let i=0;i<count;i++){
      const side=Math.floor(Math.random()*3),along=Math.random();
      const x=side===0?G.map.w-.01:along*(G.map.w-1);
      const y=side===1?.01:side===2?G.map.h-.01:along*(G.map.h-1);
      G.enemies.push({id:Game.newId(),x,y,hp:c.hp,maxHp:c.hp,target:null});
    }
    G.flags.raidNumber++;Game.msg(G,'Kül Göçebeleri geliyor!','#d8a287');
  }
  function protectedCrystal(G,crystal){
    if(window.City&&typeof City.guardedAt==='function')return City.guardedAt(G,crystal.x,crystal.y);
    return G.buildings.some(b=>alive(b)&&b.type==='karakol'&&dist(b,crystal)<=G.cfg.buildings.karakol.guardRadius);
  }
  function steal(G,e,crystal){
    if(!crystal||!(crystal.oz>0))return false;
    G.crystals=G.crystals.filter(c=>c!==crystal);
    for(const u of G.units)if(u.carrying===crystal)u.carrying=null;
    e.escaped=true;e.hp=0;e.rewarded=true;
    Game.msg(G,'Akıncı '+Math.ceil(crystal.oz)+' Öz çalıp kaçtı!','#e7a56d');
    return true;
  }
  function target(G,e){
    return nearest(G.buildings,e,b=>alive(b)&&b.type==='kule')
      ||nearest(G.units,e,u=>alive(u)&&u.carrying)
      ||nearest(G.buildings,e,b=>alive(b)&&b.type==='karakol')
      ||nearest(G.buildings,e,alive);
  }
  function update(G,dt){
    if(G.paused||G.over||!Number.isFinite(dt)||dt<=0)return;
    const c=cfg(G);G.flags.nextRaidIn-=dt;
    while(G.flags.nextRaidIn<=0){spawn(G);G.flags.nextRaidIn+=Math.max(1,c.interval);}
    for(const e of G.enemies){
      if(e.hp<=0){if(!e.rewarded&&!e.escaped){e.rewarded=true;Game.gain(G,c.bounty);Game.msg(G,'Kül Göçebesi durduruldu: '+Game.costText(c.bounty),'#c6d0a0');}continue;}
      const crystal=nearest(G.crystals,e,o=>o.oz>0&&o.carriedBy==null&&!protectedCrystal(G,o));
      if(crystal&&dist(e,crystal)<=c.range){steal(G,e,crystal);continue;}
      e.target=target(G,e);
      // No city target: seek only unguarded, uncarried crystals.
      if(!e.target)e.target=crystal;
      const t=e.target;if(!t)continue;
      const p=point(t);
      if(dist(e,t)>c.range){Game.moveTo(e,p.x,p.y,c.speed,dt);continue;}
      if(G.crystals.includes(t)){steal(G,e,t);continue;}
      t.hp=Math.max(0,t.hp-c.dps*dt);
      if(t.hp<=0&&t.carrying){const loot=t.carrying;steal(G,e,loot);}
    }
    G.enemies=G.enemies.filter(e=>e.hp>0&&!e.escaped);
  }
  function draw(ctx,G){const T=G.map.tile;
    for(const e of G.enemies){if(!alive(e))continue;
      ctx.save();ctx.translate(e.x*T,e.y*T);
      if(window.Art)Art.draw(ctx,'akinci',0,0,T,{time:G.time});
      else {ctx.fillStyle=G.cfg.colors.akinci;ctx.strokeStyle='#b9b8bd';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-T*.4);ctx.lineTo(T*.34,T*.3);ctx.lineTo(-T*.34,T*.3);ctx.closePath();ctx.fill();ctx.stroke();}
      ctx.fillStyle='#2b2027';ctx.fillRect(-T*.4,-T*.6,T*.8,3);ctx.fillStyle='#d68a79';ctx.fillRect(-T*.4,-T*.6,T*.8*Math.max(0,e.hp/e.maxHp),3);ctx.restore();
    }
  }
  window.Enemies={init,update,draw,spawn};Game.register({name:'enemies',init,update,draw});
})();
