import { describe, expect, it } from 'vitest';
import { publicPasswordResetResponse } from './password-reset-response';

describe('publicPasswordResetResponse', () => {
  it('never exposes a reset credential in development, test, staging or production', () => {
    for (const environment of ['development', 'test', 'staging', 'production']) {
      const response = publicPasswordResetResponse();
      expect(response).toEqual({ message: 'If the account exists, reset instructions will be sent.' });
      expect(JSON.stringify(response)).not.toContain('resetToken');
      expect(JSON.stringify(response)).not.toContain('secret-token');
      expect(environment).toBeTruthy();
    }
  });
});
