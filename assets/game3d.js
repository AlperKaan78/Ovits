import {THREE} from './art3d.js';
import {createGameView} from './three-game.js';
import {createTasks} from './tasks3d.js';
import {createAudio} from './audio3d.js';
import {connectLan} from './lan-client.js';
const failed=new Set();
function fail(name,error){if(failed.has(name))return;failed.add(name);console.error(name,error);const el=document.querySelector('#error');el.style.display='block';el.textContent=name+': '+error.message;}
try{
  const G=Game.G=Game.newState();for(const module of Game.modules)module.init?.(G);
  Civilization.ensure(G);
  const network=await connectLan(G);
  if(!network)Civilization.setFlag(G,'#c9773a');
  const tasks=createTasks(G),audio=createAudio();G.ui.cancelTasks=units=>tasks.release(units);G.ui.toggleSound=async(enableOnly=false)=>{await audio.unlock();if(!enableOnly||audio.muted)audio.toggle();G.ui.soundMuted=audio.muted;};G.ui.soundMuted=false;
  window.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});window.addEventListener('keydown',()=>audio.unlock(),{passive:true});
  Game.msg(G,'3B görsel katmanı açıldı. Ekip modülleri ortak sözleşmeyle yükleniyor.','#d2bddc');
  const view=createGameView({canvas:document.querySelector('#world'),uiCanvas:document.querySelector('#hud'),onError:e=>fail('UI',e),onImpact:me=>audio.impact(me.type==='dev',Math.hypot(me.x-G.map.w/2-target.x,me.y-G.map.h/2-target.z)),
    onMapClick(G,info){
      if(info.area){tasks.harvest(info.area);return;}
      const event={sx:info.sx,sy:info.sy,wx:info.wx,wy:info.wy,tx:info.x,ty:info.y,button:info.event.button,shift:info.event.shiftKey};G.ui.mouse={...event};
      if(G.ui.commandMode==='harvest'){const radius=G.cfg.vines.workerPruneArea;tasks.harvest({minX:info.x-radius,maxX:info.x+radius,minY:info.y-radius,maxY:info.y+radius});return;}
      if(G.ui.commandMode||event.button===2){tasks.command(event);return;}
      if(info.entity&&!G.ui.buildMode&&event.button===0)return;
      for(const mod of Game.modules.slice().reverse()){if(mod.name!=='ui'&&mod.onClick?.(G,event))return;}if(event.button===0){G.ui.selected=null;G.ui.selection=[];}}
  });
  network?.bind(tasks);
  window.game3d={G,view,tasks,audio,network};
  const center=Game.center(Game.merkez(G)),target=new THREE.Vector3(center.x-G.map.w/2,0,center.y-G.map.h/2),keys=new Set();let distance=23,last=performance.now();
  Game.centerOn=(state,x,y)=>target.set(x-state.map.w/2,0,y-state.map.h/2);Game.viewSize=()=>({w:innerWidth,h:innerHeight});
  window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;keys.add(e.key.toLowerCase());if([' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(e.repeat||G.over)return;if(e.key===' ')G.paused=!G.paused;if(['1','2','3'].includes(e.key))G.speed=Number(e.key);if(e.key==='Escape'){G.ui.selected=null;G.ui.selection=[];G.ui.buildMode=null;G.ui.tool=null;G.ui.commandMode=null;}for(const module of Game.modules)module.onKey?.(G,e.key);});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
  document.querySelector('#world').addEventListener('wheel',e=>{e.preventDefault();if(e.clientX>innerWidth-Math.min(290,innerWidth*.36)-12&&e.clientY>90&&G.ui.selected){G.ui.panelScroll=Math.max(0,Math.min(500,(G.ui.panelScroll||0)+Math.sign(e.deltaY)*50));return;}distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),7,100);},{passive:false});
  function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;
    network?.apply();
    document.querySelector('#notice').hidden=!!G.ui.commandMode;
    G.ui.soundReady=audio.ready;
    if(!network&&!G.paused&&!G.over){const step=dt*G.speed;G.time+=step;for(const mod of Game.modules){try{mod.update?.(G,step);}catch(e){fail(mod.name,e);}}
      tasks.update();G.buildings=G.buildings.filter(b=>b.hp>0||b.type==='merkez');G.units=G.units.filter(u=>u.hp>0);G.enemies=G.enemies.filter(e=>e.hp>0);
      const mk=Game.merkez(G);if(!mk)G.over='lose';else if(G.res.oz>=G.cfg.win.oz)G.over='win';
    }
    if(keys.has('a')||keys.has('arrowleft'))target.x-=dt*10;if(keys.has('d')||keys.has('arrowright'))target.x+=dt*10;if(keys.has('w')||keys.has('arrowup'))target.z-=dt*10;if(keys.has('s')||keys.has('arrowdown'))target.z+=dt*10;
    target.x=THREE.MathUtils.clamp(target.x,-G.map.w/2-15,G.map.w/2+15);target.z=THREE.MathUtils.clamp(target.z,-G.map.h/2-15,G.map.h/2+15);
    view.camera.position.copy(target).add(new THREE.Vector3(distance*.5,distance*.8,distance*.8));view.camera.lookAt(target);view.render(G);requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
}catch(e){fail('Three.js',e);}
