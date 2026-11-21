import assert from 'node:assert/strict';
import test from 'node:test';
import { bearerCredential } from '../src/lib/bearer-credential';

test('accepts exactly one Bearer credential', () => {
  assert.equal(bearerCredential('Bearer abc.def.ghi'), 'abc.def.ghi');
});
test('rejects ambiguous or malformed authorization headers', () => {
  for (const value of [undefined, '', 'Basic abc', 'Bearer', 'Bearer ', 'Bearer a b', 'Bearer a\tb', 'Bearer\na', 'bearer a', 'Bearer a,b', 'Bearer a\r\nX: y']) {
    assert.equal(bearerCredential(value), undefined, String(value));
  }
});
