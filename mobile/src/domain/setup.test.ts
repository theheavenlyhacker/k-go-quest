import { describe, expect, it } from 'vitest';
import { confirmCaretaker, keepCaretaker, setupStep, signInMessage } from './setup';

describe('setupStep', () => {
  it('walks sign-in, PIN, profiles, done', () => {
    expect(setupStep({ hasCaretaker: false, pinSet: false, done: false })).toBe('sign-in');
    expect(setupStep({ hasCaretaker: true, pinSet: false, done: false })).toBe('caretaker-pin');
    expect(setupStep({ hasCaretaker: true, pinSet: true, done: false })).toBe('profiles');
    expect(setupStep({ hasCaretaker: true, pinSet: true, done: true })).toBe('done');
  });
});

describe('keepCaretaker', () => {
  it('saves the user ID before signing out', async () => {
    const calls: string[] = [];
    await keepCaretaker('user_1', async (id) => { calls.push(`save ${id}`); }, async () => { calls.push('out'); });
    expect(calls).toEqual(['save user_1', 'out']);
  });
  it('still signs out when the save fails', async () => {
    const calls: string[] = [];
    await expect(keepCaretaker('u', async () => { throw new Error('vault'); }, async () => { calls.push('out'); })).rejects.toThrow('vault');
    expect(calls).toEqual(['out']);
  });
});

describe('confirmCaretaker', () => {
  it('accepts the Setup account and signs out', async () => {
    const calls: string[] = [];
    await confirmCaretaker('u1', 'u1', async () => { calls.push('out'); });
    expect(calls).toEqual(['out']);
  });
  it('refuses another account but still signs out', async () => {
    const calls: string[] = [];
    await expect(confirmCaretaker('u2', 'u1', async () => { calls.push('out'); })).rejects.toThrow('not the Caretaker Account');
    expect(calls).toEqual(['out']);
  });
  it('refuses when no account was saved', async () => {
    await expect(confirmCaretaker('u1', null, async () => {})).rejects.toThrow();
  });
});

describe('signInMessage', () => {
  it('explains a missing network and passes other errors through', () => {
    expect(signInMessage('Network request failed')).toContain('network is needed');
    expect(signInMessage('Incorrect code')).toBe('Incorrect code');
  });
});
