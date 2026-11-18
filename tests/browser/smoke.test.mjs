import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

async function waitForServer(url) {
  for(let i=0;i<75;i++){
    try{const response=await fetch(url);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,800));
  }
  throw new Error('Local Vite server did not start');
}
test('actual Chromium paints and replays the Excalidraw whiteboard',{timeout:120000},async()=>{
  const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','5177'],{stdio:'ignore'});
  let browser;
  try{
    const url='http://127.0.0.1:5177/tests/browser/index.html';
    await waitForServer(url);
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.goto(url,{waitUntil:'networkidle',timeout:50000});
    await page.locator('.excalidraw').waitFor({state:'visible',timeout:25000});
    assert.ok(await page.locator('.excalidraw canvas').count()>0,'Excalidraw mounted its canvas');
    await page.getByTestId('draw-step').click();
    await page.waitForTimeout(3500);
    assert.equal((await page.getByTestId('event-count').textContent())?.trim(),'1');
    assert.equal(pageErrors.length,0,'no uncaught React or Excalidraw error: '+pageErrors.join('; '));
    await mkdir('artifacts',{recursive:true});
    await page.screenshot({path:'artifacts/whiteboard-after-drawing.png',fullPage:true});
    await page.getByTestId('draw-step').click();
    await page.getByTestId('toggle-grid').click();
    await page.waitForTimeout(3500);
    assert.equal((await page.getByTestId('event-count').textContent())?.trim(),'2');
    assert.equal(pageErrors.length,0,'no uncaught drawing error');
    await page.getByTestId('reset').click();
    await page.waitForTimeout(650);
    assert.equal((await page.getByTestId('event-count').textContent())?.trim(),'0');
    assert.equal(pageErrors.length,0,'no uncaught reset error');
  }finally{
    if(browser)await browser.close();
    server.kill('SIGTERM');
  }
});
