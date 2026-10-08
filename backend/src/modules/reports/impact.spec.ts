import { DataSource } from 'typeorm';
import { ScopeService } from '../../common/scope.service';
import type { Principal } from '../../common/security';
import { Role, School, SkillProgress, User } from '../../database/entities';
import { ReportsService } from './reports.service';

describe('ReportsService.impact export aggregates', () => {
  it('returns quarterly change and unpaginated tablet coverage, keeping empty estimates null', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ learners_reached: '0', total_attempts: '0', offline_attempts: '0' }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ change: null }]).mockResolvedValueOnce([{ total: '130', checked: '75' }]);
    const db = { query, getRepository: (entity: unknown) => {
      if ([School, User, SkillProgress].includes(entity as typeof School)) return { findBy: jest.fn().mockResolvedValue([]) };
      throw new Error('Unexpected repository');
    } };
    const service = new ReportsService(db as unknown as DataSource, {} as ScopeService);
    const actor = { id: 'admin', jurisdictionId: 'jur', role: Role.LGU_ADMIN } as Principal;
    const report = await service.impact(actor, '2026-Q4');
    expect(report.meanEstimatedMasteryChange).toBeNull();
    expect(report.totalTablets).toBe(130);
    expect(report.tabletsCheckedInQuarter).toBe(75);
    expect(report.disclaimer).toBe('Practice estimates, not measured learning impact. No cost or hours-saved claims are inferred.');
    expect(query.mock.calls[3][1]).toEqual(['jur', Role.STUDENT, '2026-10', '2026-12']);
    expect(query.mock.calls[4][1]).toEqual(['jur', new Date('2026-09-30T16:00:00Z'), new Date('2026-12-31T16:00:00Z')]);
  });
});
