import type { ServerUser } from './server';
import type { AdminData, EngagementDay } from './admin';

/**
 * Fixtures shaped like the backend responses, until the Admin shell is wired to
 * the server. Swapping `loadAdminData` for API calls changes no screen.
 */
const DAY = 86_400_000;
const PER_DAY = [610, 740, 820, 900, 860, 520, 470, 540, 780, 860, 810, 1000, 890, 560];

export function fixtureEngagement(today: string): EngagementDay[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return PER_DAY.map((activeLearners, i) => ({ date: new Date(end - (PER_DAY.length - 1 - i) * DAY).toISOString().slice(0, 10), activeLearners }));
}

const user = (n: number, role: ServerUser['role']): ServerUser => ({
  id: `user-${n}`, loginId: `${role.toLowerCase()}-${n}`, alias: `${role === 'TEACHER' ? 'Teacher' : 'Learner'} ${n}`,
  role, jurisdictionId: 'jur-1', schoolId: 'school-1', coins: 0, active: true,
});

export function fixtureAdminData(today: string): AdminData {
  return {
    schoolName: 'Brgy. Pembo Elementary School',
    impact: {
      jurisdictionId: 'jur-1',
      generatedAt: `${today}T00:00:00.000Z`,
      schools: 1,
      activeStudents: 1204,
      studentsWithPractice: 951,
      meanEstimatedMastery: 0.58,
      attempts: 18420,
      disclaimer: 'Practice estimates, not measured learning impact. No cost or hours-saved claims are inferred.',
    },
    users: [...Array.from({ length: 42 }, (_, i) => user(i + 1, 'TEACHER')), user(100, 'LGU_ADMIN')],
    devices: Array.from({ length: 160 }, (_, i) => ({ id: `tab-${i}`, name: `Shared Tablet ${i + 1}`, lastSeenAt: null, online: i < 142 })),
    engagement: fixtureEngagement(today),
  };
}
