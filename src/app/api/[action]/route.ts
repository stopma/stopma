import { NextRequest,NextResponse } from 'next/server';
import { admin,auth,configured,db,limit,sameOrigin,visitor } from '@/lib/server';
import { inferCategory,validateContent } from '@/lib/content';
import { z } from 'zod';
export const runtime='nodejs';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 if(!sameOrigin(req))return reply({error:'طلب غير مسموح.'},403);
 if(!configured())return reply({error:'الخدمة مازال ما تفعّلاتش. عاود المحاولة لاحقاً.'},503);
 try{
 const {action}=await params;
 if(!['submit','vote','presence','login','logout','moderate','category'].includes(action))return reply({error:'غير موجود.'},404);
 if(Number(req.headers.get('content-length')||0)>8192)return reply({error:'طلب كبير جداً.'},413);
 const raw=await req.text();if(raw.length>8192)return reply({error:'طلب كبير جداً.'},413);
 let body;try{body=JSON.parse(raw||'{}');}catch{return reply({error:'طلب غير صالح.'},400);}
 if(action==='login'){
 if(!await limit(req,'login',8,900))return reply({error:'محاولات كثيرة. تسنّى 15 دقيقة.'},429);
 const parsed=z.object({email:z.email(),password:z.string().min(1).max(200)}).safeParse(body);if(!parsed.success)return reply({error:'بيانات الدخول غير صالحة.'},400);
 const client=await auth();const {data,error}=await client.auth.signInWithPassword(parsed.data);
 if(error||data.user?.id!==process.env.ADMIN_USER_ID){await client.auth.signOut();return reply({error:'تعذر تسجيل الدخول.'},401);}
 const who=await visitor();await db().from('visitors').delete().eq('identifier',who.id);
 return reply({ok:true});
 }
 if(action==='logout'){await (await auth()).auth.signOut();return reply({ok:true});}
 if(action==='moderate'||action==='category'){
 const user=await admin();if(!user)return reply({error:'خاصك تسجل الدخول.'},401);
 if(action==='category'){const p=z.object({id:z.string().regex(/^[a-z][a-z0-9_-]{1,40}$/),label:z.string().trim().min(1).max(40),active:z.boolean()}).safeParse(body);if(!p.success)return reply({error:'فئة غير صالحة.'},400);const {error}=await db().from('categories').upsert(p.data);if(error)throw error;return reply({ok:true});}
 const parsed=z.object({id:z.uuid(),text:z.string(),category:z.string(),status:z.enum(['pending','published','rejected'])}).safeParse(body);if(!parsed.success)return reply({error:'طلب غير صالح.'},400);
 const checked=validateContent(parsed.data.text);if(checked.error)return reply({error:checked.error},400);
 const {error}=await db().rpc('moderate_stop',{p_id:parsed.data.id,p_text:checked.text,p_category:parsed.data.category,p_status:parsed.data.status,p_admin:user.id});if(error)throw error;return reply({ok:true});
 }
 if(process.env.SITE_LAUNCH_READY!=='true')return reply({error:'المنصة قيد التحضير. المشاركات غادي تفتح قريباً.'},503);
 const who=await visitor();
 if(action==='presence'){
 if(await admin())return reply({excluded:true});
 if(!await limit(req,'presence',120,60)||!await limit(req,'heartbeat',1,25,who.id))return reply({error:'عاود من بعد شوية.'},429);
 const {error}=await db().rpc('record_visit',{p_visitor:who.id});if(error)throw error;const {data,error:statsError}=await db().rpc('site_stats');if(statsError)throw statsError;return reply({total:data.total,online:data.online});
 }
 if(!await limit(req,action,action==='submit'?5:40,3600)||!await limit(req,action+'-visitor',action==='submit'?3:30,3600,who.id))return reply({error:'وصلتي للحد المؤقت. عاود من بعد.'},429);
 if(action==='submit'){
 if(body.website)return reply({error:'طلب غير صالح.'},400);
 const checked=validateContent(body.text);if(checked.error)return reply({error:checked.error},400);
 let category=inferCategory(checked.text!);const {data:c}=await db().from('categories').select('id').eq('id',category).eq('active',true).maybeSingle();if(!c)category='other';
 const {error}=await db().from('stops').insert({text:checked.text,category,status:'pending'});if(error)throw error;return reply({ok:true,message:'وصلات الفكرة ديالك. غادي نراجعوها قبل النشر.'},201);
 }
 const parsed=z.uuid().safeParse(body.id);if(!parsed.success)return reply({error:'منشور غير صالح.'},400);
 const {data,error}=await db().rpc('cast_vote',{p_stop:parsed.data,p_visitor:who.id});if(error){if(error.message.includes('not_found'))return reply({error:'هاد STOP ما بقاش متاح.'},404);throw error;}return reply(data);
 }catch{return reply({error:'وقع مشكل مؤقت. عاود المحاولة.'},500);}
}
