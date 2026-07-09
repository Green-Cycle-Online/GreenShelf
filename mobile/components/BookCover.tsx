import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { font, spacing, type } from '../theme/tokens';
import { coverIndex, coverFoot } from '../lib/format';
import { Leaf } from './Logo';
import { Listing } from '../lib/types';

// Generated typographic "book on a shelf" for listings with no photo, matching
// bookCoverHTML on the website: deterministic colourway per subject, leaf imprint.
export function BookCover({ listing }: { listing: Listing }) {
  const { colors } = useTheme();
  const idx = coverIndex(listing.subject || listing.title || '', colors.covers.length);
  const cover = colors.covers[idx];
  const foot = coverFoot(listing.grade_level, listing.subject);
  return (
    <View style={[styles.wrap, { backgroundColor: cover.bg }]}>
      <View style={styles.head}>
        <Leaf size={20} color={cover.ink} />
        <Text style={[styles.title, { color: cover.ink }]} numberOfLines={4}>
          {listing.title}
        </Text>
      </View>
      {!!foot && (
        <Text style={[styles.foot, { color: cover.ink }]} numberOfLines={1}>
          {foot}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: '100%',
    height: '100%',
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  head: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: font.displayBold,
    fontSize: type.lg,
    lineHeight: type.lg * 1.15,
  },
  foot: {
    fontFamily: font.bodyMedium,
    fontSize: type.xs,
    opacity: 0.85,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
