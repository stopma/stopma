// Local UI + real Supabase integration. Only one disposable comment is modified.
// Uses the previously authorized temporary admin session; never prints credentials.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3004';
const tag='admin-comment-'+randomUUID().replace(/[0-9-]/g,'x').slice(0,14);
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const jar=new Map();
const auth=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
async function checked(promise){const r=await promise;assert.ifError(r.error);return r.data;}
let browser,app,id;
try {
 const [stop,other]=await checked(db.from('stops').select('id,text').eq('status','published').limit(2));assert.ok(stop);
 if (!process.env.TEST_BASE_URL) app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3004'],{env:{...process.env,SITE_LAUNCH_READY:'true',ALLOWED_ORIGINS:base,VISITOR_SECRET:randomUUID()+randomUUID()},stdio:'ignore',windowsHide:true});
 for(let i=0;;i++){try{if((await fetch(base)).ok)break;}catch{}assert.ok(i<50);await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({channel:'chrome',headless:true});
 const publicContext=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
 await publicContext.route('**/api/presence',r=>r.fulfill({json:{excluded:true}}));
 const page=await publicContext.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/stop/'+stop.id);await page.locator('.comment-identity .comment-code').waitFor();
 await page.locator('#comment-pseudo').fill('TestPseudo');await page.locator('#comment-content').fill(tag);
 const sent=page.waitForResponse(r=>r.url()===base+'/api/comments'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'إرسال التعليق',exact:true}).click();assert.equal((await sent).status(),201);
 let [saved]=await checked(db.from('comments').select('*').eq('stop_id',stop.id).eq('content',tag));id=saved.id;assert.equal(saved.status,'pending');
 await page.reload();assert.ok(!(await page.content()).includes(tag));
 const denied=await publicContext.request.post(base+'/api/comments/moderate',{headers:{origin:base},data:{id,action:'approve',updated_at:saved.updated_at,content:tag,display_name:'TestPseudo'}});assert.equal(denied.status(),401);
 const {user}=await checked(db.auth.admin.getUserById(process.env.ADMIN_USER_ID));
 const link=await checked(db.auth.admin.generateLink({type:'magiclink',email:user.email}));
 const session=await checked(auth.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'}));assert.equal(session.user.id,process.env.ADMIN_USER_ID);
 const adminContext=await browser.newContext({viewport:{width:1440,height:1000}});
 await adminContext.addCookies([...jar].map(([name,value])=>({name,value,url:base,httpOnly:true,sameSite:'Lax'})));
 const adminPage=await adminContext.newPage();adminPage.on('pageerror',e=>errors.push(e.message));
 await adminPage.goto(base+'/admin');
 const card=()=>adminPage.locator(`[data-comment-id="${id}"]`);
 await card().waitFor();assert.ok((await card().innerText()).includes(saved.commenter_code));
 assert.equal(await card().getByRole('link',{name:stop.text,exact:true}).getAttribute('href'),'/stop/'+stop.id);
 assert.ok(await card().locator('time').getAttribute('datetime'));
 await mkdir('test-results/comment-admin',{recursive:true});
 await card().screenshot({path:'test-results/comment-admin/desktop.png'});
 async function action(label){const response=adminPage.waitForResponse(r=>r.url()===base+'/api/comments/moderate'&&r.request().method()==='POST');await card().getByRole('button',{name:label,exact:true}).click();const r=await response;assert.equal(r.status(),200,JSON.stringify(await r.json()));}
 async function tab(label,status){await adminPage.getByRole('navigation',{name:'حالة التعليقات'}).getByRole('link',{name:label,exact:true}).click();await adminPage.waitForURL(u=>u.searchParams.get('comment_status')===status);await card().waitFor();}
 await action('موافقة ونشر');
 saved=await checked(db.from('comments').select('*').eq('id',id).single());assert.equal(saved.status,'approved');
 await page.reload();await page.locator('.comment').filter({hasText:tag}).waitFor();
 if(other){const r=await fetch(base+'/stop/'+other.id);assert.ok(!(await r.text()).includes(tag),'Comment belongs only to its STOP');}
 await tab('المعتمدة','approved');
 await card().locator('textarea').fill(tag+' edited');await card().locator('input').fill('EditedPseudo');
 await action('حفظ التعديل');
 await page.reload();const published=page.locator('.comment').filter({hasText:tag+' edited'});await published.waitFor();assert.ok((await published.innerText()).includes('EditedPseudo'));
 const stale=await adminContext.request.post(base+'/api/comments/moderate',{headers:{origin:base},data:{id,action:'delete',updated_at:saved.updated_at}});assert.equal(stale.status(),409);
 await adminPage.reload();await card().waitFor();await action('رفض');
 assert.equal((await checked(db.from('comments').select('status').eq('id',id).single())).status,'rejected');
 await page.reload();assert.ok(!(await page.content()).includes(tag));
 await tab('المرفوضة','rejected');
 await adminPage.setViewportSize({width:390,height:900});await card().screenshot({path:'test-results/comment-admin/mobile.png'});
 assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No admin mobile overflow');
 await card().getByRole('button',{name:'حذف',exact:true}).click();await card().getByRole('button',{name:'إلغاء',exact:true}).click();
 assert.ok(await checked(db.from('comments').select('id').eq('id',id).single()));
 await action('موافقة ونشر');await page.reload();await page.locator('.comment').filter({hasText:tag+' edited'}).waitFor();
 await tab('المعتمدة','approved');await card().getByRole('button',{name:'حذف',exact:true}).click();await action('تأكيد الحذف');
 assert.equal((await checked(db.from('comments').select('id').eq('id',id))).length,0);
 await page.reload();assert.ok(!(await page.content()).includes(tag));assert.deepEqual(errors,[]);
 const badOrigin=await adminContext.request.post(base+'/api/comments/moderate',{headers:{origin:'https://example.org'},data:{id,action:'delete',updated_at:saved.updated_at}});assert.equal(badOrigin.status(),403);
 console.log('PASS: local Pending submission → Admin Approve → correct STOP; Edit/name update; Reject hidden; Delete removed; cancel safe; stale-write guard; unauthorized/CSRF blocked; desktop/mobile no browser errors/overflow.');
}finally{
 await browser?.close();app?.kill();
 const rows=await checked(db.from('comments').select('id').like('content',tag+'%'));
 if(rows.length)await checked(db.from('comments').delete().in('id',rows.map(r=>r.id)));
 await auth.auth.signOut({scope:'local'});
 console.log('Only disposable comment removed; temporary admin session signed out. No deployment.');
}
