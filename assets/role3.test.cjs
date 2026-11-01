'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture(){
  const modules=[],messages=[];
  const sandbox={console,Math,CONFIG:{enemies:{firstRaid:180,raidInterval:120,count:3,countGrowth:1,hp:45,dps:7,speed:2,range:.8,bounty:3,stealAmount:5},buildings:{merkez:{name:'Merkez'},ev:{name:'Ev',cost:{tas:30}},laboratuvar:{name:'Laboratuvar',cost:{oz:30}}}},Game:{register:m=>modules.push(m),msg:(g,t)=>messages.push(t),gain:(g,r)=>{g.resources.oz+=r.oz}},location:{reload(){sandbox.reloaded=true}}};
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  for(const file of ['src/enemies.js','src/ui.js','assets/art.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);
  const G={time:0,flags:{},resources:{oz:0,tas:50},map:{width:60,height:40,tileSize:20},buildings:[],units:[],crystals:[],ui:{},messages:[]};
  for(const m of modules)m.init(G);
  const ctx=new Proxy({canvas:{width:1200,height:800},fillText(){}},{get:(o,k)=>k in o?o[k]:(()=>{})});
  return {s:sandbox,G,messages,ctx};
}
test('first raid at 180 seconds, repeat at 120 and scale count',()=>{const {s,G,messages}=fixture();s.Enemies.update(G,179);assert.equal(G.enemies.length,0);s.Enemies.update(G,1);assert.equal(G.enemies.length,3);assert.equal(G.flags.nextRaidIn,120);s.Enemies.update(G,120);assert.equal(G.enemies.length,7);assert.equal(messages.length,2);for(const e of G.enemies){assert.ok(e.x>=0&&e.x<60&&e.y>=0&&e.y<40)}});
test('pause and game over freeze raids',()=>{const {s,G}=fixture();G.paused=true;s.Enemies.update(G,500);assert.equal(G.flags.nextRaidIn,180);G.paused=false;G.over='win';s.Enemies.update(G,500);assert.equal(G.enemies.length,0)});
test('carrier priority, damage, loot and escape',()=>{const {s,G}=fixture();G.units=[{x:10,y:10,hp:7,carrying:8}];G.buildings=[{type:'cekimKulesi',x:10,y:10,hp:100}];G.enemies=[{x:10,y:10,hp:45,maxHp:45,home:{x:10,y:10},loot:0}];s.Enemies.update(G,1);assert.equal(G.units[0].hp,0);assert.equal(G.units[0].carrying,null);assert.equal(G.enemies[0].loot,8);assert.equal(G.buildings[0].hp,100);s.Enemies.update(G,1);assert.equal(G.enemies.length,0);assert.equal(G.resources.oz,0)});
test('tower prioritized over crystal; depleted crystal ignored',()=>{const {s,G}=fixture();G.buildings=[{type:'cekimKulesi',x:1,y:1,hp:100}];G.crystals=[{x:1,y:1,amount:9}];G.enemies=[{x:1,y:1,hp:45,home:{x:0,y:0},loot:0}];s.Enemies.update(G,1);assert.equal(G.buildings[0].hp,93);G.buildings=[];s.Enemies.update(G,1);assert.equal(G.crystals[0].amount,4);assert.equal(G.enemies[0].loot,5)});
test('dead enemies rewarded exactly once',()=>{const {s,G}=fixture();G.enemies=[{hp:0,x:0,y:0}];s.Enemies.update(G,1);s.Enemies.update(G,1);assert.equal(G.resources.oz,3);assert.equal(G.enemies.length,0)});
test('all UI panels and all original art render without APIs',()=>{const {s,G,ctx}=fixture();for(const type of ['merkez','yavru','karakol','laboratuvar','member']){G.ui.selected={type,hp:30,colonyId:type==='member'?1:null};s.UI.drawUI(ctx,G)}for(const over of ['win','lose']){G.over=over;s.UI.drawUI(ctx,G)}for(const id of ['merkez','ev','tasOcagi','cekimKulesi','karakol','taret','laboratuvar','isci','asker','bilimci','yavru','yumurta','akinci','koloni','kralice','sarmasik','kristal','meteor','isiltı'])s.Art.draw(ctx,id,0,0,40,{time:1});});
test('build buttons set buildMode, disabled costs consume clicks',()=>{const {s,G,ctx}=fixture();s.UI.drawUI(ctx,G);assert.equal(s.UI.onClick(G,{sx:20,sy:740}),true);assert.equal(G.ui.buildMode,'ev');s.UI.onClick(G,{sx:220,sy:740});assert.equal(G.ui.buildMode,'ev');assert.equal(s.UI.onClick(G,{sx:2,sy:5}),true);assert.equal(s.UI.onClick(G,{sx:600,sy:350}),false)});
test('missing actions disabled, available feed invokes API',()=>{const {s,G,ctx}=fixture();G.ui.selected={type:'yavru'};s.UI.drawUI(ctx,G);assert.equal(s.UI.onClick(G,{sx:920,sy:180}),true);let called=0;s.City={feed:(g,y,type)=>{assert.equal(type,'isci');called++}};s.UI.drawUI(ctx,G);s.UI.onClick(G,{sx:920,sy:180});assert.equal(called,1)});
test('end screen consumes world clicks and restarts',()=>{const {s,G,ctx}=fixture();G.over='win';s.UI.drawUI(ctx,G);assert.equal(s.UI.onClick(G,{sx:1,sy:300}),true);s.UI.onClick(G,{sx:500,sy:460});assert.equal(s.reloaded,true)});
