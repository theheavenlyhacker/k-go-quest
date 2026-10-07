import { useCallback, useEffect, useState } from 'react';

import type { AdminData } from '../domain/admin';
import { fixtureAdminData } from '../domain/admin-fixtures';

export type AdminLoad = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: AdminData; today: string };

// ponytail: fixtures are the only data source. Live wiring replaces this one function; no screen changes.
async function loadAdminData(today: string): Promise<AdminData> {
  return fixtureAdminData(today);
}

/** The Admin shell's data, with the loading and error states a live source will need. */
export function useAdminData(): AdminLoad & { reload: () => void } {
  const [state, setState] = useState<AdminLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const today = new Date().toISOString().slice(0, 10);
    loadAdminData(today)
      .then((data) => { if (live) setState({ status: 'ready', data, today }); })
      .catch(() => { if (live) setState({ status: 'error' }); });
    return () => { live = false; };
  }, [attempt]);
  const reload = useCallback(() => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }, []);
  return { ...state, reload };
}
