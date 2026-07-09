import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemePref } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { Select, Option } from '../../components/Select';
import { Leaf } from '../../components/Logo';
import { GRADES, SUPPORT_EMAIL } from '../../lib/constants';
import { updateProfile, deleteAccountData, fetchMyListings } from '../../lib/api';
import { Listing } from '../../lib/types';
import { haptic } from '../../lib/haptics';

const INFO_LINKS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: 'How it works', icon: 'help-circle-outline', route: '/info/how-it-works' },
  { label: 'Our goals', icon: 'earth-outline', route: '/info/goals' },
  { label: 'About GreenShelf', icon: 'people-outline', route: '/info/about' },
  { label: 'FAQ', icon: 'chatbubble-ellipses-outline', route: '/info/faq' },
  { label: 'Privacy', icon: 'lock-closed-outline', route: '/info/privacy' },
];

export default function ProfileScreen() {
  const { colors, pref, setPref } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile, isAdmin, signOut, refreshProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [mine, setMine] = useState<Listing[]>([]);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setSchool(profile?.school || '');
    setGrade(profile?.grade_level || '');
  }, [profile]);

  const loadMine = useCallback(() => {
    if (user) fetchMyListings(user.id).then(setMine).catch(() => {});
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      loadMine();
    }, [loadMine]),
  );

  const gradeOptions: Option[] = [{ label: 'Not set', value: '' }, ...GRADES.map((g) => ({ label: g, value: g }))];
  const themeOptions: { label: string; value: ThemePref; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
    { label: 'Light', value: 'light', icon: 'sunny-outline' },
    { label: 'Dark', value: 'dark', icon: 'moon-outline' },
  ];

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.id, {
        full_name: fullName.trim() || null,
        school: school.trim() || null,
        grade_level: grade || null,
      });
      haptic.success();
      await refreshProfile();
      toast('Saved', 'success');
    } catch (e: any) {
      toast(e.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      `All your listings will be permanently removed and your profile cleared. Your email is retained. To have it fully erased, email ${SUPPORT_EMAIL}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await deleteAccountData(user.id);
              await signOut();
              toast('Account data deleted. We will miss you.', 'success');
            } catch (e: any) {
              toast(e.message || 'Could not delete.', 'error');
            }
          },
        },
      ],
    );
  }

  const ThemeRow = (
    <View style={styles.themeRow}>
      {themeOptions.map((t) => {
        const active = pref === t.value;
        return (
          <Pressable
            key={t.value}
            onPress={() => {
              haptic.selection();
              setPref(t.value);
            }}
            style={[
              styles.themeChip,
              { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.hairlineStrong },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={t.icon} size={16} color={active ? colors.onAccent : colors.inkSoft} />
            <Text style={[styles.themeChipText, { color: active ? colors.onAccent : colors.inkSoft }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const InfoList = (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      {INFO_LINKS.map((link, i) => (
        <Pressable
          key={link.route}
          onPress={() => router.push(link.route as any)}
          style={[styles.row, i < INFO_LINKS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}
          accessibilityRole="button"
        >
          <Ionicons name={link.icon} size={20} color={colors.accent} />
          <Text style={[styles.rowLabel, { color: colors.ink }]}>{link.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Leaf size={26} color={colors.accent} />
        <Text style={[styles.h1, { color: colors.ink }]}>{user ? 'My profile' : 'GreenShelf'}</Text>
      </View>

      {!user ? (
        <>
          <View style={[styles.signedOut, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.signedOutTitle, { color: colors.ink }]}>Sign in to list books</Text>
            <Text style={[styles.signedOutMsg, { color: colors.inkSoft }]}>
              You can browse freely with no account. Sign in only when you want to share a book of your own.
            </Text>
            <Button title="Sign in or create account" onPress={() => router.push('/auth')} />
          </View>
          <Text style={[styles.sectionLabel, { color: colors.inkFaint }]}>Learn more</Text>
          {InfoList}
          <Text style={[styles.sectionLabel, { color: colors.inkFaint }]}>Appearance</Text>
          {ThemeRow}
        </>
      ) : (
        <>
          <Text style={[styles.email, { color: colors.inkSoft }]}>{user.email}</Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, padding: spacing.lg }]}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>Your details</Text>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="What should we call you?"
              placeholderTextColor={colors.inkFaint}
              maxLength={60}
              style={[styles.input, { backgroundColor: colors.paper, color: colors.ink, borderColor: colors.hairline }]}
            />
            <Text style={[styles.label, { color: colors.inkSoft }]}>School (optional)</Text>
            <TextInput
              value={school}
              onChangeText={setSchool}
              placeholder="e.g. British School Muscat"
              placeholderTextColor={colors.inkFaint}
              maxLength={120}
              style={[styles.input, { backgroundColor: colors.paper, color: colors.ink, borderColor: colors.hairline }]}
            />
            <Select label="Grade (optional)" value={grade} options={gradeOptions} onChange={setGrade} />
            <Button title="Save changes" onPress={save} loading={saving} style={{ marginTop: spacing.sm }} />
          </View>

          {isAdmin && (
            <Pressable
              onPress={() => router.push('/admin')}
              style={[styles.adminRow, { backgroundColor: colors.accentTint, borderColor: colors.accent }]}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
              <Text style={[styles.rowLabel, { color: colors.accent }]}>Admin dashboard</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.accent} />
            </Pressable>
          )}

          <View style={styles.myListingsHead}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>Your listings</Text>
            <Text style={[styles.count, { color: colors.inkFaint }]}>
              {mine.length === 1 ? '1 listing' : `${mine.length} listings`}
            </Text>
          </View>
          {mine.length === 0 ? (
            <Text style={[styles.emptyMine, { color: colors.inkSoft }]}>
              You have not listed any books yet. Tap the List tab to share one.
            </Text>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
              {mine.map((l, i) => (
                <Pressable
                  key={l.id}
                  onPress={() => router.push(`/listing/${l.id}`)}
                  style={[styles.row, i < mine.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}
                >
                  <Ionicons
                    name={l.status === 'claimed' ? 'checkmark-done-outline' : 'book-outline'}
                    size={20}
                    color={l.status === 'claimed' ? colors.inkFaint : colors.accent}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.ink }]} numberOfLines={1}>{l.title}</Text>
                    <Text style={[styles.rowSub, { color: colors.inkFaint }]}>
                      {l.grade_level} · {l.subject} · {l.status}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.inkFaint }]}>Learn more</Text>
          {InfoList}
          <Text style={[styles.sectionLabel, { color: colors.inkFaint }]}>Appearance</Text>
          {ThemeRow}

          <Button title="Sign out" variant="secondary" onPress={() => { signOut(); toast('Signed out.', 'info'); }} style={{ marginTop: spacing.xl }} />

          <View style={[styles.danger, { borderColor: colors.error }]}>
            <Text style={[styles.dangerTitle, { color: colors.error }]}>Danger zone</Text>
            <Text style={[styles.dangerMsg, { color: colors.inkSoft }]}>
              Removes all your listings and clears your profile data. Your email is retained.
            </Text>
            <Button title="Delete my account" variant="danger" onPress={confirmDelete} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  h1: { fontFamily: font.displayBold, fontSize: type.xxl },
  email: { fontFamily: font.body, fontSize: type.base, marginBottom: spacing.lg },
  signedOut: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.xl, gap: spacing.md, marginBottom: spacing.md },
  signedOutTitle: { fontFamily: font.displayBold, fontSize: type.lg },
  signedOutMsg: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.45 },
  sectionLabel: { fontFamily: font.bodySemi, fontSize: type.xs, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardTitle: { fontFamily: font.displayBold, fontSize: type.lg, marginBottom: spacing.sm },
  label: { fontFamily: font.bodySemi, fontSize: type.sm, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 48, fontFamily: font.body, fontSize: type.base, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 56 },
  rowLabel: { flex: 1, fontFamily: font.bodyMedium, fontSize: type.base },
  rowSub: { fontFamily: font.body, fontSize: type.xs, marginTop: 1 },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginTop: spacing.lg },
  myListingsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.xl, marginBottom: spacing.sm },
  count: { fontFamily: font.bodyMedium, fontSize: type.sm },
  emptyMine: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.4 },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  themeChipText: { fontFamily: font.bodySemi, fontSize: type.sm },
  danger: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md, marginTop: spacing.xl },
  dangerTitle: { fontFamily: font.displayBold, fontSize: type.md },
  dangerMsg: { fontFamily: font.body, fontSize: type.sm, lineHeight: type.sm * 1.5 },
});
