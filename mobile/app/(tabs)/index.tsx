import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { useListings } from '../../lib/useListings';
import { ListingCard } from '../../components/ListingCard';
import { SkeletonCard } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { FilterSheet, Filters, EMPTY_FILTERS, activeFilterCount } from '../../components/FilterSheet';
import { Leaf } from '../../components/Logo';
import { haptic } from '../../lib/haptics';

export default function BrowseScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { listings, loading, error, refreshing, refresh, reload } = useListings();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const gap = spacing.md;
  const pad = spacing.lg;
  const cardWidth = (width - pad * 2 - gap) / 2;

  // Client-side filtering, same rules as the website's applyFilters.
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return listings.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q) && !(l.subject || '').toLowerCase().includes(q)) return false;
      if (filters.grade && l.grade_level !== filters.grade) return false;
      if (filters.subject && l.subject !== filters.subject) return false;
      if (filters.condition && l.condition !== filters.condition) return false;
      if (filters.area && l.area !== filters.area) return false;
      return true;
    });
  }, [listings, search, filters]);

  const subjects = useMemo(() => [...new Set(listings.map((l) => l.subject).filter(Boolean))], [listings]);
  const areas = useMemo(
    () => [...new Set(listings.map((l) => l.area).filter(Boolean) as string[])],
    [listings],
  );

  const filterCount = activeFilterCount(filters);
  const hasActive = filterCount > 0 || !!search;

  const header = (
    <View style={{ paddingHorizontal: pad }}>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <Leaf size={26} color={colors.accent} />
          <Text style={[styles.brandName, { color: colors.ink }]}>GreenShelf</Text>
        </View>
      </View>
      <Text style={[styles.tagline, { color: colors.inkSoft }]}>
        Free school books, passed on between families in Oman.
      </Text>

      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Ionicons name="search" size={18} color={colors.inkFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search titles or subjects"
          placeholderTextColor={colors.inkFaint}
          style={[styles.searchInput, { color: colors.ink }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search books"
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.inkFaint} />
          </Pressable>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => {
            haptic.light();
            setSheetOpen(true);
          }}
          style={[
            styles.filterBtn,
            { backgroundColor: filterCount ? colors.accentTint : colors.surface, borderColor: filterCount ? colors.accent : colors.hairlineStrong },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ''}`}
        >
          <Ionicons name="options-outline" size={17} color={filterCount ? colors.accent : colors.inkSoft} />
          <Text style={[styles.filterBtnText, { color: filterCount ? colors.accent : colors.inkSoft }]}>
            Filters{filterCount ? ` (${filterCount})` : ''}
          </Text>
        </Pressable>

        {hasActive && (
          <Pressable
            onPress={() => {
              setFilters(EMPTY_FILTERS);
              setSearch('');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear all</Text>
          </Pressable>
        )}
      </View>

      {!loading && !error && (
        <Text style={[styles.count, { color: colors.inkFaint }]}>
          {filtered.length === 1 ? '1 book' : `${filtered.length} books`}
        </Text>
      )}
    </View>
  );

  // Loading: header + skeleton grid.
  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
        {header}
        <View style={[styles.skeletonGrid, { paddingHorizontal: pad, gap }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} width={cardWidth} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
      <FlatList
        data={error ? [] : filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap, paddingHorizontal: pad }}
        contentContainerStyle={{ gap, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            width={cardWidth}
            onPress={() => router.push(`/listing/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          error ? (
            <ErrorState onRetry={reload} />
          ) : hasActive ? (
            <EmptyState
              icon="search-outline"
              title="No books match"
              message="Try widening your search or filters, or be the first to list this one."
              actionLabel="Clear filters"
              onAction={() => {
                setFilters(EMPTY_FILTERS);
                setSearch('');
              }}
              secondaryLabel="List a book"
              onSecondary={() => router.push('/create-listing')}
            />
          ) : (
            <EmptyState
              title="No books yet"
              message="GreenShelf is brand new. Be the first family in Oman to pass a textbook on. It takes under a minute."
              actionLabel="List a book"
              onAction={() => router.push('/create-listing')}
            />
          )
        }
      />

      <FilterSheet
        visible={sheetOpen}
        initial={filters}
        subjects={subjects}
        areas={areas}
        onClose={() => setSheetOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandName: { fontFamily: font.displayBold, fontSize: type.xxl },
  tagline: { fontFamily: font.body, fontSize: type.base, marginTop: 2, marginBottom: spacing.lg, lineHeight: type.base * 1.4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: type.base, height: '100%' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBtnText: { fontFamily: font.bodySemi, fontSize: type.sm },
  clearText: { fontFamily: font.bodySemi, fontSize: type.sm },
  count: { fontFamily: font.bodyMedium, fontSize: type.sm, marginTop: spacing.md },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
});
