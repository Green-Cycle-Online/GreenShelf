import React, { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { font, spacing, type } from '../../theme/tokens';
import { useListings } from '../../lib/useListings';
import { useSavedIds } from '../../lib/saved';
import { ListingCard } from '../../components/ListingCard';
import { SkeletonCard } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/StateViews';

export default function SavedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { listings, loading, error, refreshing, refresh, reload } = useListings();
  const savedIds = useSavedIds();

  const gap = spacing.md;
  const pad = spacing.lg;
  const cardWidth = (width - pad * 2 - gap) / 2;

  const saved = useMemo(() => {
    const set = new Set(savedIds);
    return listings.filter((l) => set.has(String(l.id)));
  }, [listings, savedIds]);

  const header = (
    <View style={{ paddingHorizontal: pad, paddingTop: spacing.sm }}>
      <Text style={[styles.title, { color: colors.ink }]}>Saved</Text>
      <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
        Books you kept for later. Saved on this device, no account needed.
      </Text>
      {!loading && !error && saved.length > 0 && (
        <Text style={[styles.count, { color: colors.inkFaint }]}>
          {saved.length === 1 ? '1 book' : `${saved.length} books`}
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
        {header}
        <View style={[styles.grid, { paddingHorizontal: pad, gap }]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} width={cardWidth} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
      <FlatList
        data={error ? [] : saved}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap, paddingHorizontal: pad }}
        contentContainerStyle={{ gap, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ListingCard listing={item} width={cardWidth} onPress={() => router.push(`/listing/${item.id}`)} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          error ? (
            <ErrorState onRetry={reload} />
          ) : (
            <EmptyState
              icon="heart-outline"
              title="No saved books yet"
              message="Tap the heart on any book to keep it here for later."
              actionLabel="Browse books"
              onAction={() => router.push('/')}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontFamily: font.displayBold, fontSize: type.xxl },
  subtitle: { fontFamily: font.body, fontSize: type.base, marginTop: 2, marginBottom: spacing.sm, lineHeight: type.base * 1.4 },
  count: { fontFamily: font.bodyMedium, fontSize: type.sm, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
});
