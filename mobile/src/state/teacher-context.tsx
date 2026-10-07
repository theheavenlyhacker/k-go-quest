import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { getRepository } from '../data/storage';
import { dataSource } from '../domain/data-source';
import type { ServerClassroom } from '../domain/server';
import { parseClassroomReport, type ClassroomReport } from '../domain/teacher';
import { classroomFixture, classroomReportFixture, classroomsFixture, teacherExtrasFixture } from '../domain/teacher-fixture';
import { loadCached, parseClassrooms, type Cache } from '../domain/teacher-load';
import type { QuizRecord, TeacherRewardsRecord } from '../domain/teacher-rewards';
import { quizzesFixture, teacherRewardsFixture } from '../domain/teacher-rewards-fixture';
import { useOnline } from './online-context';

/** The one switch between fixture and live data for the Teacher shell (see `domain/data-source.ts`). Screens never read it, except to skip a live-only call. */
export const TEACHER_DATA_SOURCE = dataSource(process.env.EXPO_PUBLIC_DATA_SOURCE, process.env.EXPO_PUBLIC_API_URL);

export interface TeacherData {
  classroom: ServerClassroom;
  /** Every Classroom this Teacher teaches; the sidebar offers a picker when there is more than one. */
  classrooms: ServerClassroom[];
  report: ClassroomReport;
  /** Demo: Impact Points have no backend concept, so they stay fixture-backed and are tagged "Demo" on screen. */
  impactPoints: number;
  /** Quizzes are not stored on the server yet, so live mode lists none. Credentials and badges are Demo too. */
  quizzes: QuizRecord[];
  rewards: TeacherRewardsRecord;
  /** When the server last answered with this report. */
  loadedAt: string;
  /** True when the server was unreachable and `report` is the last copy this tablet saved. */
  stale: boolean;
}

export type TeacherLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: TeacherData };

interface TeacherValue {
  load: TeacherLoad;
  reload(): void;
  /** Opens another of the Teacher's Classrooms. */
  select(classroomId: string): void;
  /** Alert id to the ISO time it was resolved. Saved on the tablet per Teacher, so it survives a restart. */
  resolved: Record<string, string>;
  resolve(id: string): void;
}
const TeacherContext = createContext<TeacherValue | null>(null);

const RESOLVED_KEY = 'resolved-alerts';

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const { caretakerGet, server } = useOnline();
  const owner = server?.user.id ?? 'teacher';
  const [load, setLoad] = useState<TeacherLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  // The latest map, so two quick Resolves both land.
  const latest = useRef(resolved);

  useEffect(() => {
    let live = true;
    void getRepository()
      .then((repo) => repo.cacheGet<Record<string, string>>(owner, RESOLVED_KEY))
      // Resolves made before this read finished are kept.
      .then((saved) => { if (live && saved) { latest.current = { ...saved, ...latest.current }; setResolved(latest.current); } })
      .catch(() => undefined);
    return () => { live = false; };
  }, [owner]);

  const resolve = useCallback((id: string) => {
    const next = { ...latest.current, [id]: new Date().toISOString() };
    latest.current = next;
    setResolved(next);
    void getRepository().then((repo) => repo.cachePut(owner, RESOLVED_KEY, next)).catch(() => undefined);
  }, [owner]);
  const reload = useCallback(() => { setLoad({ status: 'loading' }); setAttempt((n) => n + 1); }, []);
  const select = useCallback((id: string) => { setSelected(id); reload(); }, [reload]);

  useEffect(() => {
    let live = true;
    void (async (): Promise<TeacherData> => {
      if (TEACHER_DATA_SOURCE === 'fixture') {
        const classroom = classroomsFixture.find((c) => c.id === selected) ?? classroomFixture;
        return { classroom, classrooms: classroomsFixture, report: classroomReportFixture, ...teacherExtrasFixture, quizzes: quizzesFixture, rewards: teacherRewardsFixture, loadedAt: new Date().toISOString(), stale: false };
      }
      const repo = await getRepository();
      const cache = <T,>(key: string): Cache<T> => ({ get: () => repo.cacheGet(owner, key), put: (entry) => repo.cachePut(owner, key, entry) });
      const rooms = await loadCached(() => caretakerGet('classrooms?page=1&limit=20'), parseClassrooms, cache('classrooms'));
      const classroom = rooms.value.find((c) => c.id === selected) ?? rooms.value[0];
      if (!classroom) throw new Error('No Classroom is assigned to this Teacher account yet. Ask your LGU Admin.');
      const report = await loadCached(() => caretakerGet(`reports/classrooms/${classroom.id}`), parseClassroomReport, cache(`report:${classroom.id}`));
      return {
        classroom, classrooms: rooms.value, report: report.value, ...teacherExtrasFixture, quizzes: [], rewards: teacherRewardsFixture,
        loadedAt: report.fetchedAt, stale: report.stale || rooms.stale,
      };
    })()
      .then((data) => { if (live) setLoad({ status: 'ready', data }); })
      .catch((error: unknown) => { if (live) setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Could not load the Classroom report.' }); });
    return () => { live = false; };
  }, [attempt, caretakerGet, owner, selected]);

  return <TeacherContext.Provider value={{ load, reload, select, resolved, resolve }}>{children}</TeacherContext.Provider>;
}

export function useTeacher() {
  const value = useContext(TeacherContext);
  if (!value) throw new Error('TeacherProvider is required');
  return value;
}
