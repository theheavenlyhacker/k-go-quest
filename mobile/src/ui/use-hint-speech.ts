import { useCallback, useEffect, useState } from 'react';
import * as Speech from 'expo-speech';

import { matchVoice, type InstalledVoice } from '@/domain/hint-voice';

/**
 * Reads a Hint aloud, but only with an installed voice for its language.
 *
 * `voice` is null both while voices are loading (`voices === null`) and when
 * none matches; `error` is set when the voice list or playback fails.
 */
export function useHintSpeech(code: string | undefined) {
  const [voices, setVoices] = useState<InstalledVoice[] | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then(setVoices).catch(() => { setVoices([]); setError(true); });
    return () => { Speech.stop(); };
  }, []);

  const voice = code && voices ? matchVoice(code, voices) : null;

  const stop = useCallback(() => { Speech.stop(); setSpeaking(false); }, []);
  const toggle = useCallback((text: string) => {
    if (speaking || !voice) { stop(); return; }
    setError(false);
    setSpeaking(true);
    Speech.speak(text, {
      voice: voice.identifier,
      language: voice.language,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => { setSpeaking(false); setError(true); },
    });
  }, [speaking, voice, stop]);

  return { voices, voice, speaking, error, stop, toggle };
}
