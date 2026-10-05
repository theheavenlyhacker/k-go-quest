import { describe, expect, it } from 'vitest';
import { caretakerState, confirmCaretaker, keepCaretaker, setupStep, signInMessage } from './setup';

describe('setupStep', () => {
  it('walks sign-in, PIN, profiles, done', () => {
    expect(setupStep({ hasCaretaker: false, pinSet: false, done: false })).toBe('sign-in');
    expect(setupStep({ hasCaretaker: true, pinSet: false, done: false })).toBe('caretaker-pin');
    expect(setupStep({ hasCaretaker: true, pinSet: true, done: false })).toBe('profiles');
    expect(setupStep({ hasCaretaker: true, pinSet: true, done: true })).toBe('done');
  });
});

describe('caretakerState', () => {
  it('has no Caretaker on a tablet that has not been set up', () => {
    expect(caretakerState(null, false)).toEqual({ present: false, linked: false });
  });

  it('counts a signed-in account as present and linked', () => {
    expect(caretakerState('user_1', false)).toEqual({ present: true, linked: true });
  });

  /**
   * The point of the whole offline path: Setup is satisfied, so a Learner can
   * use the tablet, but nothing can prove who the Caretaker is yet.
   */
  it('counts a network-less Setup as present but not linked', () => {
    expect(caretakerState(null, true)).toEqual({ present: true, linked: false });
  });

  it('treats a later link as linked, whatever the local mark still says', () => {
    expect(caretakerState('user_1', true)).toEqual({ present: true, linked: true });
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
  it('says plainly that nothing is linked rather than blaming the account', async () => {
    // A Caretaker on a tablet set up offline would otherwise be told they used
    // the wrong email, and would keep trying other ones.
    await expect(confirmCaretaker('u1', null, async () => {})).rejects.toThrow(/No Caretaker Account is linked/);
  });
});

describe('signInMessage', () => {
  it('explains a missing network and passes other errors through', () => {
    expect(signInMessage('Network request failed')).toContain('network is needed');
    expect(signInMessage('Incorrect code')).toBe('Incorrect code');
  });
});
