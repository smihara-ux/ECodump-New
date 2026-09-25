import {test} from 'node:test';import assert from 'node:assert/strict';import{locationState}from'../src/driver/locationState.mjs';
test('GPS display distinguishes no fix, acquiring, stale and denied without invented timestamps',()=>{
 assert.equal(locationState(null,false,'',500000),'未取得');
 assert.equal(locationState(null,true,'',500000),'取得中');
 assert.equal(locationState({timestamp:400000},false,'',500000),'取得済み');
 assert.equal(locationState({timestamp:100000},false,'',500000),'古い');
 assert.equal(locationState({timestamp:100000},false,'denied',500000),'取得不可');
});
