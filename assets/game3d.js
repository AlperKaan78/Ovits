import {THREE} from './art3d.js';
import {createGameView} from './three-game.js';
const failed=new Set();
function fail(name,error){if(failed.has(name))return;failed.add(name);console.error(name,error);const el=document.querySelector('#error');el.style.display='block';el.textContent=name+': '+error.message;}
try{
  const G=Game.G=Game.newState();for(const module of Game.modules)module.init?.(G);
  Game.msg(G,'3B görsel katmanı açıldı. Ekip modülleri ortak sözleşmeyle yükleniyor.','#d2bddc');
  const view=createGameView({canvas:document.querySelector('#world'),uiCanvas:document.querySelector('#hud'),onError:e=>fail('UI',e),
    onMapClick(G,info){const event={sx:info.sx,sy:info.sy,wx:info.wx,wy:info.wy,tx:info.x,ty:info.y,button:info.event.button};G.ui.mouse={...event};if(info.entity&&!G.ui.buildMode)return;for(const mod of Game.modules.slice().reverse()){if(mod.name!=='ui'&&mod.onClick?.(G,event))return;}G.ui.selected=null;}
  });
  window.game3d={G,view};
  const center=Game.center(Game.merkez(G)),target=new THREE.Vector3(center.x-G.map.w/2,0,center.y-G.map.h/2),keys=new Set();let distance=17,last=performance.now();
  window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;keys.add(e.key.toLowerCase());if([' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(e.repeat||G.over)return;if(e.key===' ')G.paused=!G.paused;if(e.key==='1'||e.key==='2')G.speed=Number(e.key);if(e.key==='Escape'){G.ui.selected=null;G.ui.buildMode=null;}for(const module of Game.modules)module.onKey?.(G,e.key);});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
  document.querySelector('#world').addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),7,65);},{passive:false});
  function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;
    if(!G.paused&&!G.over){const step=dt*G.speed;G.time+=step;for(const mod of Game.modules){try{mod.update?.(G,step);}catch(e){fail(mod.name,e);}}
      G.buildings=G.buildings.filter(b=>b.hp>0||b.type==='merkez');G.units=G.units.filter(u=>u.hp>0);G.enemies=G.enemies.filter(e=>e.hp>0);
      const mk=Game.merkez(G);if(!mk)G.over='lose';else if(G.res.oz>=G.cfg.win.oz)G.over='win';
    }
    if(keys.has('a')||keys.has('arrowleft'))target.x-=dt*10;if(keys.has('d')||keys.has('arrowright'))target.x+=dt*10;if(keys.has('w')||keys.has('arrowup'))target.z-=dt*10;if(keys.has('s')||keys.has('arrowdown'))target.z+=dt*10;
    target.x=THREE.MathUtils.clamp(target.x,-G.map.w/2,G.map.w/2);target.z=THREE.MathUtils.clamp(target.z,-G.map.h/2,G.map.h/2);
    view.camera.position.copy(target).add(new THREE.Vector3(distance*.5,distance*.8,distance*.8));view.camera.lookAt(target);view.render(G);requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
}catch(e){fail('Three.js',e);}
