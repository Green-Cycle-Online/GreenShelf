import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { fetchOpenRequests } from '../../lib/api';
import { BookRequest } from '../../lib/types';
import { formatRelativeTime } from '../../lib/format';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { Button } from '../../components/Button';
import { Tag } from '../../components/Tag';
import { haptic } from '../../lib/haptics';

export default function WantedScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      setRequests(await fetchOpenRequests());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const header = (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('wanted.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{t('wanted.subtitle')}</Text>
      <Button
        title={t('wanted.post')}
        onPress={() => router.push('/create-request')}
        style={{ marginBottom: spacing.md }}
      />
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top }]}>
      <FlatList
        data={error || loading ? [] : requests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.sm, paddingHorizontal: spacing.lg }}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <RequestRow request={item} mine={!!user && item.requester_id === user.id} onPress={() => router.push(`/request/${item.id}`)} />
        )}
        ListEmptyComponent={
          error ? (
            <ErrorState onRetry={() => load()} />
          ) : loading ? null : (
            <EmptyState
              icon="hand-left-outline"
              title={t('wanted.emptyTitle')}
              message={t('wanted.emptyMsg')}
              actionLabel={t('wanted.post')}
              onAction={() => router.push('/create-request')}
            />
          )
        }
      />
    </View>
  );
}

export function RequestRow({ request, mine, onPress }: { request: BookRequest; mine: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const where = [request.area, request.school].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={() => {
        haptic.light();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: mine ? colors.accent : colors.hairline, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>
          {mine ? t('wanted.yourRequest') : t('wanted.lookingFor')}
        </Text>
        <Text style={[styles.time, { color: colors.inkFaint }]}>{formatRelativeTime(request.created_at)}</Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.ink }]} numberOfLines={2}>{request.title}</Text>
      <View style={styles.tags}>
        {request.category === 'reading' && <Tag label={t('category.reading')} kind="status" />}
        {!!request.grade_level && <Tag label={request.grade_level} kind="grade" />}
        {!!request.subject && <Tag label={request.subject} kind="subject" />}
      </View>
      <View style={styles.footer}>
        <Ionicons name="person-circle-outline" size={14} color={colors.inkFaint} />
        <Text style={[styles.footerText, { color: colors.inkFaint }]} numberOfLines={1}>
          {t('wanted.postedBy', { name: request.requester_name })}{where ? ` · ${where}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontFamily: font.displayBold, fontSize: type.xxl },
  subtitle: { fontFamily: font.body, fontSize: type.base, marginTop: 2, marginBottom: spacing.md, lineHeight: type.base * 1.4 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: font.bodySemi, fontSize: type.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  time: { fontFamily: font.body, fontSize: type.xs },
  cardTitle: { fontFamily: font.displayBold, fontSize: type.lg, lineHeight: type.lg * 1.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontFamily: font.body, fontSize: type.xs, flex: 1 },
});
