import AsyncStorage from '@react-native-async-storage/async-storage';
import { ContactMethod } from './types';

// Remembered so repeat posters never retype name, contact, area or school for
// every listing. Same idea (and key name) as the website's gs_poster_defaults.
const KEY = 'gs_poster_defaults';

export interface PosterDefaults {
  owner_name?: string;
  contact_method?: ContactMethod;
  contact_value?: string;
  area?: string;
  school?: string;
}

export async function loadPosterDefaults(): Promise<PosterDefaults> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const d = JSON.parse(raw);
    return {
      owner_name: typeof d.owner_name === 'string' ? d.owner_name : undefined,
      contact_method: ['whatsapp', 'phone', 'email'].includes(d.contact_method)
        ? (d.contact_method as ContactMethod)
        : undefined,
      contact_value: typeof d.contact_value === 'string' ? d.contact_value : undefined,
      area: typeof d.area === 'string' ? d.area : undefined,
      school: typeof d.school === 'string' ? d.school : undefined,
    };
  } catch {
    return {};
  }
}

export function savePosterDefaults(d: PosterDefaults): void {
  AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {});
}
