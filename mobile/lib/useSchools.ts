import { fetchSchools } from './api';
import { School } from './types';
import { createCachedList } from './cachedList';

const useSchoolRows = createCachedList<School>(fetchSchools);

export function useSchools() {
  const { rows: schools, loading, refresh } = useSchoolRows();
  return { schools, active: schools.filter((s) => s.is_active), loading, refresh };
}
