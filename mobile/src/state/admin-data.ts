import { useCallback, useEffect, useState } from 'react';

import { canOpenAdmin, type AdminData, type DeviceRecord } from '../domain/admin';
import { fixtureAdminData } from '../domain/admin-fixtures';
import type { Page } from '../domain/server';
import { useOnline } from './online-context';

export type AdminLoad = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: AdminData; today: string };

interface RawDeviceItem {
  id: string;
  deviceId?: string;
  name?: string;
  grade?: string;
  classroom?: string;
  schoolName?: string | null;
  lastSeenAt?: string | null;
  online?: boolean;
  updateAvailable?: boolean;
  storageUsedPercent?: number;
  status?: DeviceRecord['status'];
}

/** The Admin shell's data, reading live devices from the school server when online. */
export function useAdminData(): AdminLoad & { reload: () => void } {
  const { caretakerGet, state: onlineState, server } = useOnline();
  const [state, setState] = useState<AdminLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const today = new Date().toISOString().slice(0, 10);

    const load = async (): Promise<AdminData> => {
      const base = fixtureAdminData(today);
      if (canOpenAdmin(onlineState, server)) {
        try {
          const res = await caretakerGet<Page<RawDeviceItem> | RawDeviceItem[]>('devices?page=1&limit=100');
          const items: RawDeviceItem[] = Array.isArray(res) ? res : (res?.items ?? []);
          const devices: DeviceRecord[] = items.map((d) => ({
            id: d.id,
            name: d.name ?? `Shared Tablet ${d.deviceId?.slice(0, 6) ?? ''}`,
            grade: d.grade ?? (d.schoolName ? d.schoolName : 'Shared'),
            classroom: d.classroom ?? 'Tablet',
            lastSeenAt: d.lastSeenAt ?? null,
            online:
              typeof d.online === 'boolean'
                ? d.online
                : d.status === 'Online' ||
                  d.status === 'Needs update' ||
                  d.status === 'Needs Update',
            updateAvailable:
              typeof d.updateAvailable === 'boolean'
                ? d.updateAvailable
                : d.status === 'Needs update' || d.status === 'Needs Update',
            storageUsedPercent: d.storageUsedPercent ?? 0,
            status: d.status,
          }));
          return { ...base, devices };
        } catch {
          // If live fetch fails, fall back to base fixtures
        }
      }
      return base;
    };

    load()
      .then((data) => {
        if (live) setState({ status: 'ready', data, today });
      })
      .catch(() => {
        if (live) setState({ status: 'error' });
      });
    return () => {
      live = false;
    };
  }, [attempt, caretakerGet, onlineState, server]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}

