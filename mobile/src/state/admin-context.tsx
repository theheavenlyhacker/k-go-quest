import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { getRepository } from '../data/storage';
import { dataSource } from '../domain/data-source';
import type { AdminData, ReachRecord } from '../domain/admin';
import {
  parseDevices,
  parseEngagement,
  parseImpactReport,
  parsePacks,
  parseSchools,
  parseUsers,
  quarterOf,
  recentQuarters,
} from '../domain/admin';
import { fixtureAdminData } from '../domain/admin-fixtures';
import { loadCached, type Cache } from '../domain/teacher-load';
import { useOnline } from './online-context';

export const ADMIN_DATA_SOURCE = dataSource(
  process.env.EXPO_PUBLIC_DATA_SOURCE,
  process.env.EXPO_PUBLIC_API_URL,
);

export type AdminLoad =
  | { status: 'loading' }
  | { status: 'error'; message?: string }
  | { status: 'ready'; data: AdminData; today: string };

interface AdminValue {
  load: AdminLoad;
  reload(): void;
}

export const AdminContext = createContext<AdminValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { caretakerGet, server } = useOnline();
  const owner = server?.user.id ?? 'admin';
  const [load, setLoad] = useState<AdminLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    const today = new Date().toISOString().slice(0, 10);

    void (async (): Promise<AdminData> => {
      if (ADMIN_DATA_SOURCE === 'fixture') {
        const fixture = fixtureAdminData(today);
        return {
          ...fixture,
          loadedAt: new Date().toISOString(),
          stale: false,
        };
      }

      const repo = await getRepository();
      const cache = <T,>(key: string): Cache<T> => ({
        get: () => repo.cacheGet(owner, key),
        put: (entry) => repo.cachePut(owner, key, entry),
      });

      const currentQ = quarterOf(today);
      const quarters = recentQuarters(today, 4);

      const [schoolsRes, usersRes, publishedPacks, draftPacks, engagementRes, devicesRes, ...impactResults] =
        await Promise.all([
          loadCached(
            () => caretakerGet('schools?page=1&limit=20'),
            parseSchools,
            cache('schools'),
          ),
          loadCached(
            () => caretakerGet('users?page=1&limit=100'),
            parseUsers,
            cache('users'),
          ),
          loadCached(
            () => caretakerGet('content/packs?page=1&limit=100'),
            parsePacks,
            cache('packs:published'),
          ),
          loadCached(
            () => caretakerGet('content/packs?status=draft&page=1&limit=100'),
            parsePacks,
            cache('packs:draft'),
          ),
          loadCached(
            () => caretakerGet('reports/engagement?days=14'),
            parseEngagement,
            cache('engagement:14'),
          ),
          loadCached(
            () => caretakerGet('devices?page=1&limit=100'),
            parseDevices,
            cache('devices'),
          ),
          ...quarters.map((q) =>
            loadCached(
              () => caretakerGet(`reports/impact?quarter=${q}`),
              parseImpactReport,
              cache(`impact:${q}`),
            ),
          ),
        ]);

      const schoolName = schoolsRes.value[0]?.name ?? 'Division Schools';
      const currentImpact =
        impactResults.find((r) => r.value.quarter === currentQ) ??
        impactResults[0];

      const reach: ReachRecord[] = impactResults.flatMap((r) =>
        (r.value.reachByBarangay ?? []).map((b) => ({
          quarter: r.value.quarter ?? currentQ,
          barangay: b.barangay,
          learners: b.learners,
          lessons: b.lessons,
          offlineLessons: b.offlineLessons,
        })),
      );

      const packs = [
        ...publishedPacks.value.map((p) => ({
          ...p,
          sizeBytes: 148 * 1024 ** 2,
          status: 'PUBLISHED' as const,
        })),
        ...draftPacks.value.map((p) => ({
          ...p,
          sizeBytes: 96 * 1024 ** 2,
          status: 'DRAFT' as const,
        })),
      ];

      const stale =
        schoolsRes.stale ||
        usersRes.stale ||
        publishedPacks.stale ||
        draftPacks.stale ||
        engagementRes.stale ||
        devicesRes.stale ||
        impactResults.some((r) => r.stale);

      return {
        schoolName,
        impact: currentImpact.value,
        impactReports: impactResults.map((r) => r.value),
        users: usersRes.value,
        devices: devicesRes.value,
        library: {
          capacityBytes: 2 * 1024 ** 3,
          packs,
        },
        engagement: engagementRes.value,
        reach,
        loadedAt: currentImpact.fetchedAt,
        stale,
      };
    })()
      .then((data) => {
        if (live) setLoad({ status: 'ready', data, today });
      })
      .catch((error: unknown) => {
        if (live)
          setLoad({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not load the school report.',
          });
      });

    return () => {
      live = false;
    };
  }, [attempt, caretakerGet, owner]);

  return (
    <AdminContext.Provider value={{ load, reload }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('AdminProvider is required');
  return value;
}
