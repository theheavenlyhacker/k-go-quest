import type { DataSource } from 'typeorm';
import type { AuditService } from '../../common/audit.service';
import type { Principal } from '../../common/security';
import { ContentService } from './content.service';

it('keeps an interrupted import unpublished until its persisted manifest matches, including duplicate Lesson keys', async () => {
  const expectedLessons = [
    { title: 'Fractions', skillCode: 'math.fractions', exerciseCount: 2 },
    { title: 'Fractions', skillCode: 'math.fractions', exerciseCount: 1 },
  ];
  let lessons = [{ id: 'first', title: 'Fractions', skillCode: 'math.fractions' }];
  const counts: Record<string, number> = { first: 1, second: 1 };
  const pack: { expectedLessons: typeof expectedLessons | null } = { expectedLessons };
  const manager = {
    findOne: jest.fn().mockResolvedValue(pack),
    findBy: jest.fn().mockImplementation(async () => lessons),
    countBy: jest.fn().mockImplementation(async (_entity: unknown, query: { lessonId: string }) => counts[query.lessonId]),
    update: jest.fn(),
  };
  const db = { transaction: async (task: (m: typeof manager) => Promise<unknown>) => task(manager) };
  const audit = { record: jest.fn() };
  const service = new ContentService(db as unknown as DataSource, audit as unknown as AuditService);
  const actor = { jurisdictionId: 'jurisdiction' } as Principal;
  await expect(service.publish(actor, 'pack')).rejects.toThrow('import is incomplete');
  counts.first = 2;
  await expect(service.publish(actor, 'pack')).rejects.toThrow('import is incomplete');
  expect(manager.update).not.toHaveBeenCalled();
  lessons = [...lessons, { id: 'second', title: 'Fractions', skillCode: 'math.fractions' }];
  counts.second = 2;
  await expect(service.publish(actor, 'pack')).rejects.toThrow('duplicate content');
  counts.second = 1;
  await expect(service.publish(actor, 'pack')).resolves.toEqual({ id: 'pack', published: true });
  expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'pack', { published: true });
  // Legacy incremental authoring does not require an import manifest.
  pack.expectedLessons = null;
  lessons = [lessons[0]];
  await expect(service.publish(actor, 'pack')).resolves.toEqual({ id: 'pack', published: true });
});
