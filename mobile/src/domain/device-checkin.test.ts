import { describe, expect, it, vi } from 'vitest';
import { buildCheckInPayload, sendDeviceCheckIn } from './device-checkin';
import { starterPacks } from '../content/starter-pack';
import type { Session } from './server';
import { deviceRows, deviceStatus, deviceTiles, type DeviceRecord } from './admin';

const mockSession: Session = {
  user: {
    id: 'user-1',
    loginId: 'teacher-demo',
    alias: 'Teacher Demo',
    role: 'TEACHER',
    jurisdictionId: 'jur-1',
    schoolId: 'school-1',
    coins: 0,
  },
  accessToken: 'valid-access-token',
  refreshToken: 'valid-refresh-token',
  expiresIn: 3600,
  deviceId: 'test-device-uuid',
  offlineUntil: Date.now() + 86400000,
};

describe('buildCheckInPayload', () => {
  it('constructs payload with deviceId, appVersion, packVersions, storage and pending count', () => {
    const payload = buildCheckInPayload(
      'dev-uuid-123',
      '1.0.0',
      starterPacks,
      35,
      2,
    );

    expect(payload.deviceId).toBe('dev-uuid-123');
    expect(payload.appVersion).toBe('1.0.0');
    expect(payload.storageUsedPercent).toBe(35);
    expect(payload.pendingAttempts).toBe(2);
    expect(payload.packVersions.length).toBe(starterPacks.length);
    expect(payload.packVersions[0]).toMatchObject({
      packId: 'math5',
      version: '1.0.0',
      subject: 'MATH',
      grade: 5,
      title: 'Fractions & Decimals',
    });
  });
});

describe('sendDeviceCheckIn with failing transport (best-effort)', () => {
  it('returns true on successful HTTP 201 check-in', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: async () => ({ ok: true }),
    } as unknown as Response);

    const payload = buildCheckInPayload('dev-1', '1.0.0', starterPacks, 30, 0);
    const success = await sendDeviceCheckIn(
      'http://localhost:3000/api/v1',
      mockSession,
      payload,
      mockFetch as unknown as typeof fetch,
    );

    expect(success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('is invisible to caller when transport returns 500 (does not throw, returns false)', async () => {
    const failingTransport = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ message: 'Internal Server Error' }),
    } as unknown as Response);

    const payload = buildCheckInPayload('dev-1', '1.0.0', starterPacks, 30, 0);

    // Must NOT throw:
    let error: unknown = null;
    let success = false;
    try {
      success = await sendDeviceCheckIn(
        'http://localhost:3000/api/v1',
        mockSession,
        payload,
        failingTransport as unknown as typeof fetch,
      );
    } catch (e) {
      error = e;
    }

    expect(error).toBeNull();
    expect(success).toBe(false);
  });

  it('is invisible to caller when network throws (does not throw, returns false)', async () => {
    const networkFailTransport = vi.fn().mockRejectedValue(new Error('Network offline or refused'));

    const payload = buildCheckInPayload('dev-1', '1.0.0', starterPacks, 30, 0);

    // Must NOT throw:
    let error: unknown = null;
    let success = false;
    try {
      success = await sendDeviceCheckIn(
        'http://localhost:3000/api/v1',
        mockSession,
        payload,
        networkFailTransport as unknown as typeof fetch,
      );
    } catch (e) {
      error = e;
    }

    expect(error).toBeNull();
    expect(success).toBe(false);
  });
});

describe('Admin Devices screen status verification', () => {
  it('shows an active emulator tablet as Online', () => {
    const onlineTablet: DeviceRecord = {
      id: 'd-emulator',
      name: 'Shared Tablet (EMU123)',
      grade: 'Pembo Elementary',
      classroom: 'Tablet',
      lastSeenAt: new Date().toISOString(),
      online: true,
      updateAvailable: false,
      storageUsedPercent: 25,
      status: 'Online',
    };

    expect(deviceStatus(onlineTablet)).toBe('Online');
    const tiles = deviceTiles([onlineTablet]);
    expect(tiles.find((t) => t.key === 'online')?.value).toBe('1');
    expect(tiles.find((t) => t.key === 'attention')?.value).toBe('0');
  });

  it('shows a tablet holding an older Pack version as Needs update', () => {
    const olderPackTablet: DeviceRecord = {
      id: 'd-older',
      name: 'Shared Tablet (OLD456)',
      grade: 'Pembo Elementary',
      classroom: 'Tablet',
      lastSeenAt: new Date().toISOString(),
      online: true,
      updateAvailable: true,
      storageUsedPercent: 40,
      status: 'Needs update',
    };

    expect(deviceStatus(olderPackTablet)).toBe('Needs update');
    const tiles = deviceTiles([olderPackTablet]);
    expect(tiles.find((t) => t.key === 'attention')?.value).toBe('1');

    const rows = deviceRows([olderPackTablet]);
    expect(rows[0].status).toBe('Needs update');
  });

  it('shows an unseen tablet as Offline', () => {
    const offlineTablet: DeviceRecord = {
      id: 'd-offline',
      name: 'Shared Tablet (OFF789)',
      grade: 'Pembo Elementary',
      classroom: 'Tablet',
      lastSeenAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      online: false,
      updateAvailable: false,
      storageUsedPercent: 30,
      status: 'Offline',
    };

    expect(deviceStatus(offlineTablet)).toBe('Offline');
  });
});
