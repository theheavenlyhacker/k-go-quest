export const HINT_LANGUAGES = [
  { code: 'en', label: 'English', voiceTags: ['en'] },
  { code: 'tl', label: 'Tagalog', voiceTags: ['fil', 'tl'] },
  { code: 'ceb', label: 'Cebuano', voiceTags: ['ceb'] },
  { code: 'ilo', label: 'Ilocano', voiceTags: ['ilo'] },
] as const;

export interface InstalledVoice { identifier: string; language: string }

/**
 * The installed voice for a Hint language, or null. Matches on the primary
 * language subtag only, so a Filipino voice never reads Cebuano or Ilocano.
 */
export function matchVoice<V extends InstalledVoice>(code: string, voices: readonly V[]): V | null {
  const tags: readonly string[] = HINT_LANGUAGES.find((l) => l.code === code)?.voiceTags ?? [];
  return voices.find((voice) => tags.includes(voice.language.split(/[-_]/)[0].toLowerCase())) ?? null;
}
