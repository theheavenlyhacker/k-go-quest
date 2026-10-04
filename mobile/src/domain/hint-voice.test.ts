import { describe, expect, it } from 'vitest';
import { HINT_LANGUAGES, matchVoice } from './hint-voice';

const v = (language: string, identifier = language) => ({ identifier, language });

describe('matchVoice', () => {
  it('matches English by primary subtag', () => {
    expect(matchVoice('en', [v('fil-PH'), v('en-US')])?.language).toBe('en-US');
  });
  it('matches Tagalog with a Filipino or Tagalog voice, tolerating underscores', () => {
    expect(matchVoice('tl', [v('en-US'), v('fil_PH')])?.language).toBe('fil_PH');
    expect(matchVoice('tl', [v('tl-PH')])?.language).toBe('tl-PH');
  });
  it('never uses the Filipino voice for Cebuano or Ilocano', () => {
    expect(matchVoice('ceb', [v('fil-PH'), v('en-US')])).toBeNull();
    expect(matchVoice('ilo', [v('fil-PH'), v('tl-PH')])).toBeNull();
  });
  it('matches Cebuano and Ilocano only with their own voice', () => {
    expect(matchVoice('ceb', [v('ceb-PH')])).not.toBeNull();
    expect(matchVoice('ilo', [v('ilo-PH')])).not.toBeNull();
  });
  it('returns null for no voices or an unknown language', () => {
    expect(matchVoice('en', [])).toBeNull();
    expect(matchVoice('xx', [v('en-US')])).toBeNull();
  });
  it('lists the four Hint languages', () => {
    expect(HINT_LANGUAGES.map((l) => l.code)).toEqual(['en', 'tl', 'ceb', 'ilo']);
  });
});
