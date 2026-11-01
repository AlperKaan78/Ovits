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
function ovik(g,type,gender='male'){
  const m=materials(),female=gender==='female';
  const gold=new THREE.MeshPhysicalMaterial({color:'#c7a345',metalness:.88,roughness:.25,clearcoat:.7});
  const hair=new THREE.MeshStandardMaterial({color:'#19140f',roughness:.65});
  const suit=new THREE.MeshStandardMaterial({color:type==='bilimci'?'#d7d4c6':type==='asker'?'#353b2c':'#63513a',map:m.cloth.map,roughness:.92});
  const limbs=[];
  // Six articulated arms and a segmented golden carapace match the supplied Ovik references.
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.15,.91,0);g.add(leg);limbs.push({node:leg,phase:side,leg:true});
    rod(leg,[0,0,0],[0,-.42,0],.115,suit,.135);orb(leg,0,-.43,0,.12,.12,.11,gold);rod(leg,[0,-.45,0],[0,-.75,.015],.1,gold,.08);orb(leg,0,-.82,.09,.13,.12,.22,m.dark);
    for(let row=0;row<3;row++){
      const arm=new THREE.Group();arm.position.set(side*(.24-row*.025),1.43-row*.21,-row*.045);g.add(arm);limbs.push({node:arm,phase:side*(row%2?-1:1),leg:false});
      const elbow=[side*.17,-.25,.02],hand=[side*(.22+row*.05),-.47,.14];
      orb(arm,0,0,0,.115,.13,.12,gold);rod(arm,[0,0,0],elbow,.085,gold,.065);orb(arm,...elbow,.075,.075,.075,m.dark);rod(arm,elbow,hand,.065,gold,.048);orb(arm,...hand,.07,.085,.045,gold);
      for(let j=0;j<3;j++)rod(arm,[hand[0]+(j-1)*.027,hand[1]-.04,hand[2]],[hand[0]+(j-1)*.03,hand[1]-.13,hand[2]+.025],.012,gold);
    }
  }
  orb(g,0,1.18,0,female?.205:.245,.33,.145,suit);box(g,.4,.065,.3,m.dark,0,.97,0);box(g,.065,.05,.035,gold,0,.97,.16);
  for(let i=0;i<5;i++)orb(g,0,1.12+i*.08,-.13,.26-i*.012,.1,.13,gold);
  for(const side of [-1,1]){rod(g,[side*.15,1.45,.12],[side*.14,1.01,.15],.022,m.dark);box(g,.11,.15,.06,suit,side*.19,1.04,.15);}
  rod(g,[0,1.47,0],[0,1.58,0],.07,gold);orb(g,0,1.72,.015,female?.145:.16,.19,.14,gold);
  orb(g,0,1.84,-.025,.165,.115,.15,hair);
  for(const side of [-1,1]){orb(g,side*.067,1.75,.139,.039,.018,.013,m.lamp);rod(g,[side*.03,1.79,.135],[side*.11,1.79,.115],.014,hair);rod(g,[side*.14,1.78,0],[side*.23,1.84,-.07],.025,gold);}
  orb(g,0,1.705,.151,.025,.035,.03,gold);rod(g,[-.047,1.65,.13],[.047,1.65,.13],.008,m.dark);
  if(female){for(let i=0;i<13;i++)orb(g,Math.sin(i*.9)*.07,1.77-i*.065,-.14-i*.012,.072,.065,.06,hair);}
  else for(let i=0;i<7;i++)rod(g,[-.13+i*.04,1.85,.04],[-.08+i*.04,1.96,-.12],.035,hair,.01);
  if(type==='bilimci'){box(g,.39,.48,.06,suit,0,1.21,.15);box(g,.23,.035,.3,m.dark,.47,.79,.3);orb(g,-.46,1.22,.17,.06,.12,.06,m.glass);}
  if(type==='isci'){rod(g,[.5,.54,.19],[.5,1.18,.19],.027,m.brass);box(g,.38,.065,.08,m.metal,.5,1.18,.19);}
  if(type==='asker'){box(g,.4,.32,.085,m.dark,0,1.3,.17);box(g,.1,.13,.64,m.dark,.44,1.06,.32);rod(g,[.44,1.07,.5],[.44,1.07,.9],.03,m.metal);box(g,.07,.1,.14,m.glass,.44,1.17,.36);}
  g.userData.limbs=limbs;
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
export function createModel(type,gender){materials();const g=new THREE.Group();g.userData.kind=type;
  if(['merkez','ev','karakol','laboratuvar'].includes(type))building(g,type);
  else if(['cekimKulesi','taret'].includes(type))tower(g,type);
  else if(['isci','asker','bilimci','yavru'].includes(type)){ovik(g,type,gender);if(type==='yavru')g.scale.setScalar(.6);}
  else if(type==='hastane'){building(g,'laboratuvar');box(g,.6,.12,.09,mats.energy,0,1.8,1.05);box(g,.12,.6,.09,mats.energy,0,1.8,1.05);}
  else if(type==='duvar'){for(let i=0;i<3;i++)stoneBlock(g,1.5,.4,.55,0,.2+i*.4,0);}
  else if(type==='gozetleme'){building(g,'karakol');tower(g,'taret');}
  else if(type==='koloni'||type==='kralice')colony(g,type==='kralice');
  else if(type==='sarmasik')vine(g);
  else if(type==='kristal'){gem(g,0,.8,0,.65);gem(g,.5,.45,.2,.35);gem(g,-.4,.4,-.2,.3);}
  else if(type==='yumurta'){orb(g,0,.4,0,.28,.4,.28,mats.stone);ring(g,.28,.02,mats.brass,0,.3,0);}
  else if(type==='akinci'){ovik(g,'asker');const cloak=mesh(g,new THREE.ConeGeometry(.4,.95,24,1,true),mats.cloth,0,1.06,-.09);cloak.rotation.x=-.13;orb(g,0,1.79,-.04,.22,.23,.2,mats.cloth);box(g,.23,.035,.08,mats.lamp,0,1.75,.18);}
  else if(type==='tasOcagi'||type==='meteor'||type==='stoneDeposit'){
    for(let i=0;i<7;i++){const o=mesh(g,new THREE.DodecahedronGeometry(.5+random()*.6,1),mats.darkStone,(random()-.5)*2,.3,(random()-.5)*1.8);o.scale.set(1,.55+random(),1);o.rotation.set(random(),random(),random());}
    if(type==='meteor')gem(g,0,.9,0,.65);else if(type==='tasOcagi'){rod(g,[-.8,.2,.6],[-.8,2,.6],.06,mats.metal);rod(g,[-.8,2,.6],[.8,2,.6],.06,mats.metal);rod(g,[.8,2,.6],[.8,.4,.6],.06,mats.metal);}
  }
  return g;
}
export function createLandscape({decorativeVines=true,clearPlayable=false}={}){const g=new THREE.Group(),m=materials();
  const geo=new THREE.PlaneGeometry(clearPlayable?640:76,clearPlayable?640:64,clearPlayable?180:130,clearPlayable?180:110);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const edge=clearPlayable?Math.min(5,Math.max(0,(Math.hypot(x,z)-34)/12)):Math.max(0,(Math.hypot(x,z)-17)/12);pos.setY(i,clearPlayable&&Math.abs(x)<34&&Math.abs(z)<24?0:Math.sin(x*.13)*Math.cos(z*.17)*.11+edge*(Math.sin(x*.045+z*.02)*.9+.6));}geo.computeVertexNormals();
  const groundMat=clearPlayable?m.soil.clone():m.soil;if(clearPlayable){groundMat.map=m.soil.map.clone();groundMat.map.repeat.set(200,200);groundMat.bumpMap=groundMat.map;}
  mesh(g,geo,groundMat,0,-.12,0);
  const rockGeo=new THREE.IcosahedronGeometry(1,3),rp=rockGeo.attributes.position;
  for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),n=1+Math.sin(x*7+z*3)*Math.cos(y*6-z*4)*.11+Math.sin(x*17+y*13+z*9)*.025;rp.setXYZ(i,x*n,y*n,z*n);}rockGeo.computeVertexNormals();
  for(let i=0;i<160;i++){const x=(random()-.5)*65,z=(random()-.5)*50;if(Math.abs(x)<(clearPlayable?31:14)&&Math.abs(z)<(clearPlayable?21:11))continue;const r=.14+random()*1.2;const o=mesh(g,rockGeo,m.darkStone,x,r*.24,z);o.scale.set(r,r*(.3+random()*.6),r);o.rotation.set(random(),random()*6,random()*.2);}
  // Gravel instancing gives surface scale without thousands of draw calls.
  const gravel=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.06,0),m.stone,1400),dummy=new THREE.Object3D();
  for(let i=0;i<1400;i++){dummy.position.set((random()-.5)*58,.005,(random()-.5)*45);dummy.scale.setScalar(.4+random()*1.6);dummy.rotation.set(random(),random(),random());dummy.updateMatrix();gravel.setMatrixAt(i,dummy.matrix);}gravel.receiveShadow=true;g.add(gravel);
  if(decorativeVines)for(let i=0;i<24;i++){const v=createModel('sarmasik');const a=i*.72;v.position.set(15+Math.sin(a)*4,0,-7+i*.67);v.rotation.y=a;v.scale.setScalar(1.3);g.add(v);}
  if(clearPlayable){
    // Distant geology and a violet/blue forest continue far beyond the playable colony.
    const count=420,rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),m.darkStone,count),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.5,1,7),m.vine,180),crowns=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),m.leaf,180),d=new THREE.Object3D();
    for(let i=0;i<count;i++){const a=random()*Math.PI*2,r=45+random()*260,s=.6+random()*4;d.position.set(Math.cos(a)*r,0,Math.sin(a)*r);d.scale.set(s,.4*s,s);d.rotation.set(random()*.3,random()*6,0);d.updateMatrix();rocks.setMatrixAt(i,d.matrix);}
    for(let i=0;i<180;i++){const a=random()*Math.PI*2,r=43+random()*200,height=3+random()*8,x=Math.cos(a)*r,z=Math.sin(a)*r;d.position.set(x,height/2,z);d.scale.set(1,height,1);d.rotation.set(.03,random()*6,.05);d.updateMatrix();trunks.setMatrixAt(i,d.matrix);d.position.set(x,height*.9,z);d.scale.set(height*.35,height*.25,height*.4);d.rotation.set(0,random()*6,0);d.updateMatrix();crowns.setMatrixAt(i,d.matrix);}
    rocks.receiveShadow=trunks.receiveShadow=crowns.receiveShadow=true;g.add(rocks,trunks,crowns);
  }
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
  const camera=new THREE.PerspectiveCamera(38,1,.1,700);camera.position.set(23,19,28);camera.lookAt(0,1,0);
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
