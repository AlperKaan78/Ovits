const {chromium}=require('playwright');
const path=require('node:path'),assert=require('node:assert/strict');
process.env.PREVIEW_PORT=process.env.PREVIEW_PORT||'4174';
const base='http://127.0.0.1:'+process.env.PREVIEW_PORT;
const server=require('./serve-preview.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/assets/three-preview.html');await page.waitForFunction(()=>window.art3dState?.frames>3,{},{timeout:60000});
await page.screenshot({path:path.join(__dirname,'three-settlement.png')});console.log('Scene:',await page.evaluate(()=>window.art3dState));
for(const type of ['isci','kralice','cekimKulesi','ev','akinci','sarmasik','meteor','laboratuvar','taret','karakol','tasOcagi','bilimci','asker','kristal','yavru','yumurta','koloni']){await page.selectOption('select',type);await page.waitForFunction(t=>window.art3dState.mode===t,type);if(['isci','kralice','cekimKulesi'].includes(type)){await page.waitForTimeout(250);await page.screenshot({path:path.join(__dirname,'three-'+type+'.png')});}}
await page.locator('#rotate').click();assert.equal(await page.locator('#rotate').textContent(),'Dönüşü durdur');
await page.selectOption('select','scene');await page.mouse.move(900,450);await page.mouse.down();await page.mouse.move(1000,500);await page.mouse.up();await page.mouse.wheel(0,-100);
await page.setViewportSize({width:700,height:900});await page.waitForTimeout(200);await page.screenshot({path:path.join(__dirname,'three-mobile.png')});assert.deepEqual(errors,[]);console.log('PASS: 17 models, WebGL rendering, camera drag/zoom, rotation, resize; no page errors.');
const integration=await page.evaluate(async()=>{
  const {createGameView}=await import('./three-game.js');const canvas=document.createElement('canvas');canvas.style.cssText='width:640px;height:400px';document.body.append(canvas);const overlay=document.createElement('canvas');overlay.width=640;overlay.height=400;
  window.UI={drawUI(ctx,G){ctx.fillRect(0,0,10,10)},onClick(){return true},onMouseMove(){}};let clicks=0;
  const view=createGameView({canvas,uiCanvas:overlay,onMapClick(){clicks++}});
  const worker={type:'isci',x:30,y:20,hp:20},G={map:{width:60,height:40},buildings:[{type:'ev',x:25,y:20,hp:100}],units:[worker],enemies:[],crystals:[{x:31,y:20,amount:4}],ui:{}};
  view.render(G);const first=view.modelCount;worker.type='asker';G.crystals[0].amount=0;view.render(G);const changed=view.modelCount;
  G.units=[];view.render(G);const removed=view.modelCount;canvas.click();view.dispose();canvas.remove();return {first,changed,removed,clicks};
});assert.deepEqual(integration,{first:3,changed:2,removed:1,clicks:0});assert.deepEqual(errors,[]);console.log('PASS: G adapter spawn, role change, depleted crystal, removal, UI click interception and dispose.');
await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/assets/game3d.html');await page.waitForFunction(()=>window.game3d?.view.modelCount>4);await page.waitForTimeout(200);await page.screenshot({path:path.join(__dirname,'three-game.png')});
assert.equal(await page.locator('#error').isVisible(),false);
const result=await page.evaluate(()=>{const G=game3d.G;for(let i=0;i<1801;i++){G.time+=.1;for(const m of Game.modules)m.update?.(G,.1);G.units=G.units.filter(u=>u.hp>0);G.enemies=G.enemies.filter(e=>e.hp>0);}game3d.view.render(G);return {enemies:G.enemies.length,finite:G.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)),resource:Number.isFinite(G.res.oz)};});assert.ok(result.enemies>=3);assert.equal(result.finite,true);assert.equal(result.resource,true);assert.deepEqual(errors,[]);console.log('PASS: real repository CONFIG/core/colonies/research, 180-second simulation and raid in 3D launcher.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
