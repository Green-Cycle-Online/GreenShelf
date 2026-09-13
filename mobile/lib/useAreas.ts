import { fetchAreas } from './api';
import { Area } from './types';
import { AREAS_MUSCAT, AREAS_OTHER_OMAN } from './constants';
import { createCachedList } from './cachedList';

export type AreaOption = Pick<Area, 'name' | 'region'>;

// The list the app always shipped with. Used until public.areas exists, or on
// a cold offline start, so the pickers are never empty.
export const FALLBACK_AREAS: AreaOption[] = [
  ...AREAS_MUSCAT.map((name) => ({ name, region: 'Muscat' })),
  ...AREAS_OTHER_OMAN.map((name) => ({ name, region: 'Outside Muscat' })),
];

const useAreaRows = createCachedList<Area>(fetchAreas);

export function useAreas() {
  const { rows: areas, loading, refresh } = useAreaRows();
  const live = areas.filter((a) => a.is_active);
  const active: AreaOption[] = live.length ? live.map((a) => ({ name: a.name, region: a.region })) : FALLBACK_AREAS;
  return { areas, active, names: active.map((a) => a.name), loading, refresh };
}
