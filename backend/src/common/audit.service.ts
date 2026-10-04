import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AuditEvent } from '../database/entities';
import type { Principal } from './security';

@Injectable()
export class AuditService {
  constructor(private readonly db: DataSource) {}
  async record(
    actor: Pick<Principal, 'id' | 'jurisdictionId'>,
    action: string,
    targetId: string | null = null,
    manager: EntityManager = this.db.manager,
    metadata: Record<string, unknown> = {},
  ) {
    return manager.save(
      AuditEvent,
      manager.create(AuditEvent, {
        actorId: actor.id,
        jurisdictionId: actor.jurisdictionId,
        action,
        targetId,
        metadata,
      }),
    );
  }
}
