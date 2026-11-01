import * as THREE from './vendor/three.module.js';

// All geometry and surface maps are authored here. No stock models or image textures.
export { THREE };
let seed = 173;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
function surface(base, rough = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    const n = random(); ctx.fillStyle = n > .5 ? `rgba(230,219,201,${n*.19})` : `rgba(22,18,27,${n*.25})`;
    ctx.fillRect(random()*256, random()*256, 1+random()*4, 1+random()*2);
  }
  if (rough) for(let i=0;i<35;i++) { ctx.strokeStyle='rgba(38,28,36,.13)';ctx.lineWidth=.5;ctx.beginPath();const x=random()*256,y=random()*256;ctx.moveTo(x,y);ctx.lineTo(x+random()*35,y+random()*20);ctx.stroke(); }
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}
let mats;
function materials() {
  if(mats)return mats;
  const stoneMap=surface('#9b9180',true), metalMap=surface('#717078'), soilMap=surface('#696457',true);
  soilMap.repeat.set(22,22);
  const clothMap=surface('#8b8080',true);clothMap.repeat.set(3,3);
  mats={
    stone:new THREE.MeshStandardMaterial({map:stoneMap,roughness:.95,bumpMap:stoneMap,bumpScale:.045}),
    darkStone:new THREE.MeshStandardMaterial({color:'#716b65',map:stoneMap,roughness:.92,bumpMap:stoneMap,bumpScale:.035}),
    metal:new THREE.MeshStandardMaterial({color:'#787780',map:metalMap,metalness:.78,roughness:.36}),
    dark:new THREE.MeshStandardMaterial({color:'#25232b',metalness:.5,roughness:.55}),
    brass:new THREE.MeshStandardMaterial({color:'#b49868',metalness:.72,roughness:.32}),
    soil:new THREE.MeshStandardMaterial({map:soilMap,roughness:1,bumpMap:soilMap,bumpScale:.025}),
    cloth:new THREE.MeshStandardMaterial({color:'#827c77',map:clothMap,roughness:.96,bumpMap:clothMap,bumpScale:.012}),
    skin:new THREE.MeshStandardMaterial({color:'#b3a08a',roughness:.7}),
    blue:new THREE.MeshStandardMaterial({color:'#355469',metalness:.3,roughness:.4}),
    vine:new THREE.MeshStandardMaterial({color:'#493054',roughness:.6}),
    leaf:new THREE.MeshStandardMaterial({color:'#397e8b',metalness:.22,roughness:.35}),
    shell:new THREE.MeshPhysicalMaterial({color:'#35464e',metalness:.6,roughness:.28,clearcoat:.7}),
    crystal:new THREE.MeshPhysicalMaterial({color:'#ad73eb',metalness:.15,roughness:.12,transmission:.15,thickness:.7,emissive:'#6b2baf',emissiveIntensity:.35}),
    glass:new THREE.MeshPhysicalMaterial({color:'#64b6bd',metalness:.3,roughness:.15,clearcoat:1}),
    lamp:new THREE.MeshStandardMaterial({color:'#ffcb7d',emissive:'#ffab45',emissiveIntensity:2.2,roughness:.4}),
    energy:new THREE.MeshStandardMaterial({color:'#a8edd8',emissive:'#6ad3bd',emissiveIntensity:2.2}),
  }; return mats;
}
function mesh(g,geo,mat,x=0,y=0,z=0) {const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function box(g,w,h,d,mat,x=0,y=0,z=0){return mesh(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
function orb(g,x,y,z,sx,sy,sz,mat){const o=mesh(g,new THREE.SphereGeometry(1,24,16),mat,x,y,z);o.scale.set(sx,sy,sz);return o;}
function rod(g,a,b,r,mat,r2=r){const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b),d=v2.clone().sub(v1);const o=mesh(g,new THREE.CylinderGeometry(r2,r,d.length(),12),mat);o.position.copy(v1.add(v2).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
function ring(g,r,t,mat,x,y,z){const o=mesh(g,new THREE.TorusGeometry(r,t,10,64),mat,x,y,z);o.rotation.x=Math.PI/2;return o;}
function gem(g,x,y,z,size=1){const o=mesh(g,new THREE.OctahedronGeometry(size,0),materials().crystal,x,y,z);o.scale.set(.5,1.6,.5);o.rotation.y=.35;return o;}
function lamp(g,x,y,z){const m=materials();box(g,.12,.19,.08,m.brass,x,y,z);box(g,.085,.12,.09,m.lamp,x,y,z+.02);}
function stoneBlock(g,w,h,d,x,y,z){const o=box(g,w,h,d,random()>.25?materials().stone:materials().darkStone,x,y,z);o.rotation.y=(random()-.5)*.035;return o;}
function building(g,type){
  const m=materials();box(g,3.4,.22,2.9,m.darkStone,0,.11,0);box(g,3.05,.18,2.55,m.stone,0,.29,0);
  // Individually laid masonry with recessed mortar, deep openings and roof parapets.
  for(let floor=0;floor<2;floor++)for(let row=0;row<4;row++)for(let i=0;i<6;i++){
    const x=(i-2.5)*.48, y=.55+row*.25+floor*1.05;
    if(floor===1&&i>3)continue;
    if(!(floor===0&&row<3&&(i===2||i===3)))stoneBlock(g,.455,.232,.27,x,y,1.11-floor*.28);
    stoneBlock(g,.455,.232,.27,x,y,-1.1+floor*.2);
  }
  box(g,2.85,1.0,.25,m.darkStone,0,.96,0);
  for(const side of [-1,1])for(let row=0;row<4;row++)for(let i=0;i<4;i++)stoneBlock(g,.27,.23,.51,side*1.35,.55+row*.25,(i-1.5)*.55);
  box(g,3.1,.15,2.5,m.stone,0,1.49,0);box(g,2.06,.15,1.95,m.stone,-.45,2.52,-.12);
  for(const side of [-1,1])box(g,.12,.3,2.35,m.stone,side*1.47,1.68,0);
  box(g,2.8,.3,.12,m.stone,0,1.68,-1.17);
  box(g,.67,.86,.14,m.dark,0,.78,1.13);box(g,.05,.83,.05,m.brass,.22,.78,1.23);
  for(const x of [-1.0,.95]){box(g,.45,.47,.1,m.dark,x,1,1.26);box(g,.33,.34,.11,m.lamp,x,1.02,1.28);box(g,.035,.38,.13,m.metal,x,1.02,1.3);}
  for(let i=0;i<4;i++)box(g,1.08,.12, .3+i*.08,m.darkStone,0,.12+i*.1,1.6-i*.17);
  for(const x of [-1.42,1.42])rod(g,[x,.42,-1.2],[x,1.48,-1.2],.05,m.metal);
  rod(g,[-1.5,.65,1.25],[1.4,.65,1.25],.035,m.vine);
  lamp(g,-.53,1.01,1.28);lamp(g,.53,1.01,1.28);
  if(type==='merkez'||type==='karakol'){
    rod(g,[-.7,2.55,-.3],[-.7,4.15,-.3],.035,m.brass);
    const flag=box(g,.78,.43,.035,m.cloth,-.29,3.85,-.3);flag.rotation.y=.2;
    box(g,.08,.28,.045,m.brass,-.5,3.85,-.27);
  }
  if(type==='laboratuvar'){orb(g,-.4,2.72,0,.65,.3,.62,m.glass);ring(g,.62,.05,m.brass,-.4,2.66,0);gem(g,-.4,3.25,0,.32);}
  if(type==='karakol'){box(g,.8,.8,.8,m.metal,.7,2,-.3);rod(g,[.7,2.5,-.3],[.7,3.7,-.3],.025,m.metal);}
}
function tower(g,type){const m=materials();
  mesh(g,new THREE.CylinderGeometry(1.25,1.45,.3,8),m.darkStone,0,.15,0);
  mesh(g,new THREE.CylinderGeometry(.65,.92,.45,8),m.metal,0,.53,0);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;rod(g,[Math.cos(a)*1.1,.3,Math.sin(a)*1.1],[Math.cos(a)*.36,3.5,Math.sin(a)*.36],.11,m.metal,.07);}
  mesh(g,new THREE.CylinderGeometry(.4,.62,2.9,12),m.darkStone,0,2,0);
  for(let i=0;i<7;i++)ring(g,.48-i*.013,.035,m.brass,0,1+i*.35,0);
  if(type==='taret'){
    orb(g,0,3.3,0,.77,.4,.7,m.metal);box(g,.7,.5,1.1,m.dark,0,3.5,.3);
    for(const x of [-.2,.2]){rod(g,[x,3.6,.3],[x,3.75,1.85],.1,m.metal);rod(g,[x,3.75,1.65],[x,3.77,1.92],.13,m.dark);}
  }else{
    ring(g,1.25,.075,m.metal,0,3.65,0);ring(g,1.16,.027,m.energy,0,3.69,0);gem(g,0,4,0,.65);
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod(g,[Math.cos(a)*.4,2.9,Math.sin(a)*.4],[Math.cos(a)*1.25,3.65,Math.sin(a)*1.25],.055,m.brass);}
    const light=new THREE.PointLight('#b57dff',9,9,2);light.position.y=4;g.add(light);
  }
}
function ovik(g,type){const m=materials(),suit=type==='bilimci'?m.blue:type==='asker'?m.dark:m.cloth;
  // Human anatomy, articulated boots, fitted suit and separately modelled equipment.
  for(const side of [-1,1]){
    const x=side*.16;
    orb(g,x,.12,.09,.13,.12,.23,m.dark);rod(g,[x,.2,0],[x,.62,-.015],.115,suit,.105);orb(g,x,.63,0,.115,.115,.11,m.metal);rod(g,[x,.67,0],[x,.98,0],.13,suit,.14);
    orb(g,side*.28,1.42,0,.11,.13,.12,suit);rod(g,[side*.3,1.39,0],[side*.36,1.09,.03],.08,suit);orb(g,side*.36,1.05,.05,.075,.09,.075,m.dark);rod(g,[side*.36,1.04,.05],[side*.38,.87,.17],.07,suit);orb(g,side*.38,.85,.18,.07,.09,.07,m.dark);
    box(g,.11,.16,.07,m.cloth,side*.21,1.02,.15);box(g,.12,.15,.08,m.dark,x,.69,.11);rod(g,[side*.22,.75,-.015],[side*.22,.9,-.015],.012,m.brass);
  }
  orb(g,0,1.21,0,.23,.33,.15,suit);box(g,.43,.07,.3,m.dark,0,.99,0);box(g,.065,.055,.04,m.brass,0,.99,.16);
  rod(g,[0,1.47,0],[0,1.58,0],.085,m.skin);orb(g,0,1.73,0,.16,.205,.155,m.skin);
  orb(g,0,1.81,-.02,.174,.17,.16,m.metal);
  // Brow, nose, ears, visor and respirator keep the silhouette readable at RTS scale.
  orb(g,0,1.74,.144,.14,.067,.035,m.glass);box(g,.12,.075,.08,m.dark,0,1.65,.16);
  for(const side of [-1,1]){rod(g,[side*.14,1.47,.12],[side*.14,1.08,.15],.019,m.dark);box(g,.095,.14,.05,m.cloth,side*.09,1.23,.16);rod(g,[side*.125,1.56,.07],[side*.125,1.63,.14],.018,m.brass);}
  box(g,.08,.075,.03,m.glass,-.075,1.37,.175);
  for(const x of [-.17,.17])orb(g,x,1.73,0,.035,.065,.035,m.skin);
  box(g,.36,.44,.16,m.dark,0,1.24,-.2);rod(g,[-.17,1.46,-.13],[-.17,1.09,.17],.024,m.brass);
  if(type==='isci'){rod(g,[.4,.56,.18],[.4,1.28,.18],.025,m.brass);box(g,.4,.07,.085,m.metal,.4,1.27,.18);}
  if(type==='asker'){box(g,.4,.3,.1,m.metal,0,1.34,.15);box(g,.09,.13,.66,m.dark,.4,.95,.4);rod(g,[.4,.97,.6],[.4,.97,.95],.035,m.metal);}
  if(type==='bilimci'){box(g,.23,.06,.32,m.glass,.4,.89,.3);orb(g,0,1.28,-.35,.105,.22,.1,m.brass);}
}
function colony(g,queen){const m=materials(),s=queen?1.5:1;g.scale.setScalar(s);
  orb(g,0,.87,-.3,.53,.43,.75,m.shell);orb(g,0,.92,.4,.38,.31,.42,m.shell);orb(g,0,.88,.8,.27,.23,.28,m.dark);
  for(let i=0;i<6;i++){const z=-.8+i*.2;ring(g,.39-i*.012,.022,m.brass,0,.97,z).rotation.x=0;}
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const z=-.52+i*.48;const a=[side*.32,.85,z],b=[side*(.95-i*.05),1.05,z-.25],c=[side*1.25,.15,z+.2];
    orb(g,...a,.11,.11,.11,m.brass);rod(g,a,b,.075,m.shell,.06);orb(g,...b,.09,.09,.09,m.dark);rod(g,b,c,.05,m.shell,.025);rod(g,c,[side*1.38,.04,z+.3],.025,m.dark,.01);
  }
  for(const side of [-1,1]){orb(g,side*.16,.99,1,.07,.065,.035,m.lamp);rod(g,[side*.17,1.03,1],[side*.28,1.32,1.3],.018,m.brass);rod(g,[side*.12,.78,1.0],[side*.27,.68,1.25],.06,m.shell,.015);}
  if(queen){for(let i=0;i<5;i++)gem(g,Math.sin(i*2)*.15,1.25+i*.055,-.8+i*.24,.19);}
}
function vine(g){const m=materials();
  for(let j=0;j<3;j++){
    const points=[];for(let i=0;i<8;i++)points.push(new THREE.Vector3(Math.sin(i*.85+j)*.3,.08+i*.13,(i-3.5)*.32));
    mesh(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,.055,7,false),m.vine);
    for(let i=1;i<7;i++){const p=points[i],side=i%2?1:-1;const leaf=orb(g,p.x+side*.21,p.y+.03,p.z,.28,.035,.11,m.leaf);leaf.rotation.z=side*.3;leaf.rotation.y=side*.45;}
  }
}
export function createModel(type){materials();const g=new THREE.Group();g.userData.kind=type;
  if(['merkez','ev','karakol','laboratuvar'].includes(type))building(g,type);
  else if(['cekimKulesi','taret'].includes(type))tower(g,type);
  else if(['isci','asker','bilimci','yavru'].includes(type)){ovik(g,type);if(type==='yavru')g.scale.setScalar(.6);}
  else if(type==='koloni'||type==='kralice')colony(g,type==='kralice');
  else if(type==='sarmasik')vine(g);
  else if(type==='kristal'){gem(g,0,.8,0,.65);gem(g,.5,.45,.2,.35);gem(g,-.4,.4,-.2,.3);}
  else if(type==='yumurta'){orb(g,0,.4,0,.28,.4,.28,mats.stone);ring(g,.28,.02,mats.brass,0,.3,0);}
  else if(type==='akinci'){ovik(g,'asker');const cloak=mesh(g,new THREE.ConeGeometry(.4,.95,24,1,true),mats.cloth,0,1.06,-.09);cloak.rotation.x=-.13;orb(g,0,1.79,-.04,.22,.23,.2,mats.cloth);box(g,.23,.035,.08,mats.lamp,0,1.75,.18);}
  else if(type==='tasOcagi'||type==='meteor'){
    for(let i=0;i<7;i++){const o=mesh(g,new THREE.DodecahedronGeometry(.5+random()*.6,1),mats.darkStone,(random()-.5)*2,.3,(random()-.5)*1.8);o.scale.set(1,.55+random(),1);o.rotation.set(random(),random(),random());}
    if(type==='meteor')gem(g,0,.9,0,.65);else{rod(g,[-.8,.2,.6],[-.8,2,.6],.06,mats.metal);rod(g,[-.8,2,.6],[.8,2,.6],.06,mats.metal);rod(g,[.8,2,.6],[.8,.4,.6],.06,mats.metal);}
  }
  return g;
}
export function createLandscape({decorativeVines=true,clearPlayable=false}={}){const g=new THREE.Group(),m=materials();
  const geo=new THREE.PlaneGeometry(76,64,130,110);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const edge=Math.max(0,(Math.hypot(x,z)-17)/12);pos.setY(i,clearPlayable&&Math.abs(x)<31&&Math.abs(z)<21?0:Math.sin(x*.33)*Math.cos(z*.27)*.11+edge*(Math.sin(x*.25+z*.2)*.9+.6));}geo.computeVertexNormals();mesh(g,geo,m.soil,0,-.12,0);
  const rockGeo=new THREE.IcosahedronGeometry(1,3),rp=rockGeo.attributes.position;
  for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),n=1+Math.sin(x*7+z*3)*Math.cos(y*6-z*4)*.11+Math.sin(x*17+y*13+z*9)*.025;rp.setXYZ(i,x*n,y*n,z*n);}rockGeo.computeVertexNormals();
  for(let i=0;i<160;i++){const x=(random()-.5)*65,z=(random()-.5)*50;if(Math.abs(x)<(clearPlayable?31:14)&&Math.abs(z)<(clearPlayable?21:11))continue;const r=.14+random()*1.2;const o=mesh(g,rockGeo,m.darkStone,x,r*.24,z);o.scale.set(r,r*(.3+random()*.6),r);o.rotation.set(random(),random()*6,random()*.2);}
  // Gravel instancing gives surface scale without thousands of draw calls.
  const gravel=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.06,0),m.stone,1400),dummy=new THREE.Object3D();
  for(let i=0;i<1400;i++){dummy.position.set((random()-.5)*58,.005,(random()-.5)*45);dummy.scale.setScalar(.4+random()*1.6);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();gravel.setMatrixAt(i,dummy.matrix);}gravel.receiveShadow=true;g.add(gravel);
  if(decorativeVines)for(let i=0;i<24;i++){const v=createModel('sarmasik');const a=i*.72;v.position.set(15+Math.sin(a)*4,0,-7+i*.67);v.rotation.y=a;v.scale.setScalar(1.3);g.add(v);}
  return g;
}
export function createView(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bbb4ad');scene.fog=new THREE.FogExp2('#aaa3a4',.012);
  // Procedural studio sky for physically based metal reflections; no HDR image asset.
  const envScene=new THREE.Scene();envScene.background=new THREE.Color('#8a929b');
  const sky=new THREE.Mesh(new THREE.SphereGeometry(40,24,16),new THREE.MeshBasicMaterial({color:'#bccbd8',side:THREE.BackSide}));envScene.add(sky);
  const softbox=new THREE.Mesh(new THREE.PlaneGeometry(16,12),new THREE.MeshBasicMaterial({color:'#fff1d7',side:THREE.DoubleSide}));softbox.position.set(-10,16,12);softbox.lookAt(0,0,0);envScene.add(softbox);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(envScene,.06);scene.environment=environment.texture;scene.environmentIntensity=.45;pmrem.dispose();sky.geometry.dispose();sky.material.dispose();softbox.geometry.dispose();softbox.material.dispose();
  const camera=new THREE.PerspectiveCamera(38,1,.1,180);camera.position.set(23,19,28);camera.lookAt(0,1,0);
  scene.add(new THREE.HemisphereLight('#c1d4ed','#514431',2.4));
  const sun=new THREE.DirectionalLight('#ffe2b2',4);sun.position.set(-14,24,13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;sun.shadow.camera.far=85;sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;sun.shadow.radius=3;scene.add(sun);
  const rim=new THREE.DirectionalLight('#a2b5ff',1.2);rim.position.set(8,10,-15);scene.add(rim);
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  return {renderer,scene,camera,resize,dispose(){observer.disconnect();environment.dispose();renderer.dispose();}};
}

// Bake static scenery by material, keeping original model factories reusable.
export function batchStatic(root){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),buckets=new Map(),originals=[];
  root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material))return;
    const geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(geometry);originals.push(o);
  });
  for(const o of originals)o.removeFromParent();
  for(const geometry of new Set(originals.map(o=>o.geometry)))geometry.dispose();
  for(const [material,geometries]of buckets){const merged=new THREE.BufferGeometry();for(const name of ['position','normal','uv']){
    const total=geometries.reduce((n,g)=>n+(g.getAttribute(name)?.array.length||0),0);if(!total)continue;
    const array=new Float32Array(total);let offset=0;for(const g of geometries){const a=g.getAttribute(name);if(a){array.set(a.array,offset);offset+=a.array.length;}}
    merged.setAttribute(name,new THREE.BufferAttribute(array,name==='uv'?2:3));
  }merged.computeBoundingSphere();const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);for(const g of geometries)g.dispose();}
  return root;
}
