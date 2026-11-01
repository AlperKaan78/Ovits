const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
process.env.PREVIEW_PORT='4176';const server=require('./serve-preview.cjs');
(async()=>{const browser=await chromium.launch({headless:true,timeout:30000,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR:',e.message);});
async function settle(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}
console.log('Browser ready');await page.goto('http://127.0.0.1:4176/assets/game3d.html',{waitUntil:'domcontentloaded'});console.log('HTML loaded');
await page.waitForFunction(()=>window.game3d?.view.modelCount>4||document.querySelector('#error').textContent);assert.equal(await page.locator('#error').isVisible(),false);console.log('3D ready');
await page.keyboard.press('Space');
await page.mouse.click(70,130);assert.equal(await page.evaluate(()=>Game.G.ui.selection[0].kind),'isci');
await settle();await page.waitForFunction(()=>Number.isFinite(Game.G.ui.selectionPanelTop));
const panel=await page.evaluate(()=>Game.G.ui.selectionPanelTop);
await page.mouse.click(1200,panel+110);assert.equal(await page.evaluate(()=>Game.G.ui.commandMode),'move');
async function point(x,y,h=0){return page.evaluate(async({x,y,h})=>{const {THREE}=await import('./art3d.js');const G=Game.G,p=new THREE.Vector3(x-G.map.w/2,h,y-G.map.h/2).project(game3d.view.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},{x,y,h});}
let p=await point(12.5,23.5);await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>Game.G.ui.selection[0].order.type),'move');
console.log('Roster and movement passed');
// Real worker/plant state, then actual harvest UI clicks and drag input.
await page.evaluate(()=>{const G=Game.G,u=G.ui.selection[0];u.order=null;u.x=12;u.y=22;Game.centerOn(G,12,22);for(const [x,y]of [[14,22],[14,23],[15,22],[15,23]])G.map.vine[Game.idx(G,x,y)]=1;});await page.waitForTimeout(100);
await page.mouse.click(1200,panel+200);assert.equal(await page.evaluate(()=>Game.G.ui.commandMode),'harvest');
const a=await point(13.8,21.8),b=await point(15.8,23.8);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();assert.ok(await page.evaluate(()=>game3d.tasks.jobCount>0));
await page.evaluate(()=>{const G=Game.G,city=Game.modules.find(m=>m.name==='city');for(let i=0;i<400;i++){G.time+=.1;city.update(G,.1);game3d.tasks.update();}});assert.ok(await page.evaluate(()=>Game.G.res.lif>=4&&Game.G.res.ozsu>=4));console.log('Selected-area vine harvest passed');
await page.evaluate(()=>{const G=Game.G;Game.addUnit(G,{kind:'bilimci',owner:'player',x:13,y:22,hp:40,state:'idle'});Game.addBuilding(G,'lab',16,23);});await settle();await page.mouse.click(70,250);assert.equal(await page.evaluate(()=>Game.G.ui.selection[0].kind),'bilimci');await settle();await page.mouse.click(1200,panel+155);p=await point(17,24,.3);await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>Game.G.ui.selection[0].order.type),'lab');
await page.evaluate(()=>{const G=Game.G,city=Game.modules.find(m=>m.name==='city');for(let i=0;i<120;i++){G.time+=.1;city.update(G,.1);}const soldier=G.units.find(u=>u.kind==='asker');G.enemies.push({id:Game.newId(),x:soldier.x+2,y:soldier.y,hp:50,maxHp:50,hitT:0,step:0});});await page.mouse.click(70,220);assert.equal(await page.evaluate(()=>Game.G.ui.selection[0].kind),'asker');await settle();await page.mouse.click(1200,panel+155);const enemy=await page.evaluate(()=>({x:Game.G.enemies[0].x,y:Game.G.enemies[0].y}));p=await point(enemy.x,enemy.y,.25);await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>Game.G.ui.selection[0].order.type),'attack');console.log('Scientist laboratory and soldier attack commands passed');
await page.mouse.click(1317,170);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>Game.G.ui.commandMode),null);
await page.evaluate(()=>{const G=Game.G;Game.centerOn(G,12,22);G.ui.selected=null;G.ui.selection=[];G.meteors=[{x:14,y:22,type:'kaya',t:.2,t0:15,sx:14,sy:22,ang:0}];});await page.waitForFunction(()=>game3d.view.warningCount===1);await page.waitForFunction(()=>game3d.audio.ready);
await page.evaluate(()=>{Game.G.meteors=[];Game.G.time+=.2;});await page.waitForFunction(()=>game3d.audio.impactCount>0);console.log('Meteor synthesized audio scheduled');
await page.mouse.wheel(0,600);await page.waitForTimeout(200);await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(200);await page.screenshot({path:path.join(__dirname,'demo-commands.png'),timeout:60000});assert.deepEqual(errors,[]);console.log('PASS: 3D roster, left-click orders, area harvest resources, top-right mini map, meteor audio.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
