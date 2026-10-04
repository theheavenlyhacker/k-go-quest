import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { CloudDownload, CloudOff, Package, RefreshCw } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { useOnline } from '@/state/online-context';
import { knownSubject, type PackOffer } from '@/domain/packs';
import { subjectTitles } from '@/domain/subjects';
import { Action, Card, Pill, Row, T } from '@/ui/primitives';
import { tokens, useTheme } from '@/ui/theme';

/** The Subject as a Caretaker reads it, falling back to the server's own code for a Subject this app has no screens for. */
function subjectLabel(subject: string): string {
  const known = knownSubject(subject);
  return known ? subjectTitles[known] : subject;
}

/** The download date in the tablet's own locale; the time of day is noise here. */
const onDate = (iso: string) => new Date(iso).toLocaleDateString();

/**
 * The Content Packs on this Shared Tablet, and the ones the server has to offer.
 *
 * The Starter Pack is compiled into the app and is not listed: it is always
 * present, cannot be removed, and is the reason this screen is never the
 * difference between a Learner practising and not. Everything here is extra.
 *
 * Each state is written out rather than shown as a spinner, and a Downloaded
 * Pack says when it arrived — a Caretaker with no connection needs to see what
 * this tablet has, not an error about what it cannot reach.
 */
export function PackLibrary() {
  const { state, serverPacks, downloadPack, busy } = useOnline();
  const { downloaded } = useApp();
  const theme = useTheme();
  const [offers, setOffers] = useState<PackOffer[] | 'error' | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    if (state !== 'READY') return;
    void serverPacks().then(setOffers).catch(() => setOffers('error'));
  }, [serverPacks, state]);
  useEffect(load, [load, tick]);

  const again = async () => { setTick((n) => n + 1); };
  // A Pack this tablet already holds at this version or better is left out:
  // offering it would give the Caretaker a button that does nothing.
  const offered = offers === null || offers === 'error' ? [] : offers.filter((offer) => offer.status !== 'HELD');

  return (
    <View style={{ gap: 8 }}>
      {downloaded.map(({ pack, downloadedAt }) => (
        <Card key={pack.id} style={{ gap: 6 }}>
          <Row style={{ gap: 11 }}>
            <Package size={18} color={tokens.brand.sky} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">{pack.title}</T>
              <T variant="bodyS" color={theme.muted}>
                {`${subjectLabel(pack.subject)} ${pack.grade} · version ${pack.version} · downloaded ${onDate(downloadedAt)}`}
              </T>
            </View>
          </Row>
          <T variant="bodyS" color={theme.muted}>
            Answers in this pack are marked at the school server, so no score or Coins appear until this tablet next reaches it.
          </T>
        </Card>
      ))}

      {downloaded.length ? null : (
        <T variant="bodyS" color={theme.muted}>
          No Content Packs have been downloaded. The Starter Pack is built into the app and is always here.
        </T>
      )}

      {state === 'UNREACHABLE' ? (
        <Row style={{ gap: 9 }}>
          <CloudOff size={16} color={theme.muted} />
          <T variant="bodyS" color={theme.muted} style={{ flex: 1 }}>
            No connection to the school server, so there is nothing new to list. The packs above keep working.
          </T>
        </Row>
      ) : state !== 'READY' ? (
        <T variant="bodyS" color={theme.muted}>
          New Content Packs need the Caretaker signed in to the school server.
        </T>
      ) : offers === 'error' ? (
        <Card style={{ gap: 10 }}>
          <T variant="bodyS" color={theme.muted}>The server did not send its list of Content Packs.</T>
          <Action title="Try again" icon={RefreshCw} variant="soft" task={again} />
        </Card>
      ) : offers === null ? (
        <T variant="bodyS" color={theme.muted}>{'Asking the server which Content Packs it has…'}</T>
      ) : (
        <>
          {offered.map((offer) => (
            <Card key={offer.summary.id} style={{ gap: 8 }}>
              <Row style={{ gap: 11 }}>
                <CloudDownload size={18} color={tokens.state.success} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="titleS">{offer.summary.title}</T>
                  <T variant="bodyS" color={theme.muted}>
                    {`${subjectLabel(offer.summary.subject)} ${offer.summary.grade} · version ${offer.summary.version}`}
                  </T>
                </View>
                {offer.status === 'UPDATE' ? <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>Update</Pill> : null}
              </Row>
              <Action
                title={offer.status === 'UPDATE' ? 'Update this pack' : 'Download'}
                icon={CloudDownload}
                variant="soft"
                disabled={busy}
                task={async () => { await downloadPack(offer); setTick((n) => n + 1); }}
              />
            </Card>
          ))}
          {offered.length ? null : (
            <T variant="bodyS" color={theme.muted}>Every Content Pack the server offers is already on this tablet.</T>
          )}
          <Action title="Check for Content Packs" icon={RefreshCw} variant="outline" task={again} />
        </>
      )}
    </View>
  );
}
