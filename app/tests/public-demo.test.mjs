import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicDemoHost } from '../src/publicDemo.mjs';
test('static review host is separated from local and private API environments', () => {
 assert.equal(isPublicDemoHost('smihara-ux.github.io'), true);
 for (const host of ['localhost','127.0.0.1','life-id.tailbe6181.ts.net','smihara-ux.github.io.example.com',undefined]) assert.equal(isPublicDemoHost(host), false);
});
