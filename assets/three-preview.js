import {THREE,createModel,createLandscape,createView,batchStatic} from './art3d.js';
const canvas=document.querySelector('canvas');
try {
  const view=createView(canvas),{scene,camera,renderer}=view;
  scene.add(batchStatic(createLandscape()));
  const settlement=new THREE.Group();scene.add(settlement);
  function place(type,x,z,scale=1,rotation=0){const o=createModel(type);o.position.set(x,0,z);o.scale.multiplyScalar(scale);o.rotation.y=rotation;settlement.add(o);return o;}
  place('merkez',-4,-2,1.35);place('ev',-8,3);place('ev',-3,5,.9);place('laboratuvar',1,-4,1.1);place('karakol',4,5,.85);place('cekimKulesi',8,-1,1.4);place('taret',8,6,.7);place('tasOcagi',-10,-4,1.1);
  place('isci',-3,2,1.1,.3);place('isci',-7,5,1.1,-.6);place('asker',2,5,1.1,.5);place('bilimci',1,-1,1.1,-.5);place('meteor',11,-7,1.3);place('kristal',9,-6,.8);place('koloni',12,6,1.1,-1.1);place('kralice',15,-8,.9,-.6);
  // Modest path lights and irregular slabs make the settlement sit in its terrain.
  const pathMat=new THREE.MeshStandardMaterial({color:'#92887a',roughness:1});
  for(let i=0;i<26;i++){const slab=new THREE.Mesh(new THREE.BoxGeometry(.6,.06,.48),pathMat);slab.position.set(-4+Math.sin(i*.4)*.25,.005,-.2+i*.21);slab.rotation.y=Math.sin(i*7)*.15;slab.receiveShadow=true;settlement.add(slab);}
  batchStatic(settlement);
  const display=new THREE.Group();scene.add(display);display.visible=false;
  let active=null,mode='scene',angle=.66,elevation=.62,distance=39,automatic=false,drag=null;
  const target=new THREE.Vector3(0,1.0,0),desired=new THREE.Vector3(0,1,0);
  function reset(){angle=mode==='scene'?.66:.5;elevation=mode==='scene'?.62:.28;distance=mode==='scene'?39:(['isci','asker','bilimci','akinci','yavru','yumurta'].includes(mode)?5.5:mode==='kralice'?10:8);}
  const labels={isci:'Usul usul büyüyen bir koloni.',asker:'İkmal hattının nöbetçisi.',bilimci:'Gökten gelenin izinde.',kralice:'Ormanın derinindeki irade.'};
  document.querySelector('select').onchange=e=>{
    mode=e.target.value;settlement.visible=mode==='scene';display.visible=mode!=='scene';
    if(active){display.remove(active);active.traverse(o=>{if(o.geometry)o.geometry.dispose();});active=null;}
    if(mode!=='scene'){active=createModel(mode);display.add(active);desired.set(0,['isci','asker','bilimci','akinci','yavru'].includes(mode)?1:1.4,0);}else desired.set(0,1,0);
    document.querySelector('#title').textContent=mode==='scene'?'İlk ışık, yeni dünya.':e.target.selectedOptions[0].text;
    document.querySelector('#description').textContent=labels[mode]||'Özgün model, fiziksel malzeme ve gerçek zamanlı gölge. Sürükleyerek her açıdan inceleyin.';reset();
  };
  document.querySelector('#reset').onclick=reset;document.querySelector('#rotate').onclick=e=>{automatic=!automatic;e.target.textContent=automatic?'Dönüşü durdur':'Otomatik dön';};
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(drag){angle-=(e.clientX-drag.x)*.006;elevation=THREE.MathUtils.clamp(elevation+(e.clientY-drag.y)*.005,.08,1.35);drag={x:e.clientX,y:e.clientY};}});
  canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),2.5,65);},{passive:false});
  const clock=new THREE.Clock();let frames=0;
  function frame(){const dt=Math.min(.05,clock.getDelta());if(automatic)angle+=dt*.15;target.lerp(desired,.12);camera.position.set(target.x+Math.sin(angle)*Math.cos(elevation)*distance,target.y+Math.sin(elevation)*distance,target.z+Math.cos(angle)*Math.cos(elevation)*distance);camera.lookAt(target);renderer.render(scene,camera);frames++;window.art3dState={ready:true,frames,mode,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,revision:THREE.REVISION};requestAnimationFrame(frame);}frame();
}catch(error){document.querySelector('#error').style.display='block';document.querySelector('#error').textContent='3B sahne açılamadı. WebGL destekleyen güncel tarayıcıyla yerel sunucudan açın. '+error.message;throw error;}
