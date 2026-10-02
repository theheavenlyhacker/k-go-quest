import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { vault } from '@/data/vault';
import { useTheme } from '@/ui/theme';

/** First run shows onboarding; afterwards this bounces straight to log in. */
export default function Entry() {
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    let active = true;
    void (async () => {
      const seen = await vault.get('kgo-onboarded').catch(() => null);
      if (!active) return;
      router.replace(seen ? '/sign-in' : '/onboarding');
    })();
    return () => { active = false; };
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: theme.page }} />;
}
