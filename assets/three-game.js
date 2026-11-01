import {THREE,createModel,createLandscape,createView,batchStatic} from './art3d.js';

/** Render existing G state. Simulation remains owned by City/Enemies/etc.
 * Host calls render(G) after simulation update; no second simulation loop is created.
 * onMapClick receives {x,y,entity,event}; host handles placement/movement rules.
 */
export function createGameView({canvas,uiCanvas,onMapClick=()=>{},onError=console.error}){
  const view=createView(canvas),{scene,camera,renderer}=view;
  const terrain=batchStatic(createLandscape());scene.add(terrain);
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
    const x=Math.floor(hit.x+(current.map?.width||60)/2),y=Math.floor(hit.z+(current.map?.height||40)/2);
    if(x<0||y<0||x>=(current.map?.width||60)||y>=(current.map?.height||40))return;
    if(entity&&!current.ui?.buildMode){current.ui=current.ui||{};current.ui.selected=entity;}
    onMapClick(current,{x,y,entity,event});
  }
  function move(event){if(current)window.UI?.onMouseMove(current,coordinates(event));}
  canvas.addEventListener('click',click);canvas.addEventListener('pointermove',move);
  const alias={kule:'cekimKulesi',member:'koloni',queen:'kralice',worker:'isci',soldier:'asker',scientist:'bilimci'};
  function remove(record){scene.remove(record.model);const geometries=new Set();record.model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});for(const geo of geometries)geo.dispose();}
  return {
    ...view,
    render(G){if(disposed)return;current=G;const seen=new Set();
      const lists=[[G.buildings,null],[G.units,null],[G.enemies,'akinci'],[G.crystals,'kristal']];
      for(const [list,defaultType] of lists)for(const entity of list||[]){
        if(entity.dead||entity.hp<=0||!Number.isFinite(entity.x)||!Number.isFinite(entity.y)||(defaultType==='kristal'&&entity.amount<=0))continue;
        const kind=alias[entity.type]||defaultType||entity.type;seen.add(entity);let record=records.get(entity);
        if(record&&record.kind!==kind){remove(record);records.delete(entity);record=null;}
        if(!record){const model=createModel(kind);model.userData.entity=entity;record={model,kind};records.set(entity,record);scene.add(model);}
        const model=record.model;model.position.set(entity.x-(G.map?.width||60)/2+.5,0,entity.y-(G.map?.height||40)/2+.5);
        model.scale.setScalar(['isci','asker','bilimci','akinci'].includes(kind)?.4:['merkez','ev','laboratuvar','karakol'].includes(kind)?.65:.6);
        if(Number.isFinite(entity.rotation))model.rotation.y=entity.rotation;
      }
      for(const [entity,record]of records)if(!seen.has(entity)){remove(record);records.delete(entity);}
      renderer.render(scene,camera);
      if(uiCanvas&&window.UI){const w=canvas.clientWidth,h=canvas.clientHeight;if(uiCanvas.width!==w||uiCanvas.height!==h){uiCanvas.width=w;uiCanvas.height=h;}const ctx=uiCanvas.getContext('2d');ctx.clearRect(0,0,w,h);try{UI.drawUI(ctx,G);}catch(error){onError(error);}}
    },
    dispose(){disposed=true;canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',move);for(const record of records.values())remove(record);records.clear();const geometries=new Set();terrain.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});for(const geo of geometries)geo.dispose();view.dispose();},
    get modelCount(){return records.size;}
  };
}
