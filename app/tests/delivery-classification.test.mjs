import test from 'node:test';
import assert from 'node:assert/strict';
import {isConfirmedRejection} from '../src/integration/delivery.mjs';
test('uncertain delivery retains operation identity; explicit rejection permits correction',()=>{
 for(const status of [undefined,408,425,429,500,502,503,504]) assert.equal(isConfirmedRejection(status),false,`retain ${status}`);
 for(const status of [400,401,403,404,409,422]) assert.equal(isConfirmedRejection(status),true,`rejected ${status}`);
});
