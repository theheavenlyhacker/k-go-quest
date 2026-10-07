import { ApiClient } from './client';
import type { Pack } from './types';
import type { Session } from './server';

export interface PackVersionPayload {
  packId?: string;
  id?: string;
  version: string;
  subject?: string;
  grade?: number;
  title?: string;
}

export interface CheckInPayload {
  deviceId: string;
  appVersion: string;
  packVersions: PackVersionPayload[];
  storageUsedPercent: number;
  pendingAttempts: number;
}

export function buildCheckInPayload(
  deviceId: string,
  appVersion: string,
  packs: Pack[],
  storageUsedPercent: number,
  pendingAttempts: number,
): CheckInPayload {
  return {
    deviceId,
    appVersion,
    packVersions: packs.map((p) => ({
      packId: p.id,
      id: p.id,
      version: p.version,
      subject: p.subject,
      grade: p.grade,
      title: p.title,
    })),
    storageUsedPercent,
    pendingAttempts,
  };
}

/**
 * Sends a device check-in to the server.
 * Best effort: never throws to the caller, so check-in failure never blocks sign-in or sync.
 */
export async function sendDeviceCheckIn(
  apiUrl: string,
  session: Session,
  payload: CheckInPayload,
  transport: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const client = new ApiClient(
      () => apiUrl,
      {
        read: () => session,
        write: async () => {},
        invalidate: async () => {},
      },
      transport,
    );
    await client.call('POST', 'devices/check-in', payload);
    return true;
  } catch {
    // Best effort: a failed check-in never blocks sign-in or sync.
    return false;
  }
}
