const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
process.env.PREVIEW_PORT=process.env.PREVIEW_PORT||'4175';const base='http://127.0.0.1:'+process.env.PREVIEW_PORT,server=require('./serve-preview.cjs');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
const page=await browser.newPage(),errors=[];await page.setViewportSize({width:1440,height:1000});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(base+'/assets/game3d.html');await page.waitForFunction(()=>window.game3d?.view.modelCount>4);
await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>Game.G.paused),true);
await page.keyboard.press('e');assert.equal(await page.evaluate(()=>Game.G.ui.buildMode),'ev');
await page.locator('#world').click({button:'right',position:{x:800,y:400}});assert.equal(await page.evaluate(()=>Game.G.ui.buildMode),null);
await page.keyboard.press('e');
async function mapPoint(x,y,height=0){return page.evaluate(async({x,y,height})=>{const {THREE}=await import('./art3d.js');const G=Game.G,p=new THREE.Vector3(x-G.map.w/2,height,y-G.map.h/2).project(game3d.view.camera),r=document.querySelector('#world').getBoundingClientRect();return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2};},{x,y,height});}
const initial=await page.evaluate(()=>Game.G.buildings.length),point=await mapPoint(12.5,22.5);await page.mouse.move(point.x,point.y);await page.waitForTimeout(100);await page.mouse.click(point.x,point.y);
assert.equal(await page.evaluate(()=>Game.G.buildings.length),initial+1);assert.equal(await page.evaluate(()=>Game.G.ui.buildMode),null);
// Raycast the visible facade: selection must use the object rather than ground behind it.
const buildingPoint=await mapPoint(12.5,22.5,.3);await page.mouse.click(buildingPoint.x,buildingPoint.y);assert.equal(await page.evaluate(()=>Game.G.ui.selected?.type),'ev');
await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>Game.G.ui.selected),null);
const worker=await page.evaluate(()=>{const u=Game.G.units.find(u=>u.kind==='isci');return {x:u.x,y:u.y};});const workerScreen=await mapPoint(worker.x,worker.y,.3);await page.mouse.click(workerScreen.x,workerScreen.y);assert.equal(await page.evaluate(()=>Game.G.ui.selection[0]?.kind),'isci');
const movePoint=await mapPoint(11.5,24.5);await page.mouse.click(movePoint.x,movePoint.y,{button:'right'});assert.equal(await page.evaluate(()=>Game.G.ui.selection[0]?.order?.type),'move');
const unitPositions=await page.evaluate(()=>Game.G.units.filter(u=>u.owner==='player').map(u=>({x:u.x,y:u.y}))),projected=[];for(const u of unitPositions)projected.push(await mapPoint(u.x,u.y));const bounds={x0:Math.min(...projected.map(p=>p.x))-18,x1:Math.max(...projected.map(p=>p.x))+18,y0:Math.min(...projected.map(p=>p.y))-18,y1:Math.max(...projected.map(p=>p.y))+18};await page.mouse.move(bounds.x0,bounds.y0);await page.mouse.down();await page.mouse.move(bounds.x1,bounds.y1,{steps:8});await page.mouse.up();assert.ok(await page.evaluate(()=>Game.G.ui.selection.length>=2));await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>Game.G.ui.selection.length),0);
// Deterministic scenario setup; subsequent actions use actual buttons/keyboard APIs.
await page.evaluate(()=>{const G=Game.G;const child=Game.addUnit(G,{kind:'yavru',owner:'player',x:10,y:20,hp:25,food:null});G.ui.selected=child;});await page.waitForTimeout(100);
await page.mouse.click(1180,185);assert.equal(await page.evaluate(()=>Game.G.ui.selected.food),'isci');
await page.keyboard.press('Escape');
await page.evaluate(()=>{const G=Game.G;G.time=46;G.flags.nextWaveIn=14;G.meteors=[{x:13,y:18,type:'kaya',t:14,t0:15,sx:13,sy:18,ang:0}];});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>game3d.view.warningCount),1);
await page.screenshot({path:path.join(__dirname,'demo-warning.png')});
await page.evaluate(()=>{Game.G.meteors[0].t=.2;});await page.waitForTimeout(100);await page.evaluate(()=>{Game.G.meteors=[];Game.G.time+=.2;});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>game3d.view.impactCount>0));
await page.evaluate(()=>{const G=Game.G;G.ui.selected=null;G.meteors=[];G.time=0;});await page.keyboard.press('Space');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Game.G.paused),false);
await page.keyboard.press('2');assert.equal(await page.evaluate(()=>Game.G.speed),2);
await page.keyboard.press('3');assert.equal(await page.evaluate(()=>Game.G.speed),3);
await page.mouse.wheel(0,-100);await page.keyboard.press('ArrowRight');
await page.evaluate(()=>{Game.G.res.oz=Game.G.cfg.win.oz;});await page.waitForFunction(()=>Game.G.over==='win');await page.screenshot({path:path.join(__dirname,'demo-win.png')});
await page.mouse.click(600,570);await page.waitForFunction(()=>window.Game?.G?.time<5&&Game.G.over===null);
await page.evaluate(()=>{Game.merkez(Game.G).hp=0;});await page.waitForFunction(()=>Game.G.over==='lose');await page.screenshot({path:path.join(__dirname,'demo-lose.png')});
assert.equal(await page.locator('#error').isVisible(),false);
console.log('PASS: 3D actual building placement, raycast selection, keyboard, right-click cancel, feeding button, meteor warning/impact, speed, win, reload and defeat.');
// Reproduce the reported issue without selecting a small hatchling or injecting units.
await page.reload();await page.waitForFunction(()=>window.game3d?.view.modelCount>4);
const populationBefore=await page.evaluate(()=>{const G=Game.G;G.paused=true;const before=UI.population(G);const city=Game.modules.find(m=>m.name==='city');for(let i=0;i<Math.ceil((G.cfg.buildings.ev.eggEvery+G.cfg.population.hatchTime+1)*10);i++){G.time+=.1;city.update(G,.1);}return {adults:before.adults.length,soldiers:before.soldiers.length,ready:UI.population(G).waiting.length};});assert.ok(populationBefore.ready>0);
await page.waitForTimeout(100);await page.mouse.click(300,870);
assert.equal(await page.evaluate(()=>Game.G.units.some(u=>u.kind==='yavru'&&u.food==='asker')),true);
const populationAfter=await page.evaluate(()=>{const G=Game.G,city=Game.modules.find(m=>m.name==='city');for(let i=0;i<Math.ceil((G.cfg.population.growTime+1)*10);i++){G.time+=.1;city.update(G,.1);}const p=UI.population(G);return {adults:p.adults.length,soldiers:p.soldiers.length};});assert.equal(populationAfter.adults,populationBefore.adults+1);assert.equal(populationAfter.soldiers,populationBefore.soldiers+1);await page.waitForTimeout(100);await page.screenshot({path:path.join(__dirname,'demo-population.png')});console.log('PASS: naturally produced egg hatches, global Soldier button feeds it, soldier and adult population counts rise.');
// Original 2D entry must still work from file:// and preserve module compatibility.
const {pathToFileURL}=require('node:url');await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);await page.waitForFunction(()=>Game.G?.buildings.length>=2);
await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>Game.G.paused),false);
await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>Game.G.paused),true);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>Game.G.ui.buildMode),'ev');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>Game.G.ui.buildMode),null);
await page.screenshot({path:path.join(__dirname,'demo-2d.png')});assert.deepEqual(errors,[]);console.log('PASS: 2D file:// entry, keyboard, UI, zero page or console errors.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
