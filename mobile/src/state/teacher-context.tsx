import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { classroomFixture, classroomReportFixture, teacherExtrasFixture } from '../domain/teacher-fixture';
import type { Page, ServerClassroom } from '../domain/server';
import type { ClassroomReport } from '../domain/teacher';
import { useOnline } from './online-context';

/** The one switch between fixture and live data for the Teacher shell. Screens never read it. */
export const TEACHER_DATA_SOURCE: 'fixture' | 'live' = 'fixture';

export interface TeacherData {
  classroom: ServerClassroom;
  report: ClassroomReport;
  /** Fixture-only until the backend has Impact Points and a class count. */
  impactPoints: number;
  classCount: number;
  loadedAt: string;
}

export type TeacherLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: TeacherData };

interface TeacherValue { load: TeacherLoad; reload(): void }
const TeacherContext = createContext<TeacherValue | null>(null);

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const { caretakerGet } = useOnline();
  const [load, setLoad] = useState<TeacherLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => { setLoad({ status: 'loading' }); setAttempt((n) => n + 1); }, []);

  useEffect(() => {
    let live = true;
    void (async (): Promise<TeacherData> => {
      if (TEACHER_DATA_SOURCE === 'fixture')
        return { classroom: classroomFixture, report: classroomReportFixture, ...teacherExtrasFixture, loadedAt: new Date().toISOString() };
      // ponytail: the first Classroom stands in for a picker; "My Classes" opens that when it exists.
      const page = await caretakerGet<Page<ServerClassroom>>('classrooms?page=1&limit=20');
      const classroom = page.items[0];
      if (!classroom) throw new Error('No Classroom is assigned to this Teacher account yet. Ask your LGU Admin.');
      const report = await caretakerGet<ClassroomReport>(`reports/classrooms/${classroom.id}`);
      return { classroom, report, impactPoints: 0, classCount: page.total, loadedAt: new Date().toISOString() };
    })()
      .then((data) => { if (live) setLoad({ status: 'ready', data }); })
      .catch((error: unknown) => { if (live) setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Could not load the Classroom report.' }); });
    return () => { live = false; };
  }, [attempt, caretakerGet]);

  return <TeacherContext.Provider value={{ load, reload }}>{children}</TeacherContext.Provider>;
}

export function useTeacher() {
  const value = useContext(TeacherContext);
  if (!value) throw new Error('TeacherProvider is required');
  return value;
}
