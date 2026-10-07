import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ContentPack, Device, Role, School, Subject } from '../../database/entities';
import type { Principal } from '../../common/security';
import { DevicesService } from './devices.service';
import { compareVersions } from './version';

describe('compareVersions', () => {
  it('compares identical versions as equal', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
  });

  it('orders numeric versions correctly', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.1.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.9.0', '1.0.0')).toBeLessThan(0);
  });

  it('handles pre-release tags', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBeLessThan(0);
  });
});

describe('DevicesService.deriveStatus', () => {
  let service: DevicesService;

  beforeEach(() => {
    service = new DevicesService({} as DataSource);
  });

  const basePack = (version = '1.0.0'): ContentPack =>
    ({
      id: 'pack-uuid-1',
      title: 'Fractions & Decimals',
      subject: Subject.MATH,
      grade: 5,
      version,
      published: true,
      jurisdictionId: 'jur-1',
    }) as ContentPack;

  it('marks device seen within 15 minutes with up-to-date content as Online', () => {
    const now = Date.now();
    const result = service.deriveStatus(
      {
        appVersion: '1.0.0',
        packVersions: [
          {
            id: 'pack-uuid-1',
            version: '1.0.0',
            subject: 'MATH',
            grade: 5,
            title: 'Fractions & Decimals',
          },
        ],
        lastSeenAt: new Date(now - 2 * 60 * 1000), // 2 min ago
      },
      [basePack('1.0.0')],
      now,
      '1.0.0',
    );

    expect(result).toEqual({
      status: 'Online',
      online: true,
      updateAvailable: false,
    });
  });

  it('marks device holding an older Pack version as Needs update', () => {
    const now = Date.now();
    const result = service.deriveStatus(
      {
        appVersion: '1.0.0',
        packVersions: [
          {
            id: 'pack-uuid-1',
            version: '1.0.0',
            subject: 'MATH',
            grade: 5,
            title: 'Fractions & Decimals',
          },
        ],
        lastSeenAt: new Date(now - 1 * 60 * 1000), // 1 min ago
      },
      [basePack('1.1.0')], // newer published version
      now,
      '1.0.0',
    );

    expect(result).toEqual({
      status: 'Needs update',
      online: true,
      updateAvailable: true,
    });
  });

  it('marks device with older appVersion as Needs update', () => {
    const now = Date.now();
    const result = service.deriveStatus(
      {
        appVersion: '0.9.0',
        packVersions: [],
        lastSeenAt: new Date(now - 5 * 60 * 1000),
      },
      [],
      now,
      '1.0.0',
    );

    expect(result).toEqual({
      status: 'Needs update',
      online: true,
      updateAvailable: true,
    });
  });

  it('marks device not seen in last 15 minutes as Offline', () => {
    const now = Date.now();
    const result = service.deriveStatus(
      {
        appVersion: '1.0.0',
        packVersions: [],
        lastSeenAt: new Date(now - 16 * 60 * 1000), // 16 min ago
      },
      [],
      now,
      '1.0.0',
    );

    expect(result).toEqual({
      status: 'Offline',
      online: false,
      updateAvailable: false,
    });
  });

  it('prioritizes Offline over Needs update when device has been unseen for over 15 minutes', () => {
    const now = Date.now();
    const result = service.deriveStatus(
      {
        appVersion: '0.9.0', // needs update
        packVersions: [
          {
            id: 'pack-uuid-1',
            version: '1.0.0',
            subject: 'MATH',
            grade: 5,
            title: 'Fractions & Decimals',
          },
        ],
        lastSeenAt: new Date(now - 30 * 60 * 1000), // 30 min ago
      },
      [basePack('2.0.0')],
      now,
      '1.0.0',
    );

    expect(result).toEqual({
      status: 'Offline',
      online: false,
      updateAvailable: true,
    });
  });
});

describe('DevicesService scoping and operations', () => {
  let service: DevicesService;
  let mockDb: any;
  let savedDevices: any[];

  beforeEach(() => {
    savedDevices = [];
    mockDb = {
      getRepository: (entity: any) => {
        if (entity === Device) {
          return {
            findOneBy: jest.fn(async ({ deviceId }) =>
              savedDevices.find((d) => d.deviceId === deviceId) ?? null,
            ),
            create: jest.fn((data) => ({
              id: 'new-id',
              ...data,
            })),
            save: jest.fn(async (device) => {
              const idx = savedDevices.findIndex(
                (d) => d.deviceId === device.deviceId,
              );
              if (idx >= 0) savedDevices[idx] = device;
              else savedDevices.push(device);
              return device;
            }),
            findAndCount: jest.fn(async ({ where }) => {
              const filtered = savedDevices.filter(
                (d) => d.jurisdictionId === where.jurisdictionId,
              );
              return [filtered, filtered.length];
            }),
          };
        }
        if (entity === ContentPack) {
          return {
            findBy: jest.fn(async () => []),
          };
        }
        if (entity === School) {
          return {
            findBy: jest.fn(async () => [
              { id: 'school-1', name: 'Pembo Elementary' },
            ]),
          };
        }
        return {};
      },
    };
    service = new DevicesService(mockDb as DataSource);
  });

  const caretaker: Principal = {
    id: 'user-teacher-1',
    role: Role.TEACHER,
    jurisdictionId: 'jur-1',
    schoolId: 'school-1',
    sessionId: 'session-1',
  };

  const admin: Principal = {
    id: 'user-admin-1',
    role: Role.LGU_ADMIN,
    jurisdictionId: 'jur-1',
    schoolId: null,
    sessionId: 'session-2',
  };

  it('checks in and scopes by caller school and jurisdiction', async () => {
    const res = await service.checkIn(caretaker, {
      deviceId: 'dev-123',
      appVersion: '1.0.0',
      packVersions: [],
      storageUsedPercent: 35,
      pendingAttempts: 2,
    });

    expect(res.ok).toBe(true);
    expect(res.deviceId).toBe('dev-123');

    const stored = savedDevices.find((d) => d.deviceId === 'dev-123');
    expect(stored).toBeDefined();
    expect(stored.jurisdictionId).toBe('jur-1');
    expect(stored.schoolId).toBe('school-1');
    expect(stored.storageUsedPercent).toBe(35);
    expect(stored.pendingAttempts).toBe(2);
  });

  it('updates existing device on repeat check-in', async () => {
    await service.checkIn(caretaker, {
      deviceId: 'dev-123',
      appVersion: '1.0.0',
      packVersions: [],
      storageUsedPercent: 35,
      pendingAttempts: 2,
    });

    await service.checkIn(caretaker, {
      deviceId: 'dev-123',
      appVersion: '1.1.0',
      packVersions: [],
      storageUsedPercent: 40,
      pendingAttempts: 0,
    });

    expect(savedDevices).toHaveLength(1);
    expect(savedDevices[0].appVersion).toBe('1.1.0');
    expect(savedDevices[0].storageUsedPercent).toBe(40);
    expect(savedDevices[0].pendingAttempts).toBe(0);
  });

  it('scopes list to own jurisdiction only', async () => {
    savedDevices.push(
      {
        id: 'd1',
        deviceId: 'dev-jur1',
        jurisdictionId: 'jur-1',
        schoolId: 'school-1',
        appVersion: '1.0.0',
        packVersions: [],
        storageUsedPercent: 20,
        pendingAttempts: 0,
        lastSeenAt: new Date(),
      },
      {
        id: 'd2',
        deviceId: 'dev-jur2',
        jurisdictionId: 'jur-other',
        schoolId: 'school-other',
        appVersion: '1.0.0',
        packVersions: [],
        storageUsedPercent: 20,
        pendingAttempts: 0,
        lastSeenAt: new Date(),
      },
    );

    const result = await service.list(admin, {
      page: 1,
      limit: 20,
      skip: 0,
    } as any);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].deviceId).toBe('dev-jur1');
    expect(result.items[0].schoolName).toBe('Pembo Elementary');
  });

  it('forbids non-LGU Admin from listing devices', async () => {
    await expect(
      service.list(caretaker, { page: 1, limit: 20, skip: 0 } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
