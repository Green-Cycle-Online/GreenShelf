// Exact option lists from the website (app.js), so listings created in the app
// slot into the same filters as ones created on the web.

export const BASE_SUBJECTS = ['Math', 'Science', 'English', 'Arabic', 'Social Studies', 'Business'];

export const AREAS_MUSCAT = [
  'Al Khoud', 'Al Khuwair', 'Al Hail', 'Al Mabela', 'Al Mawaleh', 'Azaiba',
  'Bausher', 'Ghubra', 'Madinat Qaboos', 'Mutrah', 'Qurum', 'Ruwi', 'Seeb',
];

export const AREAS_OTHER_OMAN = [
  'Bahla', 'Barka', 'Buraimi', 'Ibri', 'Khasab', 'Liwa', 'Nizwa',
  'Rustaq', 'Saham', 'Salalah', 'Sohar', 'Sur', 'Suwaiq',
];

export const ALL_AREAS = [...AREAS_MUSCAT, ...AREAS_OTHER_OMAN];

export const GRADES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`);

export const CONDITIONS: { value: 'new' | 'good' | 'worn'; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'worn', label: 'Worn' },
];

export const CONTACT_METHODS: { value: 'whatsapp' | 'phone' | 'email'; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
];

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'duplicate', label: 'Duplicate listing' },
  { value: 'wrong_info', label: 'Wrong information' },
  { value: 'other', label: 'Other' },
];

export const MAX_PHOTOS = 4;
export const PAGE_SIZE = 24;

export const SUPPORT_EMAIL = 'greenshelf1320@gmail.com';
export const SITE_URL = 'https://greenshelf.online';
