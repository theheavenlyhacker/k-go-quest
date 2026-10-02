import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Redemption, Reward, Role, User } from '../../database/entities';
import { AuditService } from '../../common/audit.service';
import type { Principal } from '../../common/security';
import type { PaginationDto } from '../../common/pagination.dto';
import type {
  CreateRewardDto,
  RedeemDto,
  RewardQueryDto,
  UpdateRewardDto,
} from './rewards.dto';

@Injectable()
export class RewardsService {
  constructor(
    private readonly db: DataSource,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}
  async list(actor: Principal, query: RewardQueryDto) {
    if (query.status === 'all' && actor.role !== Role.LGU_ADMIN)
      throw new ForbiddenException('Only LGU admins can list inactive rewards');
    const [items, total] = await this.db.getRepository(Reward).findAndCount({
      where: {
        jurisdictionId: actor.jurisdictionId,
        ...(query.status === 'all' ? {} : { active: true }),
      },
      order: { cost: 'ASC', id: 'ASC' },
      skip: query.skip,
      take: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit };
  }
  async update(actor: Principal, id: string, dto: UpdateRewardDto) {
    return this.db.transaction(async (manager) => {
      const reward = await manager.findOne(Reward, {
        where: { id, jurisdictionId: actor.jurisdictionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reward) throw new NotFoundException('Reward not found');
      for (const key of ['title', 'cost', 'stock', 'active'] as const)
        if (dto[key] !== undefined) Object.assign(reward, { [key]: dto[key] });
      await manager.save(reward);
      await this.audit.record(actor, 'REWARD_UPDATED', id, manager);
      return reward;
    });
  }
  async create(actor: Principal, dto: CreateRewardDto) {
    return this.db.transaction(async (manager) => {
      const reward = await manager.save(
        Reward,
        manager.create(Reward, {
          title: dto.title,
          cost: dto.cost,
          stock: dto.stock,
          jurisdictionId: actor.jurisdictionId,
        }),
      );
      await this.audit.record(actor, 'REWARD_CREATED', reward.id, manager);
      return reward;
    });
  }
  private async voucher(redemption: Redemption) {
    const qrToken = await this.jwt.signAsync(
      { sub: redemption.id, purpose: 'voucher' },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithm: 'HS256',
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: 'kgo-voucher',
      },
    );
    return { redemption, qrToken, claimMode: 'ONLINE_SERVER_VALIDATION' };
  }
  async redeem(actor: Principal, dto: RedeemDto) {
    const redemption = await this.db.transaction(async (manager) => {
      const user = await manager.findOneOrFail(User, {
        where: { id: actor.id, active: true },
        lock: { mode: 'pessimistic_write' },
      });
      const old = await manager.findOneBy(Redemption, {
        studentId: actor.id,
        requestId: dto.requestId,
      });
      if (old) {
        if (old.rewardId !== dto.rewardId)
          throw new ConflictException(
            'Request ID was already used for another reward',
          );
        return old;
      }
      const reward = await manager.findOne(Reward, {
        where: {
          id: dto.rewardId,
          jurisdictionId: actor.jurisdictionId,
          active: true,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reward) throw new NotFoundException('Reward not found');
      if (reward.stock < 1 || user.coins < reward.cost)
        throw new ConflictException('Insufficient coins or reward unavailable');
      user.coins -= reward.cost;
      reward.stock -= 1;
      await manager.save(user);
      await manager.save(reward);
      const record = await manager.save(
        Redemption,
        manager.create(Redemption, {
          studentId: actor.id,
          requestId: dto.requestId,
          rewardId: reward.id,
          cost: reward.cost,
          status: 'ISSUED',
          claimedAt: null,
          claimedBy: null,
        }),
      );
      await this.audit.record(actor, 'VOUCHER_ISSUED', record.id, manager, {
        cost: reward.cost,
      });
      return record;
    });
    return this.voucher(redemption);
  }
  async myVouchers(actor: Principal, query: PaginationDto) {
    const [items, total] = await this.db
      .getRepository(Redemption)
      .findAndCount({
        where: { studentId: actor.id },
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: query.skip,
        take: query.limit,
      });
    return {
      items: await Promise.all(items.map((r) => this.voucher(r))),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
  async claim(actor: Principal, id: string) {
    return this.db.transaction(async (manager) => {
      const record = await manager.findOne(Redemption, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !record ||
        !(await manager.existsBy(Reward, {
          id: record.rewardId,
          jurisdictionId: actor.jurisdictionId,
        }))
      )
        throw new NotFoundException('Voucher not found');
      if (record.status === 'CLAIMED')
        throw new ConflictException('Voucher already claimed');
      record.status = 'CLAIMED';
      record.claimedAt = new Date();
      record.claimedBy = actor.id;
      await manager.save(record);
      await this.audit.record(actor, 'VOUCHER_CLAIMED', id, manager);
      return { id, status: record.status, claimedAt: record.claimedAt };
    });
  }
}
