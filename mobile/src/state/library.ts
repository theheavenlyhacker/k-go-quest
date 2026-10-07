import { useCallback, useEffect, useState } from 'react';

import { syncBanner, type Offers } from '../domain/library';
import { useApp } from './app-context';
import { useOnline } from './online-context';

/**
 * What the Offline Library knows beyond the Packs on the tablet: answers
 * waiting to go up, and what the server offers. Everything here is extra and
 * quietly absent offline; none of it gates the Library.
 */
export function useLibrary() {
  const { profile, attempts } = useApp();
  const { state, links, summary, sync, serverPacks, busy } = useOnline();
  const [pending, setPending] = useState(0);
  const [sent, setSent] = useState(0);
  const [fetched, setFetched] = useState<Offers>({ status: 'loading' });
  const [tries, setTries] = useState(0);

  const linked = Boolean(profile && links[profile.id]);
  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId) return;
    void summary(profileId).then((s) => setPending(s.pending)).catch(() => setPending(0));
  }, [profileId, summary, attempts.length, sent]);

  useEffect(() => {
    if (state !== 'READY') return;
    void serverPacks().then((offers) => setFetched({ status: 'ready', offers })).catch(() => setFetched({ status: 'error' }));
  }, [serverPacks, state, tries]);

  const retry = useCallback(() => { setFetched({ status: 'loading' }); setTries((n) => n + 1); }, []);
  const syncNow = useCallback(async () => {
    if (!profileId) return;
    await sync(profileId);
    setSent((n) => n + 1);
  }, [profileId, sync]);

  return {
    banner: syncBanner(pending, state, linked),
    syncNow,
    busy,
    /** null offline: there is no list to wait for and nothing failed. */
    offers: state === 'READY' ? fetched : null,
    retry,
  };
}
