import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { canSubmit, connectionDetail, signInProblem, LearnerAccountError, LEARNER_ACCOUNT, FORGOT_PASSWORD } from './sign-in';

describe('signInProblem', () => {
  it('tells a lost connection apart from a wrong password', () => {
    const offline = signInProblem(new ApiError(0, 'Cannot reach the school server.'));
    const wrong = signInProblem(new ApiError(401, 'Invalid credentials'));
    expect(offline.kind).toBe('connection');
    expect(wrong.kind).toBe('credentials');
    expect(offline.message).not.toBe(wrong.message);
  });
  it('names the Teacher or LGU account when a Learner account signs in', () => {
    const problem = signInProblem(new LearnerAccountError());
    expect(problem).toEqual({ kind: 'learner', message: LEARNER_ACCOUNT });
    expect(LEARNER_ACCOUNT).toMatch(/Teacher or LGU/);
  });
  it('does not call a 403 a wrong password, and keeps the server wording for it', () => {
    expect(signInProblem(new ApiError(403, 'Account suspended'))).toEqual({ kind: 'other', message: 'Account suspended' });
  });
  it('treats a server fault as the server, not the password', () => {
    expect(signInProblem(new ApiError(503, 'x')).kind).toBe('other');
    expect(signInProblem(new ApiError(503, 'x')).message).toMatch(/school server/);
  });
  it('points a forgotten password at the LGU Admin', () => {
    expect(FORGOT_PASSWORD).toMatch(/LGU Admin/);
  });
});

describe('canSubmit', () => {
  it('needs a login, a password and no request in flight', () => {
    expect(canSubmit('te', 'password1', false)).toBe(false);
    expect(canSubmit('teacher', 'short', false)).toBe(false);
    expect(canSubmit('teacher', 'password1', true)).toBe(false);
    expect(canSubmit(' teacher ', 'password1', false)).toBe(true);
  });
});

describe('connectionDetail', () => {
  it('names the host a configured build tried', () => {
    expect(connectionDetail('https://kgo-api-production.up.railway.app/api/v1', true))
      .toBe('Tried kgo-api-production.up.railway.app.');
  });

  /**
   * The case that cost an afternoon: the Wi-Fi was fine and the server was up,
   * but the build had no address in it and was talking to the emulator host.
   */
  it('says the build is wrong when no address was compiled in', () => {
    const text = connectionDetail('http://10.0.2.2:3000/api/v1', false);
    expect(text).toContain('10.0.2.2:3000');
    expect(text).toContain('EXPO_PUBLIC_API_URL');
  });

  it('has an answer when there is no address at all', () => {
    expect(connectionDetail(null, false)).toContain('no school server address');
  });
});
