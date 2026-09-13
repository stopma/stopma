// Tests the local app against Supabase using disposable comments only.
// Never publishes the app or changes an existing STOP/comment.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3004';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const tag = 'comment-ui-' + randomUUID().replace(/[0-9-]/g, 'x').slice(0, 18);
const created = new Set();
let browser, app;
async function checked(promise) { const r = await promise; assert.ifError(r.error); return r.data; }
try {
  const [stop] = await checked(db.from('stops').select('id').eq('status','published').limit(1));
  assert.ok(stop, 'A published STOP exists');
  const fixtures = await checked(db.from('comments').insert([
    {stop_id:stop.id,content:tag+' approved',display_name:tag},
    {stop_id:stop.id,content:tag+' rejected',display_name:tag},
    {stop_id:stop.id,content:tag+' pending',display_name:tag},
  ]).select('id'));
  fixtures.forEach(r=>created.add(r.id));
  await checked(db.from('comments').update({status:'approved'}).eq('id',fixtures[0].id));
  await checked(db.from('comments').update({status:'rejected'}).eq('id',fixtures[1].id));
  if (!process.env.TEST_BASE_URL) app = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3004'],{
    env:{...process.env,SITE_LAUNCH_READY:'true',ALLOWED_ORIGINS:base,VISITOR_SECRET:randomUUID()+randomUUID()},stdio:'ignore',windowsHide:true,
  });
  for(let i=0;;i++) { try { if((await fetch(base)).ok)break; }catch{} assert.ok(i<40);await new Promise(r=>setTimeout(r,500)); }
  browser = await chromium.launch({channel:'chrome',headless:true});
  await mkdir('test-results/comments',{recursive:true});
  for (const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600});
    // This test does not contribute to real visitor statistics.
    await context.route('**/api/presence',r=>r.fulfill({json:{excluded:true}}));
    const page = await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    assert.equal(await page.locator('.stop-comments').count(),0);
    await page.goto(base+'/stop/'+stop.id);
    await page.locator('.comment-identity .comment-code').waitFor();
    const originalCode=await page.locator('.comment-identity .comment-code').innerText();
    assert.match(originalCode,/^#[A-F0-9]{12}$/);
    let approved = await checked(db.from('comments').select('id').eq('stop_id',stop.id).eq('status','approved'));
    assert.equal(await page.locator('#comments-title').innerText(),`التعليقات (${approved.length})`);
    assert.equal(await page.locator('.comments-list .comment').count(),approved.length);
    assert.ok((await page.locator('.comments-list').innerText()).includes(tag+' approved'));
    const html = await page.content();
    assert.ok(!html.includes(tag+' pending'));assert.ok(!html.includes(tag+' rejected'));
    await page.locator('#comment-pseudo').fill('RedaCasa'+width);
    await page.locator('#comment-content').fill('x'.repeat(310));
    assert.equal((await page.locator('#comment-content').inputValue()).length,300);
    const text = tag+' submitted '+width;
    await page.locator('#comment-content').fill(text);
    const response=page.waitForResponse(r=>r.url()===base+'/api/comments'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'إرسال التعليق',exact:true}).click();
    const posted=await response;assert.equal(posted.status(),201,JSON.stringify(await posted.json()));
    const [saved]=await checked(db.from('comments').select('*').eq('stop_id',stop.id).eq('content',text));
    created.add(saved.id);assert.equal(saved.status,'pending');assert.equal(saved.display_name,'RedaCasa'+width);
    assert.equal('#'+saved.commenter_code.replaceAll('-','').slice(0,12).toUpperCase(),originalCode);
    await page.getByRole('status').filter({hasText:'وصل التعليق ديالك'}).waitFor();
    assert.equal(await page.locator('#comment-content').inputValue(),'');
    await page.reload();
    await page.locator('.comment-identity .comment-code').waitFor();
    assert.equal(await page.locator('#comment-pseudo').inputValue(),'RedaCasa'+width);
    assert.equal(await page.locator('.comment-identity .comment-code').innerText(),originalCode);
    assert.ok(!(await page.content()).includes(text));
    await page.locator('#comment-content').fill(text);
    const duplicate=page.waitForResponse(r=>r.url()===base+'/api/comments'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'إرسال التعليق',exact:true}).click();
    assert.equal((await duplicate).status(),409);
    await page.getByRole('alert').filter({hasText:'هاد التعليق ترسل من قبل.'}).waitFor();
    assert.equal(await page.locator('#comment-content').inputValue(),text);
    // Check approved transition and code/name/date display through the actual public reader.
    await checked(db.from('comments').update({status:'approved'}).eq('id',saved.id));
    await page.reload();
    const published=page.locator('.comment').filter({hasText:text});
    await published.waitFor();assert.ok((await published.innerText()).includes(originalCode));
    assert.ok((await published.innerText()).includes(saved.display_name));
    assert.ok(await published.locator('time').getAttribute('datetime'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow');
    await page.locator('.stop-comments').screenshot({path:`test-results/comments/${width}.png`});
    // Browser storage restoration across a new tab on the same device.
    const tab=await context.newPage();await tab.goto(base+'/stop/'+stop.id);
    await tab.locator('.comment-identity .comment-code').waitFor();
    assert.equal(await tab.locator('#comment-pseudo').inputValue(),saved.display_name);
    assert.equal(await tab.locator('.comment-identity .comment-code').innerText(),originalCode);
    // API validation and origin checks, without inserting additional comments.
    for(const content of ['', 'x'.repeat(301), 'https://evil.example', 'test@example.com', '٠٦١٢٣٤٥٦٧٨', 'غادي نقتلك']) {
      const result=await context.request.post(base+'/api/comments',{headers:{origin:base},data:{stop_id:stop.id,display_name:'Test',content}});
      assert.equal(result.status(),400);
    }
    const denied=await context.request.post(base+'/api/comments',{headers:{origin:'https://example.org'},data:{stop_id:stop.id,display_name:'Test',content:'غير مسموح'}});
    assert.equal(denied.status(),403);
    const badPseudo=await context.request.post(base+'/api/comments',{headers:{origin:base},data:{stop_id:stop.id,display_name:'www.spam.com',content:'تعليق عادي'}});
    assert.equal(badPseudo.status(),400);
    let rateBlocked=false;
    for(let n=0;n<6;n++) {
      const result=await page.evaluate(async data => {const r=await fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.status;},{stop_id:stop.id,display_name:'TestRate',content:tag+' ratetest '+width+' item '+n,status:'approved',commenter_code:'11111111-1111-4111-8111-111111111111'});
      if(result===429){rateBlocked=true;break;}
      assert.equal(result,201);
      const [row]=await checked(db.from('comments').select('status,commenter_code').eq('content',tag+' ratetest '+width+' item '+n));
      assert.equal(row.status,'pending');assert.equal(row.commenter_code,saved.commenter_code);
    }
    assert.ok(rateBlocked,'Device rate limit enforced');
    assert.deepEqual(errors,[]);
    console.log('PASS',width,'px: real pending insert, pseudo/code persistence, approved-only rendering, date/count, duplicate feedback, validation, no overflow/browser errors.');
    await context.close();
  }
} finally {
  await browser?.close();app?.kill();
  // Includes a submission if the test stopped immediately after its insert.
  const {data,error}=await db.from('comments').select('id').like('content',tag+'%');
  assert.ifError(error);data.forEach(r=>created.add(r.id));
  if(created.size)await checked(db.from('comments').delete().in('id',[...created]));
  console.log('Disposable comments removed. Existing data unchanged. No deployment.');
}
