/* Usage: node assets/browser-check.cjs. Requires Playwright on NODE_PATH. */
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os');
const output=process.env.TEST_OUTPUT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'ovits-legacy-check-'));fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:1050}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname,'preview.html')).href);
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(output,'art-preview.png'),fullPage:true});
    await page.goto(pathToFileURL(path.join(__dirname,'ui-preview.html')).href);
    await page.waitForTimeout(100);
    const canvas=page.locator('canvas'),box=await canvas.boundingBox();
    await canvas.click({position:{x:30*box.width/1200,y:740*box.height/800}});
    assert.equal(await page.evaluate(()=>G.ui.buildMode),'ev');
    await canvas.click({position:{x:1050*box.width/1200,y:55*box.height/800}});
    assert.equal(await page.evaluate(()=>G.paused),true);
    await page.selectOption('select','yavru');
    await page.waitForTimeout(50);
    await page.screenshot({path:path.join(output,'ui-preview.png'),fullPage:true});
    await page.selectOption('select','win');
    await page.waitForTimeout(50);
    await page.screenshot({path:path.join(output,'win-preview.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: local file loading, Canvas rendering, build click, pause click, panels, game over; no browser errors.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
