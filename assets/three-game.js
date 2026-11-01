import {THREE,createModel,createLandscape,createView,batchStatic} from './art3d.js';
import {createMeteorEffects} from './meteor3d.js';

/** Render existing G state. Simulation remains owned by City/Enemies/etc.
 * Host calls render(G) after simulation update; no second simulation loop is created.
 * onMapClick receives {x,y,entity,event}; host handles placement/movement rules.
 */
export function createGameView({canvas,uiCanvas,onMapClick=()=>{},onError=console.error,onImpact=()=>{}}){
  const view=createView(canvas),{scene,camera,renderer}=view;
  const terrain=batchStatic(createLandscape({decorativeVines:false,clearPlayable:true}));scene.add(terrain);
  const meteorEffects=createMeteorEffects(scene,onImpact);
  const selection=new THREE.Mesh(new THREE.TorusGeometry(1,.018,6,64),new THREE.MeshBasicMaterial({color:'#e6c58f',transparent:true,opacity:.9,depthWrite:false}));selection.rotation.x=Math.PI/2;selection.visible=false;scene.add(selection);
  const ghost=new THREE.Mesh(new THREE.BoxGeometry(1,.12,1),new THREE.MeshBasicMaterial({color:'#91d8ae',transparent:true,opacity:.4,depthWrite:false}));ghost.visible=false;scene.add(ghost);
  let vineMeshes=[],vineCapacity=0;
  const vineTemplate=batchStatic(createModel('sarmasik'));
  const records=new Map(),raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  let current=null,disposed=false,dragStart=null,dragging=false,suppressClick=false;
  function groundAt(sx,sy){mouse.set(sx/canvas.clientWidth*2-1,-sy/canvas.clientHeight*2+1);raycaster.setFromCamera(mouse,camera);const p=new THREE.Vector3();return raycaster.ray.intersectPlane(ground,p)?{x:p.x+(current.map.w||60)/2,y:p.z+(current.map.h||40)/2}:null;}
  function coordinates(e){const r=canvas.getBoundingClientRect();return {sx:(e.clientX-r.left)*(uiCanvas?.width||r.width)/r.width,sy:(e.clientY-r.top)*(uiCanvas?.height||r.height)/r.height};}
  function click(event){if(!current)return;
    if(suppressClick&&event.button===0){suppressClick=false;return;}
    const info=coordinates(event);if(event.button===0&&window.UI?.onClick(current,info))return;
    if(event.button===2&&(current.over||window.UI?.blocksWorld?.(current,info.sx,info.sy)))return;
    const rect=canvas.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);
    const intersections=raycaster.intersectObjects([...records.values()].map(r=>r.model),true);
    let entity=null;if(intersections.length){let object=intersections[0].object;while(object&&!object.userData.entity)object=object.parent;entity=object?.userData.entity||null;}
    // Pick a visible unit using a forgiving screen-space hit area, not tiny triangles.
    let closest=Infinity;
    for(const [unit,record]of records){if(unit.owner!=='player'||!unit.kind||unit.hp<=0)continue;const foot=record.model.position.clone().project(camera),head=record.model.position.clone().add(new THREE.Vector3(0,.7,0)).project(camera);if(foot.z< -1||foot.z>1)continue;const x=(foot.x+1)*canvas.clientWidth/2,y0=(1-head.y)*canvas.clientHeight/2,y1=(1-foot.y)*canvas.clientHeight/2;const dx=Math.abs(info.sx-x),dy=Math.max(Math.min(y0,y1)-info.sy,info.sy-Math.max(y0,y1),0),distance=Math.hypot(dx,dy);if(distance<16&&distance<closest){closest=distance;entity=unit;}}
    if(!raycaster.ray.intersectPlane(ground,hit))return;
    let wx=hit.x+(current.map?.w||current.map?.width||60)/2,wy=hit.z+(current.map?.h||current.map?.height||40)/2;
    if(entity&&!current.ui?.buildMode){wx=entity.x+(entity.size?entity.size/2:0);wy=entity.y+(entity.size?entity.size/2:0);}
    const x=Math.floor(wx),y=Math.floor(wy);
    if(x<0||y<0||x>=(current.map?.w||current.map?.width||60)||y>=(current.map?.h||current.map?.height||40)){if(window.Game?.msg)Game.msg(current,'Görev alanı dışında. Mini haritadan koloni bölgesine dönebilirsiniz.','#d9be92');return;}
    if(event.button===0&&entity&&!current.ui?.buildMode&&!current.ui?.commandMode){current.ui=current.ui||{};const colony=current.colonies?.find(c=>c.members.includes(entity));
      if(entity.kind&&entity.owner==='player'&&(!current.ui.unitFilter||current.ui.unitFilter===entity.kind)){const selection=current.ui.selection||[];current.ui.selection=event.shiftKey?(selection.includes(entity)?selection.filter(u=>u!==entity):[...selection,entity]):[entity];current.ui.selected=current.ui.selection[0]||null;}
      else {current.ui.selection=[];current.ui.selected=colony?{type:'member',member:entity,colony}:entity;}}
    onMapClick(current,{x,y,wx,wy,entity,event,...info});
  }
  function move(event){if(!current)return;const info=coordinates(event);window.UI?.onMouseMove(current,info);const r=canvas.getBoundingClientRect();mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);if(raycaster.ray.intersectPlane(ground,hit)){const wx=hit.x+(current.map.w||60)/2,wy=hit.z+(current.map.h||40)/2;current.ui.mouse={...current.ui.mouse,...info,wx,wy,tx:Math.floor(wx),ty:Math.floor(wy)};}}
  function cancel(event){event.preventDefault();if(!current)return;if(current.ui.buildMode||current.ui.tool||current.ui.commandMode){current.ui.buildMode=null;current.ui.tool=null;current.ui.commandMode=null;return;}click(event);}
  function down(event){if(event.button!==0||!current||current.ui.buildMode||current.over)return;const p=coordinates(event);if(window.UI?.blocksWorld?.(current,p.sx,p.sy))return;dragStart=p;dragging=false;}
  function drag(event){if(!dragStart||!current)return;const p=coordinates(event);dragging=Math.hypot(p.sx-dragStart.sx,p.sy-dragStart.sy)>5;if(dragging)current.ui.drag={active:true,x0:dragStart.sx,y0:dragStart.sy,x1:p.sx,y1:p.sy};}
  function up(event){if(dragging&&current){const p=coordinates(event);
    if(current.ui.commandMode==='harvest'){const a=groundAt(dragStart.sx,dragStart.sy),b=groundAt(p.sx,p.sy);if(a&&b)onMapClick(current,{area:{minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)},event,sx:p.sx,sy:p.sy});}
    else {const x0=Math.min(dragStart.sx,p.sx),x1=Math.max(dragStart.sx,p.sx),y0=Math.min(dragStart.sy,p.sy),y1=Math.max(dragStart.sy,p.sy),selection=[];for(const [entity,record]of records){if(entity.owner!=='player'||!entity.kind||entity.kind==='yumurta'||current.ui.unitFilter&&current.ui.unitFilter!==entity.kind)continue;const projected=record.model.position.clone().project(camera),x=(projected.x+1)*canvas.clientWidth/2,y=(1-projected.y)*canvas.clientHeight/2;if(projected.z>=-1&&projected.z<=1&&x>=x0&&x<=x1&&y>=y0&&y<=y1)selection.push(entity);}current.ui.selection=event.shiftKey?[...new Set([...(current.ui.selection||[]),...selection])]:selection;current.ui.selected=current.ui.selection[0]||null;}suppressClick=true;}if(current)current.ui.drag=null;dragStart=null;dragging=false;}
  canvas.addEventListener('click',click);canvas.addEventListener('pointermove',move);canvas.addEventListener('contextmenu',cancel);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',drag);window.addEventListener('pointerup',up);
  const alias={kule:'cekimKulesi',ocak:'tasOcagi',lab:'laboratuvar',tasiyici:'koloni',savasci:'koloni',toplayici:'koloni',muhafiz:'koloni',member:'koloni',queen:'kralice',worker:'isci',soldier:'asker',scientist:'bilimci'};
  function remove(record){scene.remove(record.model);const geometries=new Set();record.model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geo of geometries)geo.dispose();}
  return {
    ...view,
    render(G){if(disposed)return;current=G;const seen=new Set();
      const width=G.map?.w||G.map?.width||60,height=G.map?.h||G.map?.height||40;
      const lists=[[G.visitors?.buildings,null],[G.visitors?.units,null],[G.deposits,null],[G.buildings,null],[G.units,null],[G.enemies,'akinci'],[G.crystals,'kristal'],[(G.colonies||[]).flatMap(c=>c.members),null]];
      for(const [list,defaultType] of lists)for(const entity of list||[]){
        if(entity.dead||entity.hp<=0||entity.state==='chipped'||!Number.isFinite(entity.x)||!Number.isFinite(entity.y)||(defaultType==='kristal'&&((entity.oz??entity.amount)<=0||entity.carriedBy!=null)))continue;
        const source=entity.kind||entity.role||entity.type,kind=alias[source]||defaultType||source;seen.add(entity);let record=records.get(entity);
        if(record&&(record.kind!==kind||record.gender!==entity.gender)){remove(record);records.delete(entity);record=null;}
        if(!record){const raw=createModel(kind,entity.gender),limbs=raw.userData.limbs||[];for(const l of limbs)raw.remove(l.node);const model=batchStatic(raw);for(const l of limbs){batchStatic(l.node);model.add(l.node);}model.userData.limbs=limbs;model.userData.entity=entity;record={model,kind,gender:entity.gender,lastX:entity.x,lastY:entity.y};records.set(entity,record);scene.add(model);}
        const model=record.model,offset=entity.size?entity.size/2:0;model.position.set(entity.x-width/2+offset,0,entity.y-height/2+offset);
        if(entity.type==='merkez'&&entity.flag&&!record.flag){const flag=new THREE.Group(),pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,3,6),new THREE.MeshStandardMaterial({color:'#aeb3b5'})),cloth=new THREE.Mesh(new THREE.PlaneGeometry(.85,.5),new THREE.MeshStandardMaterial({color:entity.flag,side:THREE.DoubleSide}));pole.position.set(1.3,1.5,0);cloth.position.set(1.7,2.6,0);flag.add(pole,cloth);model.add(flag);record.flag=flag;}
        if(record.flag)record.flag.children[1].material.color.set(entity.flag);
        if(entity.size){if(!record.fit){const bounds=new THREE.Box3().setFromObject(model),v=bounds.getSize(new THREE.Vector3());record.fit={xz:entity.size*.9/Math.max(v.x,v.z,.1),y:Math.max(entity.size===1?1.35:2.1,v.y*entity.size*.9/Math.max(v.x,v.z,.1))/Math.max(v.y,.1)};}model.scale.set(record.fit.xz,record.fit.y,record.fit.xz);}
        else model.scale.setScalar(['isci','asker','bilimci','akinci'].includes(kind)?.42:.6);
        const dx=entity.x-record.lastX,dy=entity.y-record.lastY;
        if(Math.hypot(dx,dy)>.001&&!entity.size)model.rotation.y=Math.atan2(dx,dy);else if(Number.isFinite(entity.rotation??entity.dir))model.rotation.y=entity.rotation??entity.dir;
        record.lastX=entity.x;record.lastY=entity.y;
        const moving=Math.hypot(dx,dy)>.001,working=['mine','build','repair','prune','upgrade'].includes(entity.state),phase=G.time*(working?12:8);
        for(const l of model.userData.limbs||[])l.node.rotation.x=(moving||working?Math.sin(phase+l.phase)* (l.leg?.45:.3):0);
        if(entity.healingUntil>G.time)model.position.y+=.025*Math.sin(G.time*8);

        if(entity.state==='fainted')model.rotation.z=Math.PI/2;else model.rotation.z=0;
        if(entity.built===false)model.scale.y*=.15+.85*Math.min(1,(entity.progress||0)/(G.cfg.buildings[entity.type].buildTime||1));
        if(entity.carrying&&!record.cargo){record.cargo=batchStatic(createModel('kristal'));record.cargo.scale.setScalar(.35);record.cargo.position.set(0,1.2,-.55);model.add(record.cargo);}
        if(record.cargo)record.cargo.visible=!!entity.carrying;
      }
      for(const [entity,record]of records)if(!seen.has(entity)){remove(record);records.delete(entity);}
      const selected=G.ui?.selected?.member||G.ui?.selected,selectedRecord=records.get(selected);selection.visible=!!selectedRecord;
      if(selectedRecord){selection.position.copy(selectedRecord.model.position);selection.position.y=.03;selection.scale.setScalar(selected.size?selected.size*.7:.55);}
      ghost.visible=!!G.ui?.buildMode&&!!window.City?.placeAt;
      if(ghost.visible){const type=G.ui.buildMode,p=City.placeAt(G,type),size=G.cfg.buildings[type].size,valid=City.canPlace(G,type,p.x,p.y).ok;ghost.position.set(p.x-width/2+size/2,.02,p.y-height/2+size/2);ghost.scale.set(size,1,size);ghost.material.color.set(valid?'#85d4a0':'#ed7167');}
      if(G.map?.vine){
        const capacity=width*height;
        if(vineCapacity!==capacity){for(const mesh of vineMeshes){scene.remove(mesh);mesh.dispose();}vineMeshes=[];vineCapacity=capacity;for(const template of vineTemplate.children){if(!template.isMesh)continue;const instance=new THREE.InstancedMesh(template.geometry,template.material,capacity);instance.receiveShadow=true;instance.castShadow=true;instance.frustumCulled=false;scene.add(instance);vineMeshes.push(instance);}}
        const dummy=new THREE.Object3D();let count=0;for(let i=0;i<capacity;i++)if(G.map.vine[i]){dummy.position.set(i%width-width/2+.5,0,Math.floor(i/width)-height/2+.5);dummy.scale.setScalar(.45);dummy.rotation.y=i*2.4;dummy.updateMatrix();for(const mesh of vineMeshes)mesh.setMatrixAt(count,dummy.matrix);count++;}for(const mesh of vineMeshes){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
      }
      if(G.cfg?.meteors&&G.meteors)meteorEffects.update(G);
      renderer.render(scene,camera);
      if(G.ui&&G.map?.w){const footprint=[];for(const [sx,sy]of [[0,80],[canvas.clientWidth,80],[canvas.clientWidth,canvas.clientHeight-90],[0,canvas.clientHeight-90]]){const p=groundAt(sx,sy);if(p)footprint.push(p);}G.ui.cameraFootprint=footprint;}
      if(uiCanvas&&window.UI){const w=canvas.clientWidth,h=canvas.clientHeight;if(uiCanvas.width!==w||uiCanvas.height!==h){uiCanvas.width=w;uiCanvas.height=h;}const ctx=uiCanvas.getContext('2d');ctx.clearRect(0,0,w,h);
        for(const [entity,record]of records){if(!(entity.maxHp>0)||entity.hp>=entity.maxHp&&entity!==selected)continue;const p=record.model.position.clone();p.y+=entity.size?entity.size*1.1:1.1;p.project(camera);if(p.z>1||p.z< -1)continue;const x=(p.x+1)*w/2,y=(1-p.y)*h/2;ctx.fillStyle='#251f28';ctx.fillRect(x-19,y,38,4);ctx.fillStyle='#b9d6a0';ctx.fillRect(x-19,y,38*Math.max(0,Math.min(1,entity.hp/entity.maxHp)),4);}
        const d=G.ui?.drag;if(d?.active){ctx.fillStyle='#9bdbab22';ctx.strokeStyle='#b8dbab';ctx.fillRect(d.x0,d.y0,d.x1-d.x0,d.y1-d.y0);ctx.strokeRect(d.x0,d.y0,d.x1-d.x0,d.y1-d.y0);}
        if((G.ui?.selection||[]).length>1)for(const unit of G.ui.selection){const record=records.get(unit);if(!record)continue;const p=record.model.position.clone().project(camera);if(p.z< -1||p.z>1)continue;ctx.strokeStyle='#b5e4ad';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse((p.x+1)*w/2,(1-p.y)*h/2,14,7,0,0,Math.PI*2);ctx.stroke();}
        for(const [e,r]of records){
          const p=r.model.position.clone().add(new THREE.Vector3(0,.55,0)).project(camera);if(p.z< -1||p.z>1)continue;const x=(p.x+1)*w/2,y=(1-p.y)*h/2,t=G.time;
          if(['mine','build','repair','prune','upgrade'].includes(e.state)){ctx.fillStyle=e.state==='mine'?'#b7b0a0':'#ffd78c';for(let i=0;i<5;i++){const k=(t*2+i*.19)%1;ctx.fillRect(x+Math.sin(i*4)*k*18,y-k*22,2,2);}}
          const target=e.firingAt&&(!e.firingAt.until||e.firingAt.until>t)?e.firingAt:null;
          if(target&&Math.sin(t*28)>0){const q=new THREE.Vector3(target.x-width/2,.45,target.y-height/2).project(camera);ctx.strokeStyle='#ffd582';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo((q.x+1)*w/2,(1-q.y)*h/2);ctx.stroke();ctx.fillStyle='#fff0b3';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
          if((['attack','fight','hunt'].includes(e.state)||e.hitT>.15)&&!e.kind){ctx.strokeStyle='#ee8c6d';ctx.beginPath();ctx.arc(x,y,8+Math.sin(t*20)*3,0,Math.PI*1.4);ctx.stroke();}
          if(e.healingUntil>t){ctx.fillStyle='#81f7bb';ctx.fillRect(x-2,y-10,4,13);ctx.fillRect(x-6,y-6,12,4);}
        }
        try{UI.drawUI(ctx,G);}catch(error){onError(error);}}
    },
    dispose(){disposed=true;canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('contextmenu',cancel);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',drag);window.removeEventListener('pointerup',up);meteorEffects.dispose();selection.geometry.dispose();selection.material.dispose();ghost.geometry.dispose();ghost.material.dispose();for(const record of records.values())remove(record);records.clear();const geometries=new Set();terrain.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});for(const mesh of vineMeshes){mesh.dispose();scene.remove(mesh);}vineTemplate.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geo of geometries)geo.dispose();view.dispose();},
    get modelCount(){return records.size;}
    ,get warningCount(){return meteorEffects.warningCount;},get impactCount(){return meteorEffects.impactCount;}
  };
}
