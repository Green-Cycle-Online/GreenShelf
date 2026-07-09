import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { Listing } from '../lib/types';
import { isNewListing } from '../lib/format';
import { useSaved } from '../lib/saved';
import { haptic } from '../lib/haptics';
import { BookCover } from './BookCover';
import { Tag } from './Tag';

export function ListingCard({
  listing,
  onPress,
  width,
}: {
  listing: Listing;
  onPress: () => void;
  width: number;
}) {
  const { colors } = useTheme();
  const [saved, toggle] = useSaved(listing.id);
  const firstPhoto = listing.photos && listing.photos.length > 0 ? listing.photos[0] : null;
  const moreCount = listing.photos && listing.photos.length > 1 ? listing.photos.length - 1 : 0;
  const isNew = isNewListing(listing.created_at);
  const claimed = listing.status === 'claimed';
  const location = [listing.area, listing.school].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${listing.grade_level}, ${listing.subject}`}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: colors.surface, borderColor: colors.hairline, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.image, { backgroundColor: colors.surface2 }]}>
        {firstPhoto ? (
          <Image source={{ uri: firstPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <BookCover listing={listing} />
        )}

        {isNew && !claimed && (
          <View style={[styles.newBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.newBadgeText, { color: colors.onAccent }]}>New</Text>
          </View>
        )}
        {claimed && (
          <View style={styles.claimedOverlay}>
            <Text style={styles.claimedText}>Claimed</Text>
          </View>
        )}

        <Pressable
          onPress={() => {
            haptic.light();
            toggle();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save this book'}
          accessibilityState={{ selected: saved }}
          style={[styles.saveBtn, { backgroundColor: colors.surface }]}
        >
          <Ionicons
            name={saved ? 'heart' : 'heart-outline'}
            size={18}
            color={saved ? colors.error : colors.inkSoft}
          />
        </Pressable>

        {moreCount > 0 && (
          <View style={styles.photoCount}>
            <Text style={styles.photoCountText}>+{moreCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
          {listing.title}
        </Text>
        <View style={styles.tags}>
          <Tag label={listing.grade_level} kind="grade" />
          <Tag label={listing.condition} kind="condition" condition={listing.condition} />
        </View>
        {!!location && (
          <View style={styles.location}>
            <Ionicons name="location-outline" size={12} color={colors.inkFaint} />
            <Text style={[styles.locationText, { color: colors.inkFaint }]} numberOfLines={1}>
              {location}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  image: {
    aspectRatio: 3 / 4,
    width: '100%',
  },
  newBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  newBadgeText: { fontFamily: font.bodyBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  claimedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimedText: {
    color: '#fff',
    fontFamily: font.displayBold,
    fontSize: type.md,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  saveBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  photoCount: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  photoCountText: { color: '#fff', fontFamily: font.bodySemi, fontSize: 11 },
  body: { padding: spacing.md, gap: spacing.sm },
  title: { fontFamily: font.displayBold, fontSize: type.md, lineHeight: type.md * 1.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  location: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontFamily: font.body, fontSize: type.xs, flex: 1 },
});
