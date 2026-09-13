import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { fetchNotifications, markNotificationsRead } from '../lib/api';
import { Notification } from '../lib/types';
import { formatRelativeTime } from '../lib/format';
import { EmptyState, ErrorState } from '../components/StateViews';
import { Button } from '../components/Button';
import { haptic } from '../lib/haptics';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      setItems(await fetchNotifications(user.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const unread = items.filter((n) => !n.read_at);

  async function markAll() {
    if (!user || unread.length === 0) return;
    try {
      await markNotificationsRead(user.id);
      const now = new Date().toISOString();
      setItems((arr) => arr.map((n) => ({ ...n, read_at: n.read_at || now })));
      haptic.success();
    } catch {
      /* best effort */
    }
  }

  function open(n: Notification) {
    haptic.light();
    if (!n.read_at && user) {
      markNotificationsRead(user.id, [n.id]).catch(() => {});
      setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    if (n.kind === 'listing_match' && n.listing_id) router.push(`/listing/${n.listing_id}`);
    else if (n.kind === 'request_response' && n.request_id) router.push(`/request/${n.request_id}`);
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <Stack.Screen options={{ title: t('notif.title') }} />
        <EmptyState icon="notifications-outline" title={t('notif.title')} message={t('notif.signIn')} actionLabel={t('common.signIn')} onAction={() => router.push('/auth')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack.Screen
        options={{
          title: t('notif.title'),
          headerRight: () =>
            unread.length > 0 ? (
              <Pressable onPress={markAll} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: colors.accent, fontFamily: font.bodySemi, fontSize: type.sm }}>{t('notif.markAllRead')}</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={error || loading ? [] : items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
        renderItem={({ item }) => {
          const isUnread = !item.read_at;
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: isUnread ? colors.accentTint : colors.surface, borderColor: isUnread ? colors.accent : colors.hairline, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
                <Ionicons name={item.kind === 'request_response' ? 'hand-left-outline' : 'book-outline'} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>{item.title}</Text>
                {!!item.body && <Text style={[styles.body, { color: colors.inkSoft }]} numberOfLines={2}>{item.body}</Text>}
                <Text style={[styles.time, { color: colors.inkFaint }]}>{formatRelativeTime(item.created_at)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          error ? (
            <ErrorState onRetry={() => load()} />
          ) : loading ? null : (
            <EmptyState icon="notifications-outline" title={t('notif.title')} message={t('notif.empty')} />
          )
        }
        ListFooterComponent={
          !loading && !error ? (
            <Button title={t('alerts.title')} variant="ghost" onPress={() => router.push('/alerts')} style={{ marginTop: spacing.md }} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bodySemi, fontSize: type.base },
  body: { fontFamily: font.body, fontSize: type.sm },
  time: { fontFamily: font.body, fontSize: type.xs, marginTop: 2 },
});
