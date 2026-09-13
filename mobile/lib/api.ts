import { supabase, PHOTO_BUCKET } from './supabase';
import {
  Listing, Profile, Report, ListingDraft, BlockedUser, School, BookRequest, RequestResponse,
  RequestDraft, BookAlert, AlertDraft, Notification, ContactMethod,
} from './types';

// ---- LISTINGS ----

// Browse feed: available listings from the last 6 months, newest first. Exactly
// the website's loadListings query. Both categories come back in one call; the
// UI splits them so switching tabs is instant and offline-safe.
export async function fetchListings(): Promise<Listing[]> {
  const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6).toISOString();
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'available')
    .gte('created_at', sixMonthsAgo)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return normalizeListings(data);
}

// Rows written before the category column existed come back without it once
// the migration runs (default 'school'), but a cached older row may lack it.
function normalizeListings(rows: unknown): Listing[] {
  return ((rows as Listing[]) ?? []).map((l) => ({
    ...l,
    category: l.category === 'reading' ? 'reading' : 'school',
    school_id: l.school_id ?? null,
  }));
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalizeListings([data])[0] : null;
}

export async function fetchMyListings(ownerId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return normalizeListings(data);
}

// PostgREST reports an unknown column as PGRST204 (schema cache) or Postgres 42703.
// Until supabase-schools-requests-alerts.sql is applied, listings has no category /
// school_id columns; retry without them so an older backend never blocks posting.
function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === 'PGRST204' || err.code === '42703' || /column .*(schema cache|does not exist)/i.test(err.message ?? '');
}

function withoutSchemaExtras(draft: Partial<ListingDraft>): Partial<ListingDraft> {
  const copy: Partial<ListingDraft> = { ...draft };
  delete copy.category;
  delete copy.school_id;
  return copy;
}

export async function insertListing(draft: ListingDraft, ownerId: string): Promise<void> {
  let { error } = await supabase.from('listings').insert({ ...draft, owner_id: ownerId });
  if (error && isMissingColumnError(error)) {
    ({ error } = await supabase.from('listings').insert({ ...withoutSchemaExtras(draft), owner_id: ownerId }));
  }
  if (error) throw error;
}

export async function updateListing(id: string, draft: Partial<ListingDraft>): Promise<void> {
  let { error } = await supabase.from('listings').update(draft).eq('id', id);
  if (error && isMissingColumnError(error)) {
    ({ error } = await supabase.from('listings').update(withoutSchemaExtras(draft)).eq('id', id));
  }
  if (error) throw error;
}

export async function setListingStatus(id: string, status: 'available' | 'claimed'): Promise<void> {
  const { error } = await supabase.from('listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) throw error;
}

// Total books ever shared (available + claimed). Powers the live counter, same
// number the website's loadImpact uses.
export async function fetchSharedCount(): Promise<number> {
  const { count, error } = await supabase.from('listings').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

// ---- PHOTO UPLOAD ----
// The website uploads File objects; on native we have a local file URI, so we
// read it as an ArrayBuffer and upload the bytes to the same bucket.
const EXT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

export async function uploadPhoto(uri: string, ownerId: string): Promise<string> {
  const rawExt = (uri.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = EXT_TYPES[rawExt] ? rawExt : 'jpg';
  const contentType = EXT_TYPES[ext];
  const res = await fetch(uri);
  const arrayBuffer = await res.arrayBuffer();
  const rand = Math.random().toString(36).slice(2, 7);
  const fileName = `${ownerId}/${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(fileName, arrayBuffer, { contentType });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// ---- SCHOOLS ----
// Public read returns active schools only (RLS); admins also get inactive ones.

export async function fetchSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as School[]) ?? [];
}

export async function addSchool(name: string, area: string | null): Promise<School> {
  const { data, error } = await supabase
    .from('schools')
    .insert({ name: name.trim(), area: area?.trim() || null })
    .select('*')
    .single();
  if (error) throw error;
  return data as School;
}

export async function updateSchool(
  id: string,
  updates: Partial<Pick<School, 'name' | 'area' | 'is_active' | 'sort_order'>>,
): Promise<void> {
  const { error } = await supabase.from('schools').update(updates).eq('id', id);
  if (error) throw error;
}

// ---- PROFILE ----

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // no row
    throw error;
  }
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'school' | 'grade_level'>>,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

export async function deleteAccountData(userId: string): Promise<void> {
  const { error: e1 } = await supabase.from('listings').delete().eq('owner_id', userId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from('profiles')
    .update({ full_name: null, school: null, grade_level: null })
    .eq('id', userId);
  if (e2) throw e2;
}

// ---- REPORTS ----

export async function submitReport(
  listingId: string,
  reporterId: string,
  reason: string,
  notes: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .insert({ listing_id: listingId, reporter_id: reporterId, reason, notes });
  if (error) throw error;
}

// ---- BLOCKING ----
// Apple Guideline 1.2 requires a way to block abusive users. A block hides the
// blocked user's listings from the blocker's feed instantly (see useListings /
// AuthProvider), and also files a report so it lands in the admin queue.

export async function fetchBlockedIds(blockerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', blockerId);
  if (error) throw error;
  return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
}

export async function fetchBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('*')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as BlockedUser[]) ?? [];
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
  blockedName: string | null,
  listingId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId, blocked_name: blockedName },
      { onConflict: 'blocker_id,blocked_id' },
    );
  if (error) throw error;
  // Notify the developer: a block also files a report so it surfaces in the
  // admin moderation queue. Best-effort - a failed report must not fail the block.
  if (listingId) {
    const { error: reportErr } = await supabase
      .from('reports')
      .insert({
        listing_id: listingId,
        reporter_id: blockerId,
        reason: 'inappropriate',
        notes: 'User blocked by a reporter. Please review this listing and user.',
      });
    if (reportErr) console.warn('block: report insert failed:', reportErr.message);
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

// ---- WANTED BOARD (book requests) ----

export async function fetchOpenRequests(): Promise<BookRequest[]> {
  const { data, error } = await supabase
    .from('book_requests')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as BookRequest[]) ?? [];
}

export async function fetchMyRequests(requesterId: string): Promise<BookRequest[]> {
  const { data, error } = await supabase
    .from('book_requests')
    .select('*')
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as BookRequest[]) ?? [];
}

export async function fetchRequestById(id: string): Promise<BookRequest | null> {
  const { data, error } = await supabase.from('book_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as BookRequest) ?? null;
}

export async function insertRequest(draft: RequestDraft, requesterId: string): Promise<void> {
  const { error } = await supabase.from('book_requests').insert({ ...draft, requester_id: requesterId });
  if (error) throw error;
}

export async function setRequestStatus(id: string, status: 'open' | 'fulfilled'): Promise<void> {
  const { error } = await supabase.from('book_requests').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteRequest(id: string): Promise<void> {
  const { error } = await supabase.from('book_requests').delete().eq('id', id);
  if (error) throw error;
}

// Replies are visible only to the requester and the responder (RLS), so a
// requester sees all replies to their request and a responder sees their own.
export async function fetchResponsesForRequest(requestId: string): Promise<RequestResponse[]> {
  const { data, error } = await supabase
    .from('request_responses')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as RequestResponse[]) ?? [];
}

export async function respondToRequest(
  requestId: string,
  responderId: string,
  responderName: string,
  contactMethod: ContactMethod,
  contactValue: string,
  message: string | null,
): Promise<void> {
  const { error } = await supabase.from('request_responses').upsert(
    {
      request_id: requestId,
      responder_id: responderId,
      responder_name: responderName,
      contact_method: contactMethod,
      contact_value: contactValue,
      message,
    },
    { onConflict: 'request_id,responder_id' },
  );
  if (error) throw error;
}

// ---- ALERTS (saved searches) ----

export async function fetchMyAlerts(userId: string): Promise<BookAlert[]> {
  const { data, error } = await supabase
    .from('book_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as BookAlert[]) ?? [];
}

export async function insertAlert(draft: AlertDraft, userId: string): Promise<BookAlert> {
  const { data, error } = await supabase
    .from('book_alerts')
    .insert({ ...draft, user_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data as BookAlert;
}

export async function deleteAlert(id: string): Promise<void> {
  const { error } = await supabase.from('book_alerts').delete().eq('id', id);
  if (error) throw error;
}

// ---- NOTIFICATIONS (in-app inbox) ----

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data as Notification[]) ?? [];
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (ids && ids.length) q = q.in('id', ids);
  const { error } = await q;
  if (error) throw error;
}

// ---- ADMIN ----

export async function fetchAllListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return normalizeListings(data);
}

export interface PendingReport extends Report {
  listing: { id: string; title: string; owner_name: string; owner_id: string | null; status: string } | null;
}

export async function fetchPendingReports(): Promise<PendingReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*, listing:listings(id, title, owner_name, owner_id, status)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as PendingReport[]) ?? [];
}

export async function dismissReport(reportId: string): Promise<void> {
  const { error } = await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
  if (error) throw error;
}

// Eject a user: remove every listing they own. Admin-only (enforced by the
// listings_delete_own_or_admin RLS policy). Used to act on reports within 24h.
export async function deleteListingsByOwner(ownerId: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('owner_id', ownerId);
  if (error) throw error;
}

// ---- SITE SETTINGS ----

export async function fetchShowLiveCounter(): Promise<boolean> {
  const { data, error } = await supabase.from('site_settings').select('key, value').eq('key', 'show_live_counter').maybeSingle();
  if (error) return false;
  const v = (data as { value: unknown } | null)?.value;
  return v === true || v === 'true';
}

// Admin-only (site_settings RLS). Same upsert the website's admin switch uses.
export async function setShowLiveCounter(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: 'show_live_counter', value: enabled }, { onConflict: 'key' });
  if (error) throw error;
}
