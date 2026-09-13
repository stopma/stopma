import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('comments: pending by default, validation, RLS, admin operations and spam limits', async () => {
  const db = new PGlite();
  const admin='7d205d2d-e946-4815-afe2-c54a6c6bff49';
  const normal='11111111-1111-4111-8111-111111111111';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values('${admin}'),('${normal}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;`);
    await db.exec(await readFile('supabase/migrations/202609120001_initial.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/202609130001_comments.sql','utf8'));
    const {rows:[stop]}=await db.query<{id:string}>("insert into stops(text,status) values('اختبار منع رمي النفايات','published') returning id");
    const {rows:[hidden]}=await db.query<{id:string}>("insert into stops(text) values('اختبار مشاركة غير منشورة') returning id");
    const insert=(text:string,code=normal)=>db.query('insert into comments(stop_id,content,commenter_code) values($1,$2,$3)',[stop.id,text,code]);
    await db.exec('set role anon');
    for(const bad of ['', '   \n\t', 'x'.repeat(301)]) await assert.rejects(()=>insert(bad));
    await assert.rejects(()=>db.query('insert into comments(stop_id,content) values($1,$2)',[hidden.id,'محتوى صالح']));
    await assert.rejects(()=>db.query("insert into comments(stop_id,content,status) values($1,'محتوى صالح','approved')",[stop.id]));
    await insert('  تعليق أول  ');
    await assert.rejects(()=>insert('تعليق    أول',admin),/duplicate/);
    assert.equal((await db.query('select * from comments')).rows.length,0);
    await assert.rejects(()=>db.exec("update comments set status='approved'"));
    await db.exec('reset role');
    const {rows:[comment]}=await db.query<{id:string,status:string,content:string,updated_at:Date}>('select * from comments');
    assert.equal(comment.status,'pending');assert.equal(comment.content,'تعليق أول');
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${normal}',false);`);
    assert.equal((await db.query("update comments set status='approved' returning id")).rows.length,0);
    assert.equal((await db.query('delete from comments returning id')).rows.length,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false);`);
    assert.equal((await db.query('select * from comments')).rows.length,1);
    await db.query("update comments set content='تعليق بعد المراجعة',status='approved' where id=$1",[comment.id]);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from comments')).rows.length,1);
    await db.exec("reset role; update stops set status='pending'; set role anon;");
    assert.equal((await db.query('select * from comments')).rows.length,0);
    await db.exec(`reset role; update stops set status='published'; set role authenticated; select set_config('request.jwt.claim.sub','${admin}',false);`);
    await db.query("update comments set status='rejected' where id=$1",[comment.id]);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from comments')).rows.length,0);
    for(let i=0;i<4;i++)await insert('مشاركة مختلفة '+i);
    await assert.rejects(()=>insert('المشاركة السادسة'),/comment_rate_limited/);
    for(let i=0;i<25;i++)await insert('محتوى فريد '+i,`22222222-2222-4222-8222-${String(i).padStart(12,'0')}`);
    await assert.rejects(()=>insert('تغيير الرمز لا يتجاوز السقف',admin),/comment_rate_limited/);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${admin}',false);`);
    assert.equal((await db.query('delete from comments where id=$1 returning id',[comment.id])).rows.length,1);
    await db.exec('reset role');
    await db.exec(await readFile('supabase/migrations/202609130002_comment_submission_gateway.sql','utf8'));
    for(const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      await assert.rejects(()=>insert('لا يمكن تجاوز مسار الموقع',admin),/permission denied/);
      await db.exec('reset role');
    }
  } finally { await db.close(); }
});
