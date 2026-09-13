import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { Listing } from '../../lib/types';
import { fetchListingById, deleteListing, setListingStatus, submitReport, blockUser } from '../../lib/api';
import { getContactLink, contactLabelFor } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useSaved } from '../../lib/saved';
import { haptic } from '../../lib/haptics';
import { useToast } from '../../components/Toast';
import { BookCover } from '../../components/BookCover';
import { Tag } from '../../components/Tag';
import { Button } from '../../components/Button';
import { ErrorState } from '../../components/StateViews';
import { ReportSheet } from '../../components/ReportSheet';
import { SITE_URL } from '../../lib/constants';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isAdmin, addBlocked } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const navigation = useNavigation();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);

  const [saved, toggleSave] = useSaved(id ?? '');

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchListingById(id);
      if (!data) setError(true);
      else setListing(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <ErrorState onRetry={load} message="This listing could not be found." />
      </View>
    );
  }

  const isOwner = !!user && listing.owner_id === user.id;
  const isClaimed = listing.status === 'claimed';
  const photos = (Array.isArray(listing.photos) ? listing.photos : []).filter(
    (p) => typeof p === 'string' && /^https:\/\//.test(p),
  );
  const contactLink = getContactLink(listing.contact_method, listing.contact_value);
  const contactLabel = contactLabelFor(listing.contact_method);

  const openContact = async () => {
    haptic.medium();
    try {
      const ok = await Linking.canOpenURL(contactLink);
      if (ok) Linking.openURL(contactLink);
      else toast('Could not open that app.', 'error');
    } catch {
      toast('Could not open that app.', 'error');
    }
  };

  const onShare = async () => {
    haptic.light();
    const url = `${SITE_URL}/#listing/${listing.id}`;
    try {
      await Share.share({ message: `Check out this book on GreenShelf: ${listing.title}\n${url}`, url });
    } catch {
      /* user cancelled */
    }
  };

  const onSave = () => {
    haptic.light();
    const now = toggleSave();
    toast(now ? 'Saved to your list' : 'Removed from saved', now ? 'success' : 'info');
  };

  const onBlock = () => {
    if (!user) {
      toast('Sign in to block a user.', 'info');
      router.push('/auth');
      return;
    }
    if (!listing.owner_id) {
      toast('This user cannot be blocked.', 'error');
      return;
    }
    Alert.alert(
      `Block ${listing.owner_name}?`,
      'You will no longer see their listings, and their listing will be reported to our team for review. You can unblock them later from your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block user',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(user.id, listing.owner_id!, listing.owner_name, listing.id);
              addBlocked(listing.owner_id!);
              haptic.success();
              toast('User blocked. Their listings are now hidden.', 'success');
              router.back();
            } catch (e: any) {
              toast(e.message || 'Could not block this user.', 'error');
            }
          },
        },
      ],
    );
  };

  const reallyDelete = async () => {
    try {
      await deleteListing(listing.id);
      haptic.success();
      toast('Listing deleted.', 'success');
      router.back();
    } catch (e: any) {
      toast(e.message || 'Could not delete.', 'error');
    }
  };

  const doDelete = () => {
    if (!isOwner) {
      Alert.alert('Delete this listing as admin?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: reallyDelete },
      ]);
      return;
    }
    // Impact tracking: a book that found a new home should count as claimed,
    // not vanish. Ask once before the row (and the stat) is gone forever.
    Alert.alert(
      'Before this goes',
      'Did the book go to someone? "It was taken" counts it toward books passed on and removes it from the feed. Delete removes it completely.',
      [
        {
          text: 'It was taken',
          onPress: async () => {
            try {
              await setListingStatus(listing.id, 'claimed');
              haptic.success();
              setListing({ ...listing, status: 'claimed' });
              toast('Great. It counts toward books passed on.', 'success');
            } catch (e: any) {
              toast(e.message || 'Could not update.', 'error');
            }
          },
        },
        { text: 'Delete it', style: 'destructive', onPress: reallyDelete },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const toggleClaim = () => {
    const next = isClaimed ? 'available' : 'claimed';
    const doIt = async () => {
      try {
        await setListingStatus(listing.id, next);
        haptic.success();
        setListing({ ...listing, status: next });
        toast(next === 'claimed' ? 'Marked as claimed.' : 'Back in the feed.', 'success');
      } catch (e: any) {
        toast(e.message || 'Could not update.', 'error');
      }
    };
    if (next === 'claimed') {
      Alert.alert(
        'Mark as claimed?',
        'It will be removed from the public feed. You can mark it available again anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark claimed', onPress: doIt },
        ],
      );
    } else {
      doIt();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack.Screen
        options={{
          title: '',
          headerTransparent: photos.length > 0,
          headerRight: () => (
            <Pressable
              onPress={onShare}
              hitSlop={10}
              accessibilityLabel="Share this listing"
              // Over a photo the header is transparent, so a bare icon can vanish
              // on light images. Sit it in a translucent scrim for guaranteed
              // contrast; on the paper header (no photos) use plain ink.
              style={photos.length > 0 ? styles.headerBtnScrim : undefined}
            >
              <Ionicons name="share-outline" size={22} color={photos.length ? '#fff' : colors.ink} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        {/* Photos or generated cover */}
        <View style={{ width, height: width }}>
          {photos.length > 0 ? (
            <>
              <FlatList
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(p, i) => `${i}-${p}`}
                onMomentumScrollEnd={(e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={{ width, height: width }} contentFit="cover" transition={150} />
                )}
              />
              {photos.length > 1 && (
                <View style={styles.dots}>
                  {photos.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.5)' }]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <BookCover listing={listing} />
          )}
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.ink }]}>{listing.title}</Text>

          <View style={styles.tags}>
            {isClaimed && <Tag label="Claimed" kind="status" />}
            <Tag label={listing.grade_level} kind="grade" />
            <Tag label={listing.subject} kind="subject" />
            <Tag label={listing.condition} kind="condition" condition={listing.condition} />
          </View>

          {listing.category === 'reading' && (
            <Section label={t('detail.genre')} value={`${listing.subject} · ${listing.grade_level}`} />
          )}
          {!!listing.area && <Section label={t('detail.area')} value={listing.area} />}
          {!!listing.school && listing.category !== 'reading' && <Section label={t('detail.school')} value={listing.school} />}
          {!!listing.description && <Section label={t('detail.about')} value={listing.description} />}

          {/* Contact */}
          <View style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={[styles.sectionLabel, { color: colors.inkFaint }]}>{t('detail.contact')}</Text>
            <Text style={[styles.ownerName, { color: colors.ink }]}>{listing.owner_name}</Text>
            <Pressable
              onPress={openContact}
              style={[styles.contactBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel={`${contactLabel} ${listing.contact_value}`}
            >
              <Ionicons
                name={
                  listing.contact_method === 'whatsapp'
                    ? 'logo-whatsapp'
                    : listing.contact_method === 'phone'
                      ? 'call'
                      : 'mail'
                }
                size={18}
                color={colors.onAccent}
              />
              <Text style={[styles.contactBtnText, { color: colors.onAccent }]}>
                {contactLabel} {listing.contact_value}
              </Text>
            </Pressable>
          </View>

          {/* Save + Share row */}
          <View style={styles.actionRow}>
            <Button
              title={saved ? 'Saved' : 'Save'}
              variant="secondary"
              onPress={onSave}
              fullWidth={false}
              style={{ flex: 1 }}
              hapticStyle="none"
            />
            <Button title="Share" variant="secondary" onPress={onShare} fullWidth={false} style={{ flex: 1 }} />
          </View>

          {/* Owner / admin actions */}
          {isOwner && (
            <View style={styles.ownerActions}>
              <Button
                title="Edit listing"
                variant="secondary"
                onPress={() => router.push({ pathname: '/create-listing', params: { editId: listing.id } })}
              />
              <Button
                title={isClaimed ? 'Mark available' : 'Mark claimed'}
                variant="secondary"
                onPress={toggleClaim}
              />
              <Button title="Delete listing" variant="danger" onPress={doDelete} />
            </View>
          )}
          {!isOwner && isAdmin && (
            <View style={{ marginTop: spacing.md }}>
              <Button title="Delete (admin)" variant="danger" onPress={doDelete} />
            </View>
          )}

          {/* Report + block */}
          {!isOwner && (
            <View style={styles.safetyRow}>
              <Pressable
                onPress={() => {
                  if (!user) {
                    toast('Sign in to report a listing.', 'info');
                    router.push('/auth');
                    return;
                  }
                  setReportOpen(true);
                }}
                style={styles.reportRow}
                accessibilityRole="button"
              >
                <Text style={[styles.reportText, { color: colors.inkFaint }]}>Report this listing</Text>
              </Pressable>
              <Text style={{ color: colors.inkFaint, fontFamily: font.bodyMedium, fontSize: type.sm }}> · </Text>
              <Pressable onPress={onBlock} style={styles.reportRow} accessibilityRole="button">
                <Text style={[styles.reportText, { color: colors.inkFaint }]}>Block this user</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={async (reason, notes) => {
          try {
            await submitReport(listing.id, user!.id, reason, notes || null);
            setReportOpen(false);
            haptic.success();
            toast('Thanks, we will review this listing.', 'success');
          } catch (e: any) {
            toast(e.message || 'Could not submit report.', 'error');
          }
        }}
      />
    </View>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.inkFaint }]}>{label}</Text>
      <Text style={[styles.sectionValue, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtnScrim: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dots: { position: 'absolute', bottom: spacing.lg, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  body: { padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: font.displayBold, fontSize: type.xxl, lineHeight: type.xxl * 1.1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: 4, marginTop: spacing.sm },
  sectionLabel: { fontFamily: font.bodySemi, fontSize: type.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionValue: { fontFamily: font.body, fontSize: type.md, lineHeight: type.md * 1.45 },
  contactCard: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm, marginTop: spacing.md },
  ownerName: { fontFamily: font.displayBold, fontSize: type.lg },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 50,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
  },
  contactBtnText: { fontFamily: font.bodySemi, fontSize: type.base },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  ownerActions: { gap: spacing.sm, marginTop: spacing.md },
  safetyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  reportRow: { alignItems: 'center', paddingVertical: spacing.lg },
  reportText: { fontFamily: font.bodyMedium, fontSize: type.sm, textDecorationLine: 'underline' },
});
