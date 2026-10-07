import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useApp } from '@/state/app-context';
import { learningState, type Attempt, type UploadRecord } from '@/domain/engine';
import { balance, type Purchase } from '@/domain/shop';
import { ProgressView } from '@/ui/progress-view';
import { BackLink, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';

/** One Profile's Progress, read-only: nothing here answers or buys. */
export default function CaretakerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profiles, viewProfile, toast, packs } = useApp();
  const router = useRouter();
  const [data, setData] = useState<{ attempts: Attempt[]; purchases: Purchase[]; uploads: Map<string, UploadRecord> } | null>(null);
  useEffect(() => { void viewProfile(id).then(setData).catch(() => toast('Could not load this Profile.', 'error')); }, [id, viewProfile, toast]);
  const learning = useMemo(() => learningState(packs, data?.attempts ?? [], data?.uploads), [packs, data]);
  const alias = profiles.find((p) => p.id === id)?.alias ?? 'Profile';
  return (
    <Screen title={alias} caption="Progress (read-only)">
      <BackLink label="Back" onPress={() => router.back()} />
      {data ? <ProgressView readOnly learning={learning} attempts={data.attempts} uploads={data.uploads} purchases={data.purchases} balance={balance(learning.coins, data.purchases)} /> : <T size={12}>Loading...</T>}
    </Screen>
  );
}
