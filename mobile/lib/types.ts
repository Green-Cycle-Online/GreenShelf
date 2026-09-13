// Shapes mirror the Supabase tables the website uses (see app.js). Kept loose
// where the DB is loose (nullable text columns) so we never fight real rows.

export type ListingStatus = 'available' | 'claimed';
export type Condition = 'new' | 'good' | 'worn';
export type ContactMethod = 'whatsapp' | 'phone' | 'email';
export type ReportReason = 'spam' | 'inappropriate' | 'duplicate' | 'wrong_info' | 'other';
export type ReportStatus = 'pending' | 'dismissed';

// 'school' = curriculum textbooks (subject + grade). 'reading' = any other book:
// `subject` holds the genre and `grade_level` holds an age band, so every
// existing filter, card and query keeps working without nullable columns.
export type Category = 'school' | 'reading';

export interface Listing {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  area: string | null;
  school: string | null;
  school_id: string | null;
  category: Category;
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

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  blocked_name: string | null;
  created_at: string;
}

// Admin-managed list of schools (public.schools). Inactive rows are hidden
// from everyone but admins by RLS.
export interface School {
  id: string;
  name: string;
  area: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// Wanted board: a family posts a book they need (public.book_requests).
export type RequestStatus = 'open' | 'fulfilled';

export interface BookRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  title: string;
  category: Category;
  subject: string | null;
  grade_level: string | null;
  area: string | null;
  school_id: string | null;
  school: string | null;
  note: string | null;
  status: RequestStatus;
  created_at: string;
}

// "I have this" reply to a request. Only the requester and responder can read it.
export interface RequestResponse {
  id: string;
  request_id: string;
  responder_id: string;
  responder_name: string;
  contact_method: ContactMethod | null;
  contact_value: string | null;
  message: string | null;
  listing_id: string | null;
  read_at: string | null;
  created_at: string;
}

// A saved search. A DB trigger turns matching new listings into notifications.
export interface BookAlert {
  id: string;
  user_id: string;
  category: Category;
  school_id: string | null;
  grade_level: string | null;
  subject: string | null;
  area: string | null;
  created_at: string;
}

export type NotificationKind = 'listing_match' | 'request_response';

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  listing_id: string | null;
  request_id: string | null;
  alert_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

// Draft used by the create-listing form before it becomes a Listing row.
export interface ListingDraft {
  title: string;
  subject: string;
  grade_level: string;
  area: string;
  school: string | null;
  school_id: string | null;
  category: Category;
  condition: Condition | '';
  description: string | null;
  owner_name: string;
  contact_method: ContactMethod;
  contact_value: string;
  photos: string[] | null;
}

export interface RequestDraft {
  title: string;
  category: Category;
  subject: string | null;
  grade_level: string | null;
  area: string | null;
  school_id: string | null;
  school: string | null;
  note: string | null;
  requester_name: string;
}

export interface AlertDraft {
  category: Category;
  school_id: string | null;
  grade_level: string | null;
  subject: string | null;
  area: string | null;
}
