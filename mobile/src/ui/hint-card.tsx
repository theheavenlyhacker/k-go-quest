import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Speech from 'expo-speech';
import { Lightbulb, Play, Square } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { HINT_LANGUAGES, matchVoice, type InstalledVoice } from '@/domain/hint-voice';
import { Action, Card, Pills, Row, T } from '@/ui/primitives';
import { tokens } from '@/ui/theme';

/** One Lesson's Hint: pick a language, read it aloud only with a matching installed voice. */
export function HintCard({ hints }: { hints: Record<string, string> }) {
  const { preferences, updatePreferences } = useApp();
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<InstalledVoice[] | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const available = HINT_LANGUAGES.filter((l) => hints[l.code]);
  const language = available.find((l) => l.code === preferences.language) ?? available[0];

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then(setVoices).catch(() => setVoices([]));
    return () => { Speech.stop(); };
  }, []);

  if (!language) return null;
  const voice = voices ? matchVoice(language.code, voices) : null;

  return (
    <Card onPress={open ? undefined : () => setOpen(true)} style={{ backgroundColor: tokens.tint.sun, borderColor: `${tokens.state.warning}40` }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Lightbulb size={18} color={tokens.brand.sunDeep} />
        <View style={{ flex: 1, gap: 8 }}>
          <T variant="titleS" color={tokens.brand.sunDeep}>{open ? `Hint · ${language.label}` : 'I do not understand — show a hint'}</T>
          {open ? (
            <>
              <Pills
                items={available.map((l) => ({ label: l.label, value: l.code }))}
                value={language.code}
                onChange={(code) => { Speech.stop(); setSpeaking(false); void updatePreferences({ language: code }); }}
              />
              <T variant="bodyM">{hints[language.code]}</T>
              {voice ? (
                <Action
                  title={speaking ? 'Stop' : 'Read aloud'}
                  icon={speaking ? Square : Play}
                  task={async () => {
                    if (speaking) { Speech.stop(); setSpeaking(false); return; }
                    setSpeaking(true);
                    Speech.speak(hints[language.code], {
                      voice: voice.identifier,
                      language: voice.language,
                      onDone: () => setSpeaking(false),
                      onStopped: () => setSpeaking(false),
                      onError: () => setSpeaking(false),
                    });
                  }}
                />
              ) : (
                <T variant="bodyS" color={tokens.brand.sunDeep}>
                  {voices ? `No ${language.label} voice is installed on this tablet, so this Hint is text only.` : 'Checking for a voice…'}
                </T>
              )}
            </>
          ) : null}
        </View>
      </Row>
    </Card>
  );
}
