import type { ServerUser } from './server';
import { fixtureLibrary } from './admin-library';
import type { AdminData, DeviceRecord, EngagementDay, ReachRecord } from './admin';

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

const reach = (quarter: string, barangay: string, learners: number, lessons: number, offlineLessons: number): ReachRecord =>
  ({ quarter, barangay, learners, lessons, offlineLessons });

function fixtureReach(today: string): ReachRecord[] {
  const year = Number(today.slice(0, 4));
  const current = `${year}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
  return [
    reach(current, 'Pembo', 210, 1400, 1050), reach(current, 'Cembo', 160, 900, 640),
    reach(`${year}-Q3`, 'Pembo', 520, 4000, 3300), reach(`${year}-Q3`, 'Cembo', 410, 3100, 2500), reach(`${year}-Q3`, 'Rizal', 274, 2000, 1480),
    reach(`${year}-Q2`, 'Pembo', 480, 3600, 2800), reach(`${year}-Q2`, 'Cembo', 350, 2500, 1900),
  ];
}

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];

export function fixtureDevices(today: string): DeviceRecord[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: 160 }, (_, i) => ({
    id: `tab-${i}`,
    name: `Shared Tablet ${i + 1}`,
    grade: GRADES[i % GRADES.length],
    classroom: `Section ${String.fromCharCode(65 + (i % 4))}`,
    online: i < 142,
    updateAvailable: i < 9,
    lastSeenAt: i < 142 ? null : new Date(end - (i - 141) * DAY).toISOString(),
    storageUsedPercent: 30 + ((i * 7) % 60),
  }));
}

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
    users: [...Array.from({ length: 42 }, (_, i) => user(i + 1, 'TEACHER')), user(100, 'LGU_ADMIN'), ...Array.from({ length: 8 }, (_, i) => ({ ...user(200 + i, 'STUDENT'), active: i % 4 !== 3 }))],
    devices: fixtureDevices(today),
    library: fixtureLibrary(),
    engagement: fixtureEngagement(today),
    reach: fixtureReach(today),
  };
}
