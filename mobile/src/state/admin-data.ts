import { useAdmin, type AdminLoad } from './admin-context';

export type { AdminLoad } from './admin-context';

/** The Admin shell's data, with the loading and error states backed by AdminProvider. */
export function useAdminData(): AdminLoad & { reload: () => void } {
  const { load, reload } = useAdmin();
  return { ...load, reload };
}

