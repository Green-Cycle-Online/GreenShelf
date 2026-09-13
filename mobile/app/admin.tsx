import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useSchools } from '../lib/useSchools';
import { useAreas } from '../lib/useAreas';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { Option, Select } from '../components/Select';
import {
  fetchAllListings, fetchPendingReports, dismissReport, deleteListing, deleteListingsByOwner, PendingReport,
  addSchool, updateSchool, addArea, updateArea, fetchShowLiveCounter, setShowLiveCounter,
} from '../lib/api';
import { Listing } from '../lib/types';
import { REPORT_REASONS } from '../lib/constants';
import { formatRelativeTime } from '../lib/format';
import { haptic } from '../lib/haptics';

function countBy(items: Listing[], key: keyof Listing): [string, number][] {
  const counts: Record<string, number> = Object.create(null);
  for (const it of items) {
    const v = it[key] as string;
    if (v == null || v === '') continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export default function AdminScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { schools, refresh: refreshSchools } = useSchools();
  const { areas, refresh: refreshAreas } = useAreas();

  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveCounter, setLiveCounter] = useState(false);
  const [savingCounter, setSavingCounter] = useState(false);

  const [newSchool, setNewSchool] = useState('');
  const [newArea, setNewArea] = useState('');
  const [addingSchool, setAddingSchool] = useState(false);

  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaRegion, setNewAreaRegion] = useState('Muscat');
  const [addingArea, setAddingArea] = useState(false);
  const regionOptions: Option[] = [
    { label: 'Muscat', value: 'Muscat' },
    { label: 'Outside Muscat', value: 'Outside Muscat' },
  ];

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchAllListings(), fetchPendingReports().catch(() => []), fetchShowLiveCounter()])
      .then(([l, r, c]) => {
        setListings(l);
        setReports(r);
        setLiveCounter(c);
      })
      .catch(() => toast('Could not load stats.', 'error'))
      .finally(() => setLoading(false));
    refreshSchools();
    refreshAreas();
  }, [refreshSchools, refreshAreas]);

  useFocusEffect(useCallback(() => { if (isAdmin) load(); }, [isAdmin, load]));

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <Text style={{ color: colors.inkSoft, fontFamily: font.body }}>Admins only.</Text>
      </View>
    );
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats = {
    total: listings.length,
    available: listings.filter((l) => l.status === 'available').length,
    claimed: listings.filter((l) => l.status === 'claimed').length,
    reading: listings.filter((l) => l.category === 'reading').length,
    last7: listings.filter((l) => new Date(l.created_at).getTime() > sevenDaysAgo).length,
    photos: listings.reduce((s, l) => s + (Array.isArray(l.photos) ? l.photos.length : 0), 0),
  };

  async function toggleCounter(next: boolean) {
    setSavingCounter(true);
    try {
      await setShowLiveCounter(next);
      setLiveCounter(next);
      haptic.selection();
      toast(next ? 'Live counter enabled.' : 'Live counter hidden.', 'success');
    } catch (e: any) {
      toast(e.message || t('common.error'), 'error');
    } finally {
      setSavingCounter(false);
    }
  }

  async function submitSchool() {
    const name = newSchool.trim();
    if (!name) return;
    setAddingSchool(true);
    try {
      await addSchool(name, newArea.trim() || null);
      setNewSchool('');
      setNewArea('');
      await refreshSchools();
      haptic.success();
      toast(t('admin.schoolAdded'), 'success');
    } catch (e: any) {
      toast(e?.code === '23505' ? t('admin.schoolExists') : e.message || t('common.error'), 'error');
    } finally {
      setAddingSchool(false);
    }
  }

  async function toggleSchool(id: string, active: boolean) {
    try {
      await updateSchool(id, { is_active: !active });
      await refreshSchools();
      haptic.selection();
    } catch (e: any) {
      toast(e.message || t('common.error'), 'error');
    }
  }

  async function submitArea() {
    const name = newAreaName.trim();
    if (!name) return;
    setAddingArea(true);
    try {
      await addArea(name, newAreaRegion);
      setNewAreaName('');
      await refreshAreas();
      haptic.success();
      toast(t('admin.areaAdded'), 'success');
    } catch (e: any) {
      toast(e?.code === '23505' ? t('admin.areaExists') : e.message || t('common.error'), 'error');
    } finally {
      setAddingArea(false);
    }
  }

  async function toggleArea(id: string, active: boolean) {
    try {
      await updateArea(id, { is_active: !active });
      await refreshAreas();
      haptic.selection();
    } catch (e: any) {
      toast(e.message || t('common.error'), 'error');
    }
  }

  function doDismiss(id: string) {
    Alert.alert('Dismiss this report?', 'It will be marked as reviewed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss',
        onPress: async () => {
          try {
            await dismissReport(id);
            toast('Report dismissed.', 'success');
            load();
          } catch (e: any) {
            toast(e.message || 'Could not dismiss.', 'error');
          }
        },
      },
    ]);
  }

  function doRemoveListing(report: PendingReport) {
    if (!report.listing) return;
    const listingId = report.listing.id;
    Alert.alert('Remove this listing?', 'The listing will be permanently deleted and the report resolved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove listing',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteListing(listingId);
            await dismissReport(report.id);
            toast('Listing removed.', 'success');
            load();
          } catch (e: any) {
            toast(e.message || 'Could not remove.', 'error');
          }
        },
      },
    ]);
  }

  function doEjectUser(report: PendingReport) {
    const ownerId = report.listing?.owner_id;
    if (!ownerId) {
      toast('This listing has no owner to eject.', 'info');
      return;
    }
    Alert.alert(
      'Eject this user?',
      `Every listing by ${report.listing?.owner_name || 'this user'} will be permanently deleted and the report resolved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Eject user',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListingsByOwner(ownerId);
              await dismissReport(report.id);
              toast('User ejected. Their listings were removed.', 'success');
              load();
            } catch (e: any) {
              toast(e.message || 'Could not eject.', 'error');
            }
          },
        },
      ],
    );
  }

  const StatCard = ({ n, label }: { n: number; label: string }) => (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <Text style={[styles.statNum, { color: colors.accent }]}>{n}</Text>
      <Text style={[styles.statLabel, { color: colors.inkSoft }]}>{label}</Text>
    </View>
  );

  const Bars = ({ title, entries }: { title: string; entries: [string, number][] }) => {
    const max = Math.max(...entries.map(([, c]) => c), 1);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Text style={[styles.cardTitle, { color: colors.ink }]}>{title}</Text>
        {entries.length === 0 ? (
          <Text style={[styles.muted, { color: colors.inkFaint }]}>No data yet.</Text>
        ) : (
          entries.slice(0, 8).map(([label, count]) => (
            <View key={label} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.inkSoft }]} numberOfLines={1}>{label}</Text>
              <View style={[styles.barTrack, { backgroundColor: colors.surface2 }]}>
                <View style={[styles.barFill, { width: `${(count / max) * 100}%`, backgroundColor: colors.accent }]} />
              </View>
              <Text style={[styles.barCount, { color: colors.inkFaint }]}>{count}</Text>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Admin' }} />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxxl }} />
      ) : (
        <>
          <View style={styles.statRow}>
            <StatCard n={stats.total} label="Total" />
            <StatCard n={stats.available} label="Available" />
            <StatCard n={stats.claimed} label="Claimed" />
          </View>
          <View style={styles.statRow}>
            <StatCard n={stats.reading} label="Reading" />
            <StatCard n={stats.last7} label="Last 7 days" />
            <StatCard n={reports.length} label="Reports" />
          </View>

          {/* Site settings */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, marginTop: spacing.md }]}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>Site settings</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: colors.ink }]}>Live counter</Text>
                <Text style={[styles.muted, { color: colors.inkFaint }]}>Shows "{stats.total} books passed on so far" on the website hero and the app's Browse screen.</Text>
              </View>
              <Switch value={liveCounter} disabled={savingCounter} onValueChange={toggleCounter} trackColor={{ true: colors.accent, false: colors.hairlineStrong }} />
            </View>
          </View>

          {/* Schools */}
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('admin.schools')} ({schools.length})</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.muted, { color: colors.inkFaint, marginBottom: spacing.sm }]}>{t('admin.schoolsHint')}</Text>
            <Text style={[styles.label, { color: colors.inkSoft }]}>{t('admin.addSchool')}</Text>
            <TextInput
              value={newSchool}
              onChangeText={setNewSchool}
              placeholder={t('admin.schoolName')}
              placeholderTextColor={colors.inkFaint}
              maxLength={120}
              style={[styles.input, { backgroundColor: colors.paper, color: colors.ink, borderColor: colors.hairline }]}
            />
            <TextInput
              value={newArea}
              onChangeText={setNewArea}
              placeholder={t('admin.schoolArea')}
              placeholderTextColor={colors.inkFaint}
              maxLength={60}
              style={[styles.input, { backgroundColor: colors.paper, color: colors.ink, borderColor: colors.hairline }]}
            />
            <Button title={t('admin.add')} onPress={submitSchool} loading={addingSchool} disabled={!newSchool.trim()} style={{ marginTop: spacing.xs }} />
            <View style={{ marginTop: spacing.md }}>
              {schools.map((s, i) => (
                <View
                  key={s.id}
                  style={[styles.schoolRow, i < schools.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}
                >
                  <Ionicons name="school-outline" size={18} color={s.is_active ? colors.accent : colors.inkFaint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.schoolName, { color: s.is_active ? colors.ink : colors.inkFaint }]} numberOfLines={1}>{s.name}</Text>
                    <Text style={[styles.schoolMeta, { color: colors.inkFaint }]}>
                      {[s.area, s.is_active ? null : t('admin.hidden')].filter(Boolean).join(' · ') || ' '}
                    </Text>
                  </View>
                  <Pressable onPress={() => toggleSchool(s.id, s.is_active)} hitSlop={6} accessibilityRole="button">
                    <Text style={[styles.schoolAction, { color: colors.accent }]}>{s.is_active ? t('admin.hide') : t('admin.show')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          {/* Areas */}
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('admin.areas')} ({areas.length})</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.muted, { color: colors.inkFaint, marginBottom: spacing.sm }]}>{t('admin.areasHint')}</Text>
            <Text style={[styles.label, { color: colors.inkSoft }]}>{t('admin.addArea')}</Text>
            <TextInput
              value={newAreaName}
              onChangeText={setNewAreaName}
              placeholder={t('admin.areaName')}
              placeholderTextColor={colors.inkFaint}
              maxLength={60}
              style={[styles.input, { backgroundColor: colors.paper, color: colors.ink, borderColor: colors.hairline }]}
            />
            <Select label={t('admin.areaRegion')} value={newAreaRegion} options={regionOptions} onChange={setNewAreaRegion} />
            <Button title={t('admin.add')} onPress={submitArea} loading={addingArea} disabled={!newAreaName.trim()} style={{ marginTop: spacing.xs }} />
            <View style={{ marginTop: spacing.md }}>
              {areas.length === 0 && (
                <Text style={[styles.muted, { color: colors.inkFaint }]}>{t('admin.areasEmpty')}</Text>
              )}
              {areas.map((a, i) => (
                <View
                  key={a.id}
                  style={[styles.schoolRow, i < areas.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}
                >
                  <Ionicons name="location-outline" size={18} color={a.is_active ? colors.accent : colors.inkFaint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.schoolName, { color: a.is_active ? colors.ink : colors.inkFaint }]} numberOfLines={1}>{a.name}</Text>
                    <Text style={[styles.schoolMeta, { color: colors.inkFaint }]}>
                      {[a.region, a.is_active ? null : t('admin.hidden')].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Pressable onPress={() => toggleArea(a.id, a.is_active)} hitSlop={6} accessibilityRole="button">
                    <Text style={[styles.schoolAction, { color: colors.accent }]}>{a.is_active ? t('admin.hide') : t('admin.show')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.ink }]}>
            Pending reports {reports.length > 0 ? `(${reports.length})` : ''}
          </Text>
          {reports.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
              <Text style={[styles.muted, { color: colors.inkFaint }]}>No pending reports.</Text>
            </View>
          ) : (
            reports.map((r) => (
              <View key={r.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                <Text style={[styles.reportTitle, { color: colors.ink }]}>
                  {r.listing?.title || '(listing deleted)'}
                </Text>
                <Text style={[styles.reportMeta, { color: colors.inkFaint }]}>
                  {REPORT_REASONS.find((x) => x.value === r.reason)?.label || r.reason}
                  {r.listing?.owner_name ? ` · ${r.listing.owner_name}` : ''} · {formatRelativeTime(r.created_at)}
                </Text>
                {!!r.notes && <Text style={[styles.reportNotes, { color: colors.inkSoft }]}>"{r.notes}"</Text>}
                <View style={styles.reportActions}>
                  {r.listing && (
                    <Button title="View" variant="secondary" fullWidth={false} onPress={() => router.push(`/listing/${r.listing!.id}`)} style={{ flex: 1 }} />
                  )}
                  <Button title="Dismiss" variant="secondary" fullWidth={false} onPress={() => doDismiss(r.id)} style={{ flex: 1 }} />
                </View>
                {r.listing && (
                  <View style={styles.reportActions}>
                    <Button title="Remove listing" variant="danger" fullWidth={false} onPress={() => doRemoveListing(r)} style={{ flex: 1 }} />
                    <Button title="Eject user" variant="danger" fullWidth={false} onPress={() => doEjectUser(r)} style={{ flex: 1 }} />
                  </View>
                )}
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { color: colors.ink }]}>Breakdown</Text>
          <Bars title="By school" entries={countBy(listings, 'school')} />
          <Bars title="By area" entries={countBy(listings, 'area')} />
          <Bars title="By subject" entries={countBy(listings, 'subject')} />
          <Bars title="By grade" entries={countBy(listings, 'grade_level')} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  stat: { flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, alignItems: 'center' },
  statNum: { fontFamily: font.displayBold, fontSize: type.xl },
  statLabel: { fontFamily: font.bodyMedium, fontSize: type.xs, marginTop: 2 },
  sectionTitle: { fontFamily: font.displayBold, fontSize: type.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, marginBottom: spacing.sm },
  cardTitle: { fontFamily: font.bodySemi, fontSize: type.base, marginBottom: spacing.sm },
  muted: { fontFamily: font.body, fontSize: type.sm, lineHeight: type.sm * 1.45 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingTitle: { fontFamily: font.bodySemi, fontSize: type.base, marginBottom: 2 },
  label: { fontFamily: font.bodySemi, fontSize: type.sm, marginBottom: spacing.xs },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 46, fontFamily: font.body, fontSize: type.base, marginBottom: spacing.sm },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  schoolName: { fontFamily: font.bodyMedium, fontSize: type.base },
  schoolMeta: { fontFamily: font.body, fontSize: type.xs, marginTop: 1 },
  schoolAction: { fontFamily: font.bodySemi, fontSize: type.sm },
  reportTitle: { fontFamily: font.displayBold, fontSize: type.md },
  reportMeta: { fontFamily: font.body, fontSize: type.xs, marginTop: 4 },
  reportNotes: { fontFamily: font.body, fontSize: type.sm, marginTop: spacing.sm, fontStyle: 'italic' },
  reportActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  barLabel: { fontFamily: font.body, fontSize: type.xs, width: 110 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontFamily: font.bodyMedium, fontSize: type.xs, width: 28, textAlign: 'right' },
});
