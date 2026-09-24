import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath } from '../lib/supabase/redirect';
test('auth callback returns only to local paths', () => {
  assert.equal(safeReturnPath('/trainer?tab=students'), '/trainer?tab=students');
  for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', ''])
    assert.equal(safeReturnPath(next), '/');
});
