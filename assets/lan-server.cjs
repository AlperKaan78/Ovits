// Authoritative LAN host: clients send commands, never trusted simulation state.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),os=require('node:os');
const {encode}=require('./state-codec.cjs');
const root=path.resolve(__dirname,'..'),s={console,Math};s.window=s;vm.createContext(s);
for(const file of ['data/config.js','src/core.js','src/vines.js','src/meteors.js','src/city.js','src/colonies.js','src/enemies.js','src/research.js','assets/civilization.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),s,{filename:file});
vm.runInContext(fs.readFileSync(path.join(__dirname,'tasks3d.js'),'utf8').replace('export function createTasks','function createTasks')+';window.createTasks=createTasks;',s);
const {Game,City,Civilization}=s,G=Game.G=Game.newState();for(const m of Game.modules)m.init?.(G);Civilization.ensure(G);
// The neutral world is shared. Each civilization owns its population, research and resources.
G.units=[];G.buildings=[];
const basePrune=s.Vines.prune;
const players=new Map(),streams=new Map(),spawns=[[6,18],[24,18],[6,32],[25,32]],flags=['#c9773a','#388fc4','#799c44','#aa64bd'];
G.civilizationAccount=id=>[...players.values()].find(p=>p.id===id);
function scope(p,fn){const saved={units:G.units,buildings:G.buildings,res:G.res,research:G.research,ui:G.ui,stats:G.stats};G.units=saved.units.filter(u=>u.civ===p.id);G.buildings=saved.buildings.filter(b=>b.civ===p.id);G.res=p.res;G.research=p.research;G.ui=p.ui;G.stats=p.stats;G.visitors={buildings:saved.buildings.filter(b=>b.civ!==p.id)};try{return fn();}finally{for(const u of G.units){u.civ=p.id;u.flag=p.flag;}for(const b of G.buildings){b.civ=p.id;b.flag=p.flag;}const units=G.units,buildings=G.buildings;p.stats=G.stats;p.res=G.res;p.research=G.research;Object.assign(G,saved);G.units=saved.units.filter(u=>u.civ!==p.id).concat(units);G.buildings=saved.buildings.filter(b=>b.civ!==p.id).concat(buildings);delete G.visitors;}}
function join(name,flag,options={}){if(!players.size)G.options={raiders:options.raiders===true};if(players.size>=4)throw Error('Oda dolu (4 medeniyet).');const id=crypto.randomUUID(),token=crypto.randomBytes(24).toString('hex'),slot=spawns.findIndex((_,i)=>![...players.values()].some(p=>p.slot===i)),spawn=spawns[slot],p={id,token,slot,name:String(name||'Medeniyet').slice(0,24),flag:flags.includes(flag)?flag:flags[slot],res:{oz:20,tas:200,kitin:0,lif:0,ozsu:0},research:{done:{},queue:[],current:null,progress:0},stats:{},ui:{selection:[],selected:null,mouse:{}},connected:true};players.set(token,p);
scope(p,()=>{Game.addBuilding(G,'merkez',...spawn);Game.addBuilding(G,'ev',spawn[0]-2,spawn[1]-3);for(let i=0;i<3;i++)Game.addUnit(G,{kind:'isci',owner:'player',x:spawn[0]+3,y:spawn[1]+i*.7,hp:40,state:'idle'});Game.addUnit(G,{kind:'asker',owner:'player',x:spawn[0]-1,y:spawn[1],hp:60,state:'idle'});Civilization.ensure(G);p.tasks=s.createTasks(G);});return p;}
function leave(token){
  const p=players.get(token);if(!p)return false;
  const own=G.units.filter(u=>u.civ===p.id),ids=new Set(own.map(u=>u.id));p.tasks.release(own);
  for(const u of own)if(u.chip)u.chip.reserved=false;
  for(const cr of G.crystals){if(ids.has(cr.carriedBy))cr.carriedBy=null;if(ids.has(cr.claimedBy))cr.claimedBy=null;}
  G.units=G.units.filter(u=>u.civ!==p.id);G.buildings=G.buildings.filter(b=>b.civ!==p.id);streams.get(token)?.end();streams.delete(token);players.delete(token);
  if(!players.size){s.Vines.prune=basePrune;const account=G.civilizationAccount;for(const key of Object.keys(G))delete G[key];Object.assign(G,Game.newState());G.civilizationAccount=account;for(const m of Game.modules)m.init?.(G);Civilization.ensure(G);G.units=[];G.buildings=[];G.options={raiders:false};}
  return true;
}
function snapshot(p){const sharedUnits=G.units,sharedBuildings=G.buildings;return scope(p,()=>{const ownUnits=G.units,ownBuildings=G.buildings;return encode({options:G.options,time:G.time,over:p.over||null,paused:false,speed:1,res:p.res,research:p.research,stats:p.stats,map:G.map,deposits:G.deposits,units:ownUnits,buildings:ownBuildings,enemies:G.enemies,colonies:G.colonies,crystals:G.crystals,meteors:G.meteors,flags:G.flags,messages:G.messages,visitors:{units:sharedUnits.filter(u=>u.civ!==p.id).map(u=>({...u,owner:'remote'})),buildings:sharedBuildings.filter(b=>b.civ!==p.id)},civilizations:[...players.values()].map(v=>({id:v.id,name:v.name,flag:v.flag,connected:v.connected})),civ:p.id});});}

function action(p,a){return scope(p,()=>{const units=G.units.filter(u=>Array.isArray(a.ids)&&a.ids.includes(u.id));G.ui.selection=units;G.ui.selected=units[0]||G.buildings.find(b=>b.id===a.building);const b=G.buildings.find(b=>b.id===a.building);
if(p.over)return false;
if(a.type==='flag'){if(!flags.includes(a.flag))return false;p.flag=a.flag;return Civilization.setFlag(G,a.flag);}
if(a.type==='build'){if(!Number.isInteger(a.x)||!Number.isInteger(a.y)||!s.CONFIG.buildings[a.kind])return false;return !!City.build(G,a.kind,a.x,a.y);}
if(a.type==='feed')return City.feedNext(G,a.kind);
if(a.type==='research')return s.Research.enqueue(G,a.id);
if(a.type==='repair'&&b)return Civilization.repair(G,b);
if(a.type==='upgradeBuilding'&&b)return Civilization.upgrade(G,b);
if(a.type==='upgradeUnit')return Civilization.upgradeUnit(G,units);
if(a.type==='recall'){p.tasks.release(G.units);return Civilization.recall(G);}
if(a.type==='assign'){p.tasks.release(units);return Civilization.assign(G,units,a.job,b);}
if(a.type==='harvest'){if(!a.area||!Object.values(a.area).every(Number.isFinite))return false;return p.tasks.harvest(a.area,units);}
if(a.type==='command'){if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Game.inMap(G,Math.floor(a.x),Math.floor(a.y)))return false;G.ui.commandMode=a.mode==='move'?'move':'context';return p.tasks.command({wx:a.x,wy:a.y,tx:Math.floor(a.x),ty:Math.floor(a.y)});}
return false;});}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');
if(url.pathname==='/'){res.writeHead(302,{Location:'/assets/game3d.html'}).end();return;}
if(url.pathname==='/lan/status'){const p=players.get(url.searchParams.get('token'));res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({lan:true,version:path.basename(root),authenticated:!!p,id:p?.id,roomActive:players.size>0,raiders:G.options?.raiders===true}));return;}
if(url.pathname==='/lan/join'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413).end();return;}}try{const p=join(...(()=>{const b=JSON.parse(body);return [b.name,b.flag,{raiders:b.raiders===true}];})());res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({token:p.token,id:p.id}));}catch(e){res.writeHead(400).end(e.message);}return;}
if(url.pathname==='/lan/leave'&&req.method==='POST'){leave(url.searchParams.get('token'));res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true}');return;}
if(url.pathname.startsWith('/lan/')){const p=players.get(url.searchParams.get('token'));if(!p){res.writeHead(403).end();return;}
if(url.pathname==='/lan/status'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({id:p.id}));return;}
if(url.pathname==='/lan/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});streams.set(p.token,res);p.connected=true;res.write('data: '+snapshot(p)+'\n\n');req.on('close',()=>{if(streams.get(p.token)===res)streams.delete(p.token);p.connected=false;});return;}
if(url.pathname==='/lan/action'&&req.method==='POST'){let body='';for await(const c of req){body+=c;if(body.length>8192){res.writeHead(413).end();return;}}try{const now=Date.now();if(now-(p.lastAction||0)<30){res.writeHead(429).end();return;}p.lastAction=now;const ok=action(p,JSON.parse(body));res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:!!ok}));}catch(e){res.writeHead(400).end('Geçersiz komut');}return;}res.writeHead(404).end();return;}
let file;try{let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/assets/game3d.html';file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||pathname.split('/').some(v=>v.startsWith('.'))||!['.js','.html','.png','.css'].includes(path.extname(file))){res.writeHead(403).end();return;}}catch{res.writeHead(400).end();return;}
fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-store'}).end(data);});});
function tick(dt=.1){if(!players.size)return;G.time+=dt;for(const p of players.values()){if(p.over)continue;scope(p,()=>{Game.modules.find(m=>m.name==='city').update(G,dt);Game.modules.find(m=>m.name==='research').update(G,dt);p.tasks.update();if(G.over){p.over=G.over;G.over=null;}if(!Game.merkez(G))p.over='lose';else if(G.res.oz>=s.CONFIG.win.oz)p.over='win';});}
for(const m of Game.modules)if(!['city','research'].includes(m.name))m.update?.(G,dt);
G.units=G.units.filter(u=>u.hp>0);G.buildings=G.buildings.filter(b=>b.hp>0);G.enemies=G.enemies.filter(e=>e.hp>0);
if(Math.round(G.time*10)%2===0)for(const [token,res]of streams){if(!res.writableNeedDrain)res.write('data: '+snapshot(players.get(token))+'\n\n');}
}
const timer=setInterval(()=>tick(),100);
server.on('close',()=>clearInterval(timer));
if(require.main===module){const port=Number(process.env.LAN_PORT)||4180;server.listen(port,'0.0.0.0',()=>{console.log('Mor Sarmaşık LAN: http://localhost:'+port);for(const list of Object.values(os.networkInterfaces()))for(const ip of list||[])if(ip.family==='IPv4'&&!ip.internal)console.log('Aynı Wi-Fi: http://'+ip.address+':'+port);});}
module.exports={server,join,action,snapshot,G,players,tick,leave};
