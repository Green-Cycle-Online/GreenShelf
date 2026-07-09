import { supabase, PHOTO_BUCKET } from './supabase';
import { Listing, Profile, Report, ListingDraft } from './types';

// ---- LISTINGS ----

// Browse feed: available listings from the last 6 months, newest first. Exactly
// the website's loadListings query.
export async function fetchListings(): Promise<Listing[]> {
  const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6).toISOString();
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'available')
    .gte('created_at', sixMonthsAgo)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Listing[]) ?? [];
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data, error } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Listing) ?? null;
}

export async function fetchMyListings(ownerId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Listing[]) ?? [];
}

export async function insertListing(draft: ListingDraft, ownerId: string): Promise<void> {
  const { error } = await supabase.from('listings').insert({ ...draft, owner_id: ownerId });
  if (error) throw error;
}

export async function updateListing(id: string, draft: Partial<ListingDraft>): Promise<void> {
  const { error } = await supabase.from('listings').update(draft).eq('id', id);
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

// ---- ADMIN ----

export async function fetchAllListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Listing[]) ?? [];
}

export interface PendingReport extends Report {
  listing: { id: string; title: string; owner_name: string; status: string } | null;
}

export async function fetchPendingReports(): Promise<PendingReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*, listing:listings(id, title, owner_name, status)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as PendingReport[]) ?? [];
}

export async function dismissReport(reportId: string): Promise<void> {
  const { error } = await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
  if (error) throw error;
}
