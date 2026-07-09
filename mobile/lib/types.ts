// Shapes mirror the Supabase tables the website uses (see app.js). Kept loose
// where the DB is loose (nullable text columns) so we never fight real rows.

export type ListingStatus = 'available' | 'claimed';
export type Condition = 'new' | 'good' | 'worn';
export type ContactMethod = 'whatsapp' | 'phone' | 'email';
export type ReportReason = 'spam' | 'inappropriate' | 'duplicate' | 'wrong_info' | 'other';
export type ReportStatus = 'pending' | 'dismissed';

export interface Listing {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  area: string | null;
  school: string | null;
  condition: Condition;
  description: string | null;
  owner_name: string;
  owner_id: string | null;
  contact_method: ContactMethod;
  contact_value: string;
  photos: string[] | null;
  status: ListingStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  school: string | null;
  grade_level: string | null;
  is_admin: boolean | null;
}

export interface Report {
  id: string;
  listing_id: string;
  reporter_id: string | null;
  reason: ReportReason;
  notes: string | null;
  status: ReportStatus;
  created_at: string;
}

// Draft used by the create-listing form before it becomes a Listing row.
export interface ListingDraft {
  title: string;
  subject: string;
  grade_level: string;
  area: string;
  school: string | null;
  condition: Condition | '';
  description: string | null;
  owner_name: string;
  contact_method: ContactMethod;
  contact_value: string;
  photos: string[] | null;
}
