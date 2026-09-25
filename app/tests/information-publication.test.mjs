import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationState} from '../src/information/publicationState.mjs';
test('publication boundaries and withdrawal take precedence over scheduled window',()=>{
 const start=Date.parse('2026-09-25T00:00:00Z'),end=start+3600000;
 const a={status:'published',data:{start:new Date(start).toISOString(),end:new Date(end).toISOString()}};
 assert.equal(publicationState(a,start-1),'公開前');assert.equal(publicationState(a,start),'公開中');assert.equal(publicationState(a,end-1),'公開中');assert.equal(publicationState(a,end),'期限切れ');
 assert.equal(publicationState({...a,status:'withdrawn'},start),'取下げ');assert.equal(publicationState({...a,status:'draft'},start),'下書き');
 assert.equal(publicationState({...a,data:{start:'invalid',end:'invalid'}},start),'公開期間を確認してください');
});
