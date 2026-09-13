import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedOrigin} from '../src/lib/origin';
test('custom domain CSRF allowlist matches exact origins only',()=>{
 const site='https://stop.ma';
 const extra='https://www.stop.ma, https://stop-ma.vercel.app';
 for(const origin of [site,'https://www.stop.ma','https://stop-ma.vercel.app']) assert.equal(allowedOrigin(origin,site,extra),true);
 for(const origin of [null,'null','https://evil.example','https://stop.ma.evil.example','http://stop.ma','https://stop.ma:444','https://evil.example/https://stop.ma','https://stop.ma/']) assert.equal(allowedOrigin(origin,site,extra),false);
 assert.equal(allowedOrigin('https://evil.example',site,'*,invalid'),false);
 assert.equal(allowedOrigin('http://localhost:3000','http://localhost:3000'),true);
});
