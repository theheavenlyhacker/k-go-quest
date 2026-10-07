import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ContentPack,
  Device,
  Role,
  School,
} from '../../database/entities';
import type { Principal } from '../../common/security';
import type { CheckInDto, DeviceQueryDto } from './devices.dto';
import { compareVersions } from './version';

export interface DerivedStatus {
  status: 'Online' | 'Needs update' | 'Offline';
  online: boolean;
  updateAvailable: boolean;
}

@Injectable()
export class DevicesService {
  constructor(private readonly db: DataSource) {}

  deriveStatus(
    device: Pick<Device, 'appVersion' | 'packVersions' | 'lastSeenAt'>,
    publishedPacks: ContentPack[],
    now = Date.now(),
    latestAppVersion = process.env.LATEST_APP_VERSION || '1.0.0',
  ): DerivedStatus {
    const lastSeen = device.lastSeenAt
      ? new Date(device.lastSeenAt).getTime()
      : 0;
    const isOnline = lastSeen > 0 && now - lastSeen <= 15 * 60 * 1000;
    const appBehind =
      compareVersions(device.appVersion || '0.0.0', latestAppVersion) < 0;

    const packLineKey = (p: {
      subject?: string;
      grade?: number;
      title?: string;
    }) =>
      `${p.subject ?? ''}/${p.grade ?? ''}/${p.title ?? ''}`.toLowerCase();

    const latestByLine = new Map<string, string>();
    const latestById = new Map<string, string>();
    const latestByTitle = new Map<string, string>();

    for (const pack of publishedPacks) {
      const key = packLineKey(pack);
      const curr = latestByLine.get(key);
      if (!curr || compareVersions(pack.version, curr) > 0) {
        latestByLine.set(key, pack.version);
      }
      const currTitle = latestByTitle.get(pack.title.toLowerCase());
      if (!currTitle || compareVersions(pack.version, currTitle) > 0) {
        latestByTitle.set(pack.title.toLowerCase(), pack.version);
      }
    }

    for (const pack of publishedPacks) {
      const lineVersion =
        latestByLine.get(packLineKey(pack)) ?? pack.version;
      latestById.set(pack.id, lineVersion);
    }

    let packBehind = false;
    for (const held of device.packVersions ?? []) {
      if (!held || typeof held !== 'object' || !held.version) continue;
      let latestForPack: string | undefined;

      if (held.subject && held.grade !== undefined && held.title) {
        latestForPack = latestByLine.get(packLineKey(held));
      }
      const id = held.packId || held.id;
      if (!latestForPack && id && latestById.has(id)) {
        latestForPack = latestById.get(id);
      }
      if (
        !latestForPack &&
        held.title &&
        latestByTitle.has(held.title.toLowerCase())
      ) {
        latestForPack = latestByTitle.get(held.title.toLowerCase());
      }

      if (latestForPack && compareVersions(held.version, latestForPack) < 0) {
        packBehind = true;
        break;
      }
    }

    const needsUpdate = appBehind || packBehind;
    let status: 'Online' | 'Needs update' | 'Offline';
    if (!isOnline) {
      status = 'Offline';
    } else if (needsUpdate) {
      status = 'Needs update';
    } else {
      status = 'Online';
    }

    return {
      status,
      online: isOnline,
      updateAvailable: needsUpdate,
    };
  }

  async checkIn(actor: Principal, dto: CheckInDto) {
    const repo = this.db.getRepository(Device);
    let device = await repo.findOneBy({ deviceId: dto.deviceId });

    if (device) {
      device.jurisdictionId = actor.jurisdictionId;
      if (actor.schoolId) {
        device.schoolId = actor.schoolId;
      }
      device.appVersion = dto.appVersion;
      device.packVersions = dto.packVersions as Device['packVersions'];
      device.storageUsedPercent = dto.storageUsedPercent;
      device.pendingAttempts = dto.pendingAttempts;
      device.lastSeenAt = new Date();
    } else {
      device = repo.create({
        deviceId: dto.deviceId,
        jurisdictionId: actor.jurisdictionId,
        schoolId: actor.schoolId ?? null,
        appVersion: dto.appVersion,
        packVersions: dto.packVersions as Device['packVersions'],
        storageUsedPercent: dto.storageUsedPercent,
        pendingAttempts: dto.pendingAttempts,
        lastSeenAt: new Date(),
      });
    }

    await repo.save(device);
    return { ok: true, id: device.id, deviceId: device.deviceId };
  }

  async list(actor: Principal, query: DeviceQueryDto) {
    if (actor.role !== Role.LGU_ADMIN) {
      throw new ForbiddenException('LGU admin only');
    }

    const [items, total] = await this.db.getRepository(Device).findAndCount({
      where: { jurisdictionId: actor.jurisdictionId },
      order: { lastSeenAt: 'DESC', id: 'ASC' },
      take: query.limit,
      skip: query.skip,
    });

    const publishedPacks = await this.db
      .getRepository(ContentPack)
      .findBy({ jurisdictionId: actor.jurisdictionId, published: true });

    const schools = await this.db
      .getRepository(School)
      .findBy({ jurisdictionId: actor.jurisdictionId });
    const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

    const now = Date.now();
    const mappedItems = items.map((device) => {
      const derived = this.deriveStatus(device, publishedPacks, now);
      const schoolName = device.schoolId
        ? schoolMap.get(device.schoolId) ?? null
        : null;
      return {
        id: device.id,
        deviceId: device.deviceId,
        name: `Shared Tablet (${device.deviceId.slice(0, 6).toUpperCase()})`,
        grade: schoolName ?? 'Shared',
        classroom: 'Tablet',
        schoolId: device.schoolId,
        schoolName,
        jurisdictionId: device.jurisdictionId,
        appVersion: device.appVersion,
        packVersions: device.packVersions,
        storageUsedPercent: device.storageUsedPercent,
        pendingAttempts: device.pendingAttempts,
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        status: derived.status,
        online: derived.online,
        updateAvailable: derived.updateAvailable,
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
      };
    });

    return {
      items: mappedItems,
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
