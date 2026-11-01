import {THREE,createModel,createLandscape,createView,batchStatic} from './art3d.js';

/** Render existing G state. Simulation remains owned by City/Enemies/etc.
 * Host calls render(G) after simulation update; no second simulation loop is created.
 * onMapClick receives {x,y,entity,event}; host handles placement/movement rules.
 */
export function createGameView({canvas,uiCanvas,onMapClick=()=>{},onError=console.error}){
  const view=createView(canvas),{scene,camera,renderer}=view;
  const terrain=batchStatic(createLandscape({decorativeVines:false}));scene.add(terrain);
  let vineMeshes=[],vineCapacity=0;
  const vineTemplate=batchStatic(createModel('sarmasik'));
  const records=new Map(),raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  let current=null,disposed=false;
  function coordinates(e){const r=canvas.getBoundingClientRect();return {sx:(e.clientX-r.left)*(uiCanvas?.width||r.width)/r.width,sy:(e.clientY-r.top)*(uiCanvas?.height||r.height)/r.height};}
  function click(event){if(!current)return;
    const info=coordinates(event);if(window.UI?.onClick(current,info))return;
    const rect=canvas.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);
    const intersections=raycaster.intersectObjects([...records.values()].map(r=>r.model),true);
    let entity=null;if(intersections.length){let object=intersections[0].object;while(object&&!object.userData.entity)object=object.parent;entity=object?.userData.entity||null;}
    if(!raycaster.ray.intersectPlane(ground,hit))return;
    const wx=hit.x+(current.map?.w||current.map?.width||60)/2,wy=hit.z+(current.map?.h||current.map?.height||40)/2,x=Math.floor(wx),y=Math.floor(wy);
    if(x<0||y<0||x>=(current.map?.w||current.map?.width||60)||y>=(current.map?.h||current.map?.height||40))return;
    if(entity&&!current.ui?.buildMode){current.ui=current.ui||{};const colony=current.colonies?.find(c=>c.members.includes(entity));current.ui.selected=colony?{type:'member',member:entity,colony}:entity;}
    onMapClick(current,{x,y,wx,wy,entity,event,...info});
  }
  function move(event){if(current)window.UI?.onMouseMove(current,coordinates(event));}
  canvas.addEventListener('click',click);canvas.addEventListener('pointermove',move);
  const alias={kule:'cekimKulesi',ocak:'tasOcagi',lab:'laboratuvar',tasiyici:'koloni',savasci:'koloni',toplayici:'koloni',muhafiz:'koloni',member:'koloni',queen:'kralice',worker:'isci',soldier:'asker',scientist:'bilimci'};
  function remove(record){scene.remove(record.model);const geometries=new Set();record.model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geo of geometries)geo.dispose();}
  return {
    ...view,
    render(G){if(disposed)return;current=G;const seen=new Set();
      const width=G.map?.w||G.map?.width||60,height=G.map?.h||G.map?.height||40;
      const lists=[[G.buildings,null],[G.units,null],[G.enemies,'akinci'],[G.crystals,'kristal'],[(G.colonies||[]).flatMap(c=>c.members),null]];
      for(const [list,defaultType] of lists)for(const entity of list||[]){
        if(entity.dead||entity.hp<=0||entity.state==='chipped'||!Number.isFinite(entity.x)||!Number.isFinite(entity.y)||(defaultType==='kristal'&&((entity.oz??entity.amount)<=0||entity.carriedBy!=null)))continue;
        const source=entity.kind||entity.role||entity.type,kind=alias[source]||defaultType||source;seen.add(entity);let record=records.get(entity);
        if(record&&record.kind!==kind){remove(record);records.delete(entity);record=null;}
        if(!record){const model=batchStatic(createModel(kind));model.userData.entity=entity;record={model,kind};records.set(entity,record);scene.add(model);}
        const model=record.model,offset=entity.size?entity.size/2:0;model.position.set(entity.x-width/2+offset,0,entity.y-height/2+offset);
        model.scale.setScalar(['isci','asker','bilimci','akinci'].includes(kind)?.4:['merkez','ev','laboratuvar','karakol'].includes(kind)?(entity.size||1)*.3:.6);
        if(Number.isFinite(entity.rotation||entity.dir))model.rotation.y=entity.rotation||entity.dir;
        if(entity.state==='fainted')model.rotation.z=Math.PI/2;else model.rotation.z=0;
      }
      for(const [entity,record]of records)if(!seen.has(entity)){remove(record);records.delete(entity);}
      if(G.map?.vine){
        const capacity=width*height;
        if(vineCapacity!==capacity){for(const mesh of vineMeshes){scene.remove(mesh);mesh.dispose();}vineMeshes=[];vineCapacity=capacity;for(const template of vineTemplate.children){if(!template.isMesh)continue;const instance=new THREE.InstancedMesh(template.geometry,template.material,capacity);instance.receiveShadow=true;instance.castShadow=true;instance.frustumCulled=false;scene.add(instance);vineMeshes.push(instance);}}
        const dummy=new THREE.Object3D();let count=0;for(let i=0;i<capacity;i++)if(G.map.vine[i]){dummy.position.set(i%width-width/2+.5,0,Math.floor(i/width)-height/2+.5);dummy.scale.setScalar(.45);dummy.rotation.y=i*2.4;dummy.updateMatrix();for(const mesh of vineMeshes)mesh.setMatrixAt(count,dummy.matrix);count++;}for(const mesh of vineMeshes){mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}
      }
      renderer.render(scene,camera);
      if(uiCanvas&&window.UI){const w=canvas.clientWidth,h=canvas.clientHeight;if(uiCanvas.width!==w||uiCanvas.height!==h){uiCanvas.width=w;uiCanvas.height=h;}const ctx=uiCanvas.getContext('2d');ctx.clearRect(0,0,w,h);try{UI.drawUI(ctx,G);}catch(error){onError(error);}}
    },
    dispose(){disposed=true;canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',move);for(const record of records.values())remove(record);records.clear();const geometries=new Set();terrain.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});for(const mesh of vineMeshes){mesh.dispose();scene.remove(mesh);}vineTemplate.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geo of geometries)geo.dispose();view.dispose();},
    get modelCount(){return records.size;}
  };
}
