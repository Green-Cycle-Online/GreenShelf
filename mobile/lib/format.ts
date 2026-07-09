import { ContactMethod } from './types';

// Relative time, same thresholds as the website's formatRelativeTime.
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function isNewListing(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
}

// Normalise an Omani number to full international digits (968 + 8 local digits),
// however the lister typed it. Copied from the website so tel:/wa.me links behave
// identically. Without this a bare "91234567" dials +91 (India).
export function normalizeOmanDigits(value: string): string {
  let d = String(value).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('968')) return d;
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 8) return '968' + d;
  return d;
}

export function getContactLink(method: ContactMethod, value: string): string {
  if (method === 'email') return `mailto:${encodeURIComponent(value)}`;
  const digits = normalizeOmanDigits(value);
  if (method === 'whatsapp') return `https://wa.me/${digits}`;
  if (method === 'phone') return `tel:+${digits}`;
  return '#';
}

export function contactLabelFor(method: ContactMethod): string {
  if (method === 'whatsapp') return 'WhatsApp';
  if (method === 'phone') return 'Call';
  if (method === 'email') return 'Email';
  return '';
}

// Deterministic 0..n-1 index from a string, so a subject always gets the same
// cover colourway (matches coverIndex in app.js).
export function coverIndex(str: string, n: number): number {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
}

// The muted "footer" line on a generated cover: grade . subject.
export function coverFoot(grade?: string | null, subject?: string | null): string {
  return [grade, subject].filter(Boolean).join(' · ');
}
