import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { canSubmit, signInProblem, LEARNER_ACCOUNT, FORGOT_PASSWORD } from './sign-in';

describe('signInProblem', () => {
  it('tells a lost connection apart from a wrong password', () => {
    const offline = signInProblem(new ApiError(0, 'Cannot reach the school server.'));
    const wrong = signInProblem(new ApiError(401, 'Invalid credentials'));
    expect(offline.kind).toBe('connection');
    expect(wrong.kind).toBe('credentials');
    expect(offline.message).not.toBe(wrong.message);
  });
  it('names the Teacher or LGU account when a Learner account signs in', () => {
    const problem = signInProblem(new Error(LEARNER_ACCOUNT));
    expect(problem).toEqual({ kind: 'learner', message: LEARNER_ACCOUNT });
    expect(LEARNER_ACCOUNT).toMatch(/Teacher or LGU/);
  });
  it('keeps the server wording for anything else', () => {
    expect(signInProblem(new ApiError(500, 'Boom')).message).toBe('Boom');
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
