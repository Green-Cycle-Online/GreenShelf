import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { useListings } from '../../lib/useListings';
import { useSchools } from '../../lib/useSchools';
import { useUnreadCount } from '../../lib/useNotifications';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useToast } from '../../components/Toast';
import { ListingCard } from '../../components/ListingCard';
import { SkeletonCard } from '../../components/Skeleton';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { FilterSheet, Filters, EMPTY_FILTERS, activeFilterCount } from '../../components/FilterSheet';
import { CategoryToggle } from '../../components/CategoryToggle';
import { Leaf } from '../../components/Logo';
import { haptic } from '../../lib/haptics';
import { Category, Listing } from '../../lib/types';
import { fetchSharedCount, fetchShowLiveCounter, insertAlert } from '../../lib/api';
import { loadPosterDefaults } from '../../lib/posterDefaults';

export default function BrowseScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const toast = useToast();
  const { listings, loading, error, refreshing, refresh, reload } = useListings();
  const { active: activeSchools } = useSchools();
  const { count: unread, refresh: refreshUnread } = useUnreadCount();

  const [category, setCategory] = useState<Category>('school');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [myArea, setMyArea] = useState<string>('');
  const [savingAlert, setSavingAlert] = useState(false);
  const [sharedCount, setSharedCount] = useState<number | null>(null);

  useEffect(() => {
    loadPosterDefaults().then((d) => setMyArea(d.area || ''));
    // Live counter: only when the admin switch is on (same rule as the website).
    fetchShowLiveCounter()
      .then((on) => (on ? fetchSharedCount() : Promise.resolve(null)))
      .then((n) => setSharedCount(n && n > 0 ? n : null))
      .catch(() => setSharedCount(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshUnread();
    }, [refreshUnread]),
  );

  const gap = spacing.md;
  const pad = spacing.lg;
  const cardWidth = (width - pad * 2 - gap) / 2;

  const inCategory = useMemo(() => listings.filter((l) => l.category === category), [listings, category]);

  // Client-side filtering, same rules as the website's applyFilters.
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const out = inCategory.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q) && !(l.subject || '').toLowerCase().includes(q)) return false;
      if (filters.grade && l.grade_level !== filters.grade) return false;
      if (filters.subject && l.subject !== filters.subject) return false;
      if (filters.condition && l.condition !== filters.condition) return false;
      if (filters.area && l.area !== filters.area) return false;
      if (filters.school && l.school !== filters.school) return false;
      if (filters.photosOnly && !(l.photos && l.photos.length > 0)) return false;
      return true;
    });
    return sortListings(out, filters.sort, myArea);
  }, [inCategory, search, filters, myArea]);

  const subjects = useMemo(() => [...new Set(inCategory.map((l) => l.subject).filter(Boolean))], [inCategory]);
  const areas = useMemo(() => [...new Set(inCategory.map((l) => l.area).filter(Boolean) as string[])], [inCategory]);
  const schoolNames = useMemo(
    () => [...new Set([...activeSchools.map((s) => s.name), ...(inCategory.map((l) => l.school).filter(Boolean) as string[])])],
    [activeSchools, inCategory],
  );

  const filterCount = activeFilterCount(filters);
  const hasActive = filterCount > 0 || !!search;

  function switchCategory(c: Category) {
    setCategory(c);
    // Grade/subject/school mean different things per category, so they reset.
    setFilters((f) => ({ ...f, grade: '', subject: '', school: '' }));
  }

  async function notifyMe() {
    if (!user) {
      toast(t('browse.signInForAlerts'), 'info');
      router.push('/auth');
      return;
    }
    setSavingAlert(true);
    try {
      const school = filters.school ? activeSchools.find((s) => s.name === filters.school) : undefined;
      await insertAlert(
        {
          category,
          school_id: school ? school.id : null,
          grade_level: filters.grade || null,
          subject: filters.subject || null,
          area: filters.area || null,
        },
        user.id,
      );
      haptic.success();
      toast(t('browse.alertSaved'), 'success');
    } catch (e: any) {
      toast(e.message || t('common.error'), 'error');
    } finally {
      setSavingAlert(false);
    }
  }

  const header = (
    <View style={{ paddingHorizontal: pad }}>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <Leaf size={26} color={colors.accent} />
          <Text style={[styles.brandName, { color: colors.ink }]}>GreenShelf</Text>
        </View>
        <Pressable
          onPress={() => {
            haptic.light();
            router.push('/notifications');
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('browse.notifications')}
          style={[styles.bell, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.inkSoft} />
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <Text style={[styles.tagline, { color: colors.inkSoft }]}>
        {category === 'reading' ? t('browse.taglineReading') : t('browse.tagline')}
      </Text>
      {sharedCount !== null && (
        <View style={[styles.counter, { backgroundColor: colors.accentTint }]}>
          <Ionicons name="leaf-outline" size={14} color={colors.accent} />
          <Text style={[styles.counterText, { color: colors.accent }]}>{t('browse.shared', { n: sharedCount })}</Text>
        </View>
      )}

      <CategoryToggle value={category} onChange={switchCategory} />

      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Ionicons name="search" size={18} color={colors.inkFaint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={category === 'reading' ? t('browse.searchReading') : t('browse.search')}
          placeholderTextColor={colors.inkFaint}
          style={[styles.searchInput, { color: colors.ink }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel={t('browse.search')}
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityLabel={t('browse.clearAll')}>
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
          accessibilityLabel={`${t('browse.filters')}${filterCount ? `, ${filterCount}` : ''}`}
        >
          <Ionicons name="options-outline" size={17} color={filterCount ? colors.accent : colors.inkSoft} />
          <Text style={[styles.filterBtnText, { color: filterCount ? colors.accent : colors.inkSoft }]}>
            {t('browse.filters')}{filterCount ? ` (${filterCount})` : ''}
          </Text>
        </Pressable>

        <Pressable
          onPress={notifyMe}
          disabled={savingAlert}
          style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.hairlineStrong, opacity: savingAlert ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('browse.notifyMe')}
          accessibilityHint={t('browse.notifyHint')}
        >
          <Ionicons name="notifications-outline" size={17} color={colors.inkSoft} />
          <Text style={[styles.filterBtnText, { color: colors.inkSoft }]}>{t('browse.notifyMe')}</Text>
        </Pressable>

        {hasActive && (
          <Pressable
            onPress={() => {
              setFilters(EMPTY_FILTERS);
              setSearch('');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('browse.clearAll')}
          >
            <Text style={[styles.clearText, { color: colors.accent }]}>{t('browse.clearAll')}</Text>
          </Pressable>
        )}
      </View>

      {!loading && !error && (
        <Text style={[styles.count, { color: colors.inkFaint }]}>
          {filtered.length === 1 ? t('browse.oneBook') : t('browse.nBooks', { n: filtered.length })}
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
              title={t('browse.noMatchTitle')}
              message={t('browse.noMatchMsg')}
              actionLabel={t('browse.clearFilters')}
              onAction={() => {
                setFilters(EMPTY_FILTERS);
                setSearch('');
              }}
              secondaryLabel={t('browse.listABook')}
              onSecondary={() => router.push('/create-listing')}
            />
          ) : (
            <EmptyState
              title={t('browse.emptyTitle')}
              message={t('browse.emptyMsg')}
              actionLabel={t('browse.listABook')}
              onAction={() => router.push('/create-listing')}
            />
          )
        }
      />

      <FilterSheet
        visible={sheetOpen}
        initial={filters}
        category={category}
        subjects={subjects}
        areas={areas}
        schools={schoolNames}
        onClose={() => setSheetOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}

function sortListings(items: Listing[], sort: Filters['sort'], myArea: string): Listing[] {
  const byNewest = (a: Listing, b: Listing) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  const arr = [...items].sort(byNewest);
  if (sort === 'oldest') return arr.reverse();
  if (sort === 'photos') return [...arr.filter((l) => l.photos && l.photos.length), ...arr.filter((l) => !(l.photos && l.photos.length))];
  if (sort === 'my_area' && myArea) return [...arr.filter((l) => l.area === myArea), ...arr.filter((l) => l.area !== myArea)];
  return arr;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandName: { fontFamily: font.displayBold, fontSize: type.xxl },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 10 },
  tagline: { fontFamily: font.body, fontSize: type.base, marginTop: 2, marginBottom: spacing.md, lineHeight: type.base * 1.4 },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  counterText: { fontFamily: font.bodySemi, fontSize: type.xs },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    height: 48,
    marginTop: spacing.md,
  },
  searchInput: { flex: 1, fontFamily: font.body, fontSize: type.base, height: '100%' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBtnText: { fontFamily: font.bodySemi, fontSize: type.sm },
  clearText: { fontFamily: font.bodySemi, fontSize: type.sm, marginLeft: spacing.xs },
  count: { fontFamily: font.bodyMedium, fontSize: type.sm, marginTop: spacing.md },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
});
