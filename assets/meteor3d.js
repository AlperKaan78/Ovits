import {THREE,createModel,batchStatic} from './art3d.js';

// Visual only. Positions/timing/damage always come from Meteors and CONFIG.
export function createMeteorEffects(scene,onImpact=()=>{}){
  const active=new Map(),impacts=[],craters=[];
  const ringGeometry=new THREE.TorusGeometry(1,.014,6,96);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),gradient=c.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'#fff');gradient.addColorStop(.35,'#ffffff88');gradient.addColorStop(1,'#ffffff00');c.fillStyle=gradient;c.fillRect(0,0,128,128);const glowTexture=new THREE.CanvasTexture(canvas);
  function material(color,opacity=.8){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});}
  function ring(parent,color){const m=new THREE.Mesh(ringGeometry,material(color));m.rotation.x=Math.PI/2;parent.add(m);return m;}
  function disposeGroup(group){scene.remove(group);const geos=new Set(),mats=new Set();group.traverse(o=>{if(o.geometry&&o.geometry!==ringGeometry)geos.add(o.geometry);if(o.material&&!o.userData.sharedMaterial)mats.add(o.material);});for(const geo of geos)geo.dispose();for(const mat of mats)mat.dispose();}
  function spawn(me){const group=new THREE.Group();scene.add(group);const rings=[ring(group,'#84e1bf'),ring(group,'#ba8be9'),ring(group,'#84e1bf')];
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:glowTexture,color:'#83dbbc',transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));glow.rotation.x=-Math.PI/2;group.add(glow);
    const rock=batchStatic(createModel('meteor'));rock.traverse(o=>{if(o.material)o.userData.sharedMaterial=true;});group.add(rock);
    return {group,rings,glow,rock,lastT:me.t,x:me.x,y:me.y};
  }
  return {
    update(G){const now=G.time||0,w=G.map.w,h=G.map.h,mc=G.cfg.meteors,seen=new Set();
      for(const me of G.meteors){seen.add(me);let fx=active.get(me);if(!fx){fx=spawn(me);active.set(me,fx);}
        const p=window.Meteors?.displayPos?Meteors.displayPos(G,me):me;fx.group.position.set(p.x-w/2,.025,p.y-h/2);fx.lastT=me.t;
        const focused=me.t<=mc.focusTime,q=focused?1-me.t/mc.focusTime:0,damageRadius=mc.types[me.type].radius,radius=focused?THREE.MathUtils.lerp(mc.auroraRadius*.6,damageRadius,q):mc.auroraRadius;
        fx.rings.forEach((ring,i)=>{ring.scale.setScalar(radius*(1-i*.17)*(1+Math.sin(now*3+i)*.025));ring.position.y=.02+i*.012;ring.material.color.set(focused?'#ffb64d':i%2?'#ac73df':'#79e1b1');ring.material.opacity=.65-i*.12;});
        fx.glow.scale.setScalar(radius);fx.glow.material.color.set(focused?'#ffac4e':'#85cbb4');fx.glow.material.opacity=focused?.42:.24;
        fx.rock.visible=me.t<=.8;fx.rock.position.set(-me.t*2,me.t*19,0);fx.rock.scale.setScalar(me.type==='dev'?.9:.5);
      }
      for(const [me,fx]of active)if(!seen.has(me)){if(fx.lastT<1){onImpact(me);const group=new THREE.Group(),shock=ring(group,'#ffc586');group.position.set(me.x-w/2,.04,me.y-h/2);scene.add(group);impacts.push({group,shock,start:now,r:mc.types[me.type].radius});const crater=new THREE.Mesh(new THREE.CircleGeometry(mc.types[me.type].radius*.8,32),new THREE.MeshStandardMaterial({color:'#3d3135',roughness:1,transparent:true,opacity:.5,depthWrite:false}));crater.rotation.x=-Math.PI/2;crater.position.set(me.x-w/2,-.08,me.y-h/2);scene.add(crater);craters.push({mesh:crater,start:now});}disposeGroup(fx.group);active.delete(me);}
      for(let i=impacts.length-1;i>=0;i--){const f=impacts[i],age=now-f.start;f.shock.scale.setScalar(f.r*(.2+age*2));f.shock.material.opacity=Math.max(0,1-age);if(age>=1){disposeGroup(f.group);impacts.splice(i,1);}}
      for(let i=craters.length-1;i>=0;i--){const f=craters[i],age=now-f.start;f.mesh.material.opacity=.5*Math.max(0,1-age/90);if(age>90){scene.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();craters.splice(i,1);}}
    },
    get warningCount(){return active.size;},get impactCount(){return impacts.length;},
    dispose(){for(const f of active.values())disposeGroup(f.group);for(const f of impacts)disposeGroup(f.group);for(const f of craters){scene.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();}active.clear();impacts.length=craters.length=0;ringGeometry.dispose();glowTexture.dispose();}
  };
}
