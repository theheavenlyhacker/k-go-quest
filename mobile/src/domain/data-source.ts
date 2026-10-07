/**
 * Where the Teacher shell reads from. Live whenever an API address is set
 * (`EXPO_PUBLIC_API_URL`) unless `EXPO_PUBLIC_DATA_SOURCE=fixture` says otherwise;
 * with neither, fixtures, so tests and offline demos need no server.
 */
export type DataSource = 'fixture' | 'live';

export function dataSource(source: string | undefined, apiUrl: string | undefined): DataSource {
  const wanted = source?.trim().toLowerCase();
  if (wanted === 'fixture') return 'fixture';
  return wanted === 'live' || apiUrl?.trim() ? 'live' : 'fixture';
}
