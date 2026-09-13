import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commentInput} from '../src/lib/comments';
const valid={stop_id:'11111111-1111-4111-8111-111111111111',display_name:'RedaCasa',content:'متافق، خاصنا نحافظو على نظافة الحي.'};
test('comment filtering normalizes and blocks links, phones, emails and common abuse in both fields',()=>{
  assert.ok(commentInput.safeParse(valid).success);
  for(const bad of ['','\u200b\u200f','x'.repeat(301),'www.bad.com','https://bad.com','hxxps://bad.com','bit.ly/test','evil[dot]com','test@example.com','test (at) example.com','06 12 34 56 78','٠٦١٢٣٤٥٦٧٨','+۲۱۲۶۱۲۳۴۵۶۷۸','غادي نقتلك','سأقتلك','قَحْبَة','<img src=x onerror=alert(1)>']) {
    assert.equal(commentInput.safeParse({...valid,content:bad}).success,false,bad);
    assert.equal(commentInput.safeParse({...valid,display_name:bad}).success,false,bad);
  }
  const normalized=commentInput.parse({...valid,content:'  تعليق\u200b   عادي  '});assert.equal(normalized.content,'تعليق عادي');
  const spoof=commentInput.parse({...valid,status:'approved',commenter_code:valid.stop_id});assert.ok(!('status' in spoof));assert.ok(!('commenter_code' in spoof));
});
