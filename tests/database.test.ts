import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('PostgreSQL moderation, votes, RLS, presence and rate limits',async()=>{
 const db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');await db.exec(await readFile('supabase/migrations/202609120001_initial.sql','utf8'));
 try{
 const {rows:[stop]}=await db.query<{id:string;status:string}>("insert into stops(text,category) values('بغيت يوقف رمي الزبل فالزنقة.','environment') returning id,status");assert.equal(stop.status,'pending');
 await assert.rejects(()=>db.query('select cast_vote($1,$2)',[stop.id,'visitor-one']),/not_found/);
 await db.query('select moderate_stop($1,$2,$3,$4,$5)',[stop.id,'بغيت يوقف رمي الزبل فالزنقة.','environment','published','11111111-1111-4111-8111-111111111111']);
 const first=await db.query<{result:{count:number;already:boolean}}>('select cast_vote($1,$2) result',[stop.id,'visitor-one']);assert.deepEqual(first.rows[0].result,{count:1,already:false});
 const repeated=await db.query<{result:{count:number;already:boolean}}>('select cast_vote($1,$2) result',[stop.id,'visitor-one']);assert.deepEqual(repeated.rows[0].result,{count:1,already:true});
 await Promise.all(Array.from({length:10},()=>db.query('select cast_vote($1,$2)',[stop.id,'visitor-two'])));
 const votes=await db.query<{votes_count:number}>('select votes_count from stops where id=$1',[stop.id]);assert.equal(votes.rows[0].votes_count,2);
 await db.query('select record_visit($1)',['browser-one']);await db.query('select record_visit($1)',['browser-one']);await db.query('select record_visit($1)',['browser-two']);
 const stats=await db.query<{result:{total:number;online:number;today:number;votes:number}}>('select site_stats() result');assert.equal(stats.rows[0].result.total,2);assert.equal(stats.rows[0].result.today,2);assert.equal(stats.rows[0].result.online,2);assert.equal(stats.rows[0].result.votes,2);
 await db.exec("update visitors set last_seen=now()-interval '3 minutes' where identifier='browser-one'");const expired=await db.query<{result:{online:number}}>('select site_stats() result');assert.equal(expired.rows[0].result.online,1);
 for(let i=0;i<4;i++){const r=await db.query<{allowed:boolean}>("select take_rate('test',3,60) allowed");assert.equal(r.rows[0].allowed,i<3);}
 await db.exec("update rate_limits set expires_at=now()-interval '1 second'");const reset=await db.query<{allowed:boolean}>("select take_rate('test',3,60) allowed");assert.equal(reset.rows[0].allowed,true);
 await db.exec('set role anon');await assert.rejects(()=>db.query('select * from stops'),/permission denied/);await assert.rejects(()=>db.query('select cast_vote($1,$2)',[stop.id,'attacker']),/permission denied/);await db.exec('reset role');
 await db.exec('set role authenticated');await assert.rejects(()=>db.query("update stops set status='published'"),/permission denied/);await db.exec('reset role');
 await db.query('select moderate_stop($1,$2,$3,$4,$5)',[stop.id,'بغيت يوقف رمي الزبل فالزنقة.','environment','rejected','11111111-1111-4111-8111-111111111111']);await assert.rejects(()=>db.query('select cast_vote($1,$2)',[stop.id,'visitor-three']),/not_found/);
 await db.exec("update stops set updated_at=now()-interval '31 days'; select cleanup_data()");const cleaned=await db.query('select * from stops');assert.equal(cleaned.rows.length,0);
 }finally{await db.close();}
});
