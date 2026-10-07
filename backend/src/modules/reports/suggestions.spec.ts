import { Subject } from '../../database/entities';
import {
  formatSkillTitle,
  groupLearnersByTopSkill,
  lowestNonMasteredSkill,
} from './suggestions';

describe('lowestNonMasteredSkill', () => {
  it('selects the skill with lowest mastery under 0.95', () => {
    const skills = [
      { skillCode: 'math5.fractions.equivalent', mastery: 0.8 },
      { skillCode: 'math5.fractions.add', mastery: 0.35 },
      { skillCode: 'math5.decimals.place-value', mastery: 0.6 },
    ];
    expect(lowestNonMasteredSkill(skills)).toBe('math5.fractions.add');
  });

  it('skips mastered skills (>= 0.95)', () => {
    const skills = [
      { skillCode: 'math5.fractions.add', mastery: 0.96 },
      { skillCode: 'math5.decimals.place-value', mastery: 0.98 },
    ];
    expect(lowestNonMasteredSkill(skills)).toBeNull();
  });

  it('breaks ties by skillCode deterministically', () => {
    const skills = [
      { skillCode: 'skill.z', mastery: 0.4 },
      { skillCode: 'skill.a', mastery: 0.4 },
    ];
    expect(lowestNonMasteredSkill(skills)).toBe('skill.a');
  });

  it('returns null when skills array is empty', () => {
    expect(lowestNonMasteredSkill([])).toBeNull();
  });
});

describe('formatSkillTitle', () => {
  it('formats last segment of skill code cleanly', () => {
    expect(formatSkillTitle('math5.fractions.add')).toBe('Add');
    expect(formatSkillTitle('math5.decimals.place-value')).toBe('Place Value');
  });
});

describe('groupLearnersByTopSkill', () => {
  it('groups learners by their top skill and sorts largest group first', () => {
    const learners = [
      { id: '1', alias: 'Charlie', topSkill: 'math5.fractions.add' },
      { id: '2', alias: 'Alice', topSkill: 'math5.fractions.add' },
      { id: '3', alias: 'Bob', topSkill: 'math5.fractions.add' },
      { id: '4', alias: 'David', topSkill: 'math5.decimals.place-value' },
      { id: '5', alias: 'Eve', topSkill: 'math5.decimals.place-value' },
      { id: '6', alias: 'Frank', topSkill: null }, // no skill
    ];

    const metadata = new Map([
      [
        'math5.fractions.add',
        { title: 'Adding fractions', subject: Subject.MATH },
      ],
      [
        'math5.decimals.place-value',
        { title: 'Decimal place value', subject: Subject.MATH },
      ],
    ]);

    const groups = groupLearnersByTopSkill(learners, metadata);

    expect(groups).toHaveLength(2);

    // First group: Adding fractions (3 learners)
    expect(groups[0].skillCode).toBe('math5.fractions.add');
    expect(groups[0].skillTitle).toBe('Adding fractions');
    expect(groups[0].subject).toBe(Subject.MATH);
    expect(groups[0].count).toBe(3);
    expect(groups[0].learners).toEqual([
      { id: '2', alias: 'Alice' },
      { id: '3', alias: 'Bob' },
      { id: '1', alias: 'Charlie' },
    ]);

    // Second group: Decimal place value (2 learners)
    expect(groups[1].skillCode).toBe('math5.decimals.place-value');
    expect(groups[1].skillTitle).toBe('Decimal place value');
    expect(groups[1].count).toBe(2);
    expect(groups[1].learners).toEqual([
      { id: '4', alias: 'David' },
      { id: '5', alias: 'Eve' },
    ]);
  });

  it('breaks group count ties by skillCode alphabetically', () => {
    const learners = [
      { id: '1', alias: 'Alice', topSkill: 'skill.b' },
      { id: '2', alias: 'Bob', topSkill: 'skill.a' },
    ];

    const groups = groupLearnersByTopSkill(learners);
    expect(groups.map((g) => g.skillCode)).toEqual(['skill.a', 'skill.b']);
  });

  it('uses fallback title when metadata is missing', () => {
    const learners = [{ id: '1', alias: 'Alice', topSkill: 'math5.fractions.add' }];
    const groups = groupLearnersByTopSkill(learners);
    expect(groups[0].skillTitle).toBe('Add');
    expect(groups[0].subject).toBe(Subject.MATH);
  });
});

describe('ReportsService.suggestions', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  function createService() {
    const { ReportsService } = require('./reports.service');
    const {
      Enrollment,
      Lesson,
      SkillProgress,
      User,
    } = require('../../database/entities');

    const mockScope = {
      classroom: jest.fn().mockResolvedValue({}),
    };

    const mockDb = {
      getRepository: jest.fn((entity) => {
        if (entity === Enrollment) {
          return {
            findBy: jest
              .fn()
              .mockResolvedValue([{ studentId: 's1' }, { studentId: 's2' }]),
          };
        }
        if (entity === User) {
          return {
            findOneBy: jest.fn((criteria: { id: string }) => {
              if (criteria.id === 's1')
                return Promise.resolve({ id: 's1', alias: 'Alice', active: true });
              if (criteria.id === 's2')
                return Promise.resolve({ id: 's2', alias: 'Bob', active: true });
              return Promise.resolve(null);
            }),
          };
        }
        if (entity === SkillProgress) {
          return {
            findBy: jest.fn((criteria: { studentId: string }) => {
              if (criteria.studentId === 's1') {
                return Promise.resolve([
                  {
                    studentId: 's1',
                    skillCode: 'math5.fractions.add',
                    mastery: 0.3,
                    subject: Subject.MATH,
                  },
                  {
                    studentId: 's1',
                    skillCode: 'math5.decimals',
                    mastery: 0.7,
                    subject: Subject.MATH,
                  },
                ]);
              }
              if (criteria.studentId === 's2') {
                return Promise.resolve([
                  {
                    studentId: 's2',
                    skillCode: 'math5.fractions.add',
                    mastery: 0.8,
                    subject: Subject.MATH,
                  },
                  {
                    studentId: 's2',
                    skillCode: 'math5.decimals',
                    mastery: 0.4,
                    subject: Subject.MATH,
                  },
                ]);
              }
              return Promise.resolve([]);
            }),
          };
        }
        if (entity === Lesson) {
          return {
            createQueryBuilder: jest.fn(() => ({
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([
                {
                  skillCode: 'math5.fractions.add',
                  title: 'Adding fractions',
                  subject: Subject.MATH,
                },
                {
                  skillCode: 'math5.decimals',
                  title: 'Decimal place value',
                  subject: Subject.MATH,
                },
              ]),
            })),
          };
        }
        return {};
      }),
    };

    return new ReportsService(mockDb, mockScope);
  }

  const actor = {
    id: 'teacher-1',
    loginId: 'teacher-1',
    role: 'TEACHER',
    jurisdictionId: 'jur-1',
    schoolId: 'school-1',
  } as any;

  it('calls ML service when ML_SERVICE_URL is set and groups by top recommendations', async () => {
    process.env.ML_SERVICE_URL = 'http://localhost:8000';
    process.env.ML_SERVICE_TOKEN = 'test-token-123456789012345678';

    const fetchMock = jest.fn((url: string, init: any) => {
      const body = JSON.parse(init.body);
      // If learner has fractions at 0.3, recommend fractions first
      // If learner has decimals at 0.4, recommend decimals first
      const topSkill = body.skills[0].mastery === 0.3 ? 'math5.fractions.add' : 'math5.decimals';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ skillCode: topSkill }]),
      });
    });
    global.fetch = fetchMock as any;

    const service = createService();
    const result = await service.suggestions(actor, 'room-1');

    expect(result.method).toBe('model');
    expect(result.classroomId).toBe('room-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((g: any) => g.skillCode)).toEqual([
      'math5.decimals',
      'math5.fractions.add',
    ]);
  });

  it('falls back to lowest non-mastered skill when ML service fails', async () => {
    process.env.ML_SERVICE_URL = 'http://localhost:8000';
    process.env.ML_SERVICE_TOKEN = 'test-token-123456789012345678';

    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const service = createService();
    const result = await service.suggestions(actor, 'room-1');

    expect(result.method).toBe('fallback');
    expect(result.classroomId).toBe('room-1');
    expect(result.groups).toHaveLength(2);
    // For Alice: lowest is math5.fractions.add (0.3 < 0.7)
    // For Bob: lowest is math5.decimals (0.4 < 0.8)
    const fractionsGroup = result.groups.find((g: any) => g.skillCode === 'math5.fractions.add');
    const decimalsGroup = result.groups.find((g: any) => g.skillCode === 'math5.decimals');
    expect(fractionsGroup?.learners).toEqual([{ id: 's1', alias: 'Alice' }]);
    expect(decimalsGroup?.learners).toEqual([{ id: 's2', alias: 'Bob' }]);
  });

  it('uses fallback directly when ML_SERVICE_URL is not set', async () => {
    delete process.env.ML_SERVICE_URL;

    const service = createService();
    const result = await service.suggestions(actor, 'room-1');

    expect(result.method).toBe('fallback');
    expect(result.groups).toHaveLength(2);
  });
});

