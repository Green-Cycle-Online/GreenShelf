import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { fetchAllListings, fetchPendingReports, dismissReport, PendingReport } from '../lib/api';
import { Listing } from '../lib/types';
import { REPORT_REASONS } from '../lib/constants';
import { formatRelativeTime } from '../lib/format';

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
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchAllListings(), fetchPendingReports().catch(() => [])])
      .then(([l, r]) => {
        setListings(l);
        setReports(r);
      })
      .catch(() => toast('Could not load stats.', 'error'))
      .finally(() => setLoading(false));
  }, []);

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
    last7: listings.filter((l) => new Date(l.created_at).getTime() > sevenDaysAgo).length,
    photos: listings.reduce((s, l) => s + (Array.isArray(l.photos) ? l.photos.length : 0), 0),
  };

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
            <StatCard n={stats.last7} label="Last 7 days" />
            <StatCard n={stats.photos} label="Photos" />
            <StatCard n={reports.length} label="Reports" />
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
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { color: colors.ink }]}>Breakdown</Text>
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
  muted: { fontFamily: font.body, fontSize: type.sm },
  reportTitle: { fontFamily: font.displayBold, fontSize: type.md },
  reportMeta: { fontFamily: font.body, fontSize: type.xs, marginTop: 4 },
  reportNotes: { fontFamily: font.body, fontSize: type.sm, marginTop: spacing.sm, fontStyle: 'italic' },
  reportActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  barLabel: { fontFamily: font.body, fontSize: type.xs, width: 90 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { fontFamily: font.bodyMedium, fontSize: type.xs, width: 28, textAlign: 'right' },
});
