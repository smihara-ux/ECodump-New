import test from 'node:test';
import assert from 'node:assert/strict';
import { handleInformation } from '../information-handler.mjs';

test('business information routes deny access before reading data or request bodies', async () => {
  let touched = false;
  const unexpected = async () => { touched = true; throw new Error('Must not access information'); };
  for (const [method, path] of [
    ['GET', ''], ['GET', '/documents/article/document'],
    ['GET', '/operations/operation'], ['POST', '/actions/create'],
    ['POST', '/actions/ack'], ['POST', '/actions/publish'],
  ]) {
    await assert.rejects(
      handleInformation({ method, headers: {} }, { query: unexpected },
        new URL('http://localhost/api/direct/information' + path), unexpected),
      error => error.status === 403 && error.message.includes('運営管理画面'),
    );
  }
  assert.equal(touched, false);
});
