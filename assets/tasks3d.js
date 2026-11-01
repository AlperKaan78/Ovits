// Bridges the 3D controls to the shared City API. No second movement/combat simulation.
export function createTasks(G){
  const jobs=new Map();
  function selected(){return (G.ui.selection||[]).filter(u=>u.owner==='player'&&u.hp>0&&!['yumurta','yavru'].includes(u.kind));}
  function harvest(bounds,units=selected()){
    const workers=units.filter(u=>u.kind==='isci'||u.kind==='tasiyici');
    if(!workers.length){Game.msg(G,'Sarmaşık biçmek için önce bir işçi seçin.','#e9b07d');return false;}
    const area={minX:Math.max(0,Math.floor(Math.min(bounds.minX,bounds.maxX))),maxX:Math.min(G.map.w-1,Math.floor(Math.max(bounds.minX,bounds.maxX))),minY:Math.max(0,Math.floor(Math.min(bounds.minY,bounds.maxY))),maxY:Math.min(G.map.h-1,Math.floor(Math.max(bounds.minY,bounds.maxY)))};
    const cells=[];for(let y=area.minY;y<=area.maxY;y++)for(let x=area.minX;x<=area.maxX;x++)if(Vines.has(G,x,y)&&!Vines.isRoot(G,x,y))cells.push({x,y});
    if(!cells.length){Game.msg(G,'Seçilen alanda biçilebilir sarmaşık yok. Kökler için Kök Zehri gerekir.','#e9b07d');return false;}
    for(const worker of workers){if(worker.chip)continue;worker.order=null;worker.huntTarget=null;jobs.set(worker,{area,blocked:false});}
    Game.msg(G,workers.length+' işçi: '+cells.length+' sarmaşık karesi biçilecek ve toplanacak.','#9bd3bd');
    G.ui.commandMode=null;update();return true;
  }
  function update(){
    const claimed=new Set();for(const u of G.units)if(u.order?.type==='prune')claimed.add(u.order.ty*G.map.w+u.order.tx);
    for(const [worker,job]of jobs){
      if(worker.hp<=0||!G.units.includes(worker)){jobs.delete(worker);continue;}
      const o=worker.order,a=job.area;
      if(o&&o.type!=='prune'){jobs.delete(worker);continue;}
      if(o&&o.tx>=a.minX&&o.tx<=a.maxX&&o.ty>=a.minY&&o.ty<=a.maxY&&Vines.has(G,o.tx,o.ty))continue;
      if(o)worker.order=null;
      if(!Game.canAfford(G,G.cfg.vines.pruneCost)){if(!job.blocked)Game.msg(G,'Hasat bekliyor: '+Game.costText(G.cfg.vines.pruneCost)+' / kare gerekli.','#e9b07d');job.blocked=true;continue;}job.blocked=false;
      let best=null,dist=Infinity,remaining=false;
      for(let y=a.minY;y<=a.maxY;y++)for(let x=a.minX;x<=a.maxX;x++){if(!Vines.has(G,x,y)||Vines.isRoot(G,x,y))continue;remaining=true;const key=y*G.map.w+x;if(claimed.has(key))continue;const d=Game.dist(worker.x,worker.y,x+.5,y+.5);if(d<dist){dist=d;best={x,y,key};}}
      if(best){claimed.add(best.key);worker.order={type:'prune',tx:best.x,ty:best.y,ox:best.x,oy:best.y};}
      else if(!remaining){jobs.delete(worker);Game.msg(G,'Seçilen sarmaşık alanının hasadı tamamlandı.','#9bd3bd');}
    }
  }
  function command(info){
    const units=selected();if(!units.length){Game.msg(G,'Önce soldaki listeden veya haritadan bir birim seçin.','#e9b07d');return false;}
    for(const u of units)jobs.delete(u);
    if(G.ui.commandMode==='move'){
      units.forEach((u,i)=>{if(u.chip)return;u.post=null;u.huntTarget=null;u.order={type:'move',x:Math.max(.5,Math.min(G.map.w-.5,info.wx+(i%3)*.35)),y:Math.max(.5,Math.min(G.map.h-.5,info.wy+Math.floor(i/3)*.35))};});
      Game.msg(G,units.length+' birim seçilen noktaya yürüyor.','#b9d7e6');G.ui.commandMode=null;return true;
    }
    const building=Game.buildingAt(G,info.tx,info.ty),scientists=units.filter(u=>u.kind==='bilimci');
    if(building?.type==='lab'&&scientists.length&&City.isBuilt(building)){const others=units.filter(u=>u.kind!=='bilimci');if(others.length)City.command(G,others,{...info,button:2});for(const scientist of scientists){scientist.chip=null;scientist.order={type:'lab'};scientist.anchor=null;}G.ui.commandMode=null;Game.msg(G,scientists.length+' bilimci laboratuvara araştırmaya gidiyor.','#b9d7e6');return true;}
    const ok=City.command(G,units,{...info,button:2});G.ui.commandMode=null;if(ok)Game.msg(G,units.length+' birime görev verildi.','#b9d7e6');return ok;
  }
  // Scope the documented harvest resources to worker cuts in this 3D session.
  const prune=Vines.prune;
  function collect(state,x,y,options){const ok=prune(state,x,y,options);if(ok&&state===G&&options?.worker){const yieldRes=G.cfg.vines.harvestYield;Game.gain(G,yieldRes);G.stats=G.stats||{};G.stats.harvestedVines=(G.stats.harvestedVines||0)+1;Game.msg(G,'Sarmaşık toplandı: +'+yieldRes.lif+' Mor Lif, +'+yieldRes.ozsu+' Azur Özsu.','#8acdd2');}return ok;}
  Vines.prune=collect;G.res.lif=G.res.lif||0;G.res.ozsu=G.res.ozsu||0;
  return {harvest,command,update,release(units){for(const u of units)jobs.delete(u);},get jobCount(){return jobs.size;},dispose(){jobs.clear();if(Vines.prune===collect)Vines.prune=prune;}};
}
