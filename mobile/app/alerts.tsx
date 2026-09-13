import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useSchools } from '../lib/useSchools';
import { useToast } from '../components/Toast';
import { deleteAlert, fetchMyAlerts } from '../lib/api';
import { BookAlert } from '../lib/types';
import { EmptyState, ErrorState } from '../components/StateViews';
import { haptic } from '../lib/haptics';

export default function AlertsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { schools } = useSchools();
  const toast = useToast();

  const [alerts, setAlerts] = useState<BookAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setAlerts(await fetchMyAlerts(user.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    try {
      await deleteAlert(id);
      setAlerts((a) => a.filter((x) => x.id !== id));
      haptic.success();
      toast(t('alerts.removed'), 'info');
    } catch (e: any) {
      toast(e.message || t('common.error'), 'error');
    }
  }

  function describe(a: BookAlert): string {
    const school = a.school_id ? schools.find((s) => s.id === a.school_id)?.name : null;
    const parts = [a.grade_level, a.subject, school, a.area].filter(Boolean) as string[];
    return parts.length ? parts.join(' · ') : t('alerts.any');
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <Stack.Screen options={{ title: t('alerts.title') }} />
        <EmptyState icon="notifications-outline" title={t('alerts.title')} message={t('notif.signIn')} actionLabel={t('common.signIn')} onAction={() => router.push('/auth')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack.Screen options={{ title: t('alerts.title') }} />
      <FlatList
        data={error || loading ? [] : alerts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.sm }}
        ListHeaderComponent={<Text style={[styles.subtitle, { color: colors.inkSoft }]}>{t('alerts.subtitle')}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Ionicons name={item.category === 'reading' ? 'book-outline' : 'school-outline'} size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cat, { color: colors.inkFaint }]}>{item.category === 'reading' ? t('category.reading') : t('category.school')}</Text>
              <Text style={[styles.desc, { color: colors.ink }]}>{describe(item)}</Text>
            </View>
            <Pressable onPress={() => remove(item.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('alerts.delete')}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          error ? (
            <ErrorState onRetry={load} />
          ) : loading ? null : (
            <EmptyState icon="notifications-outline" title={t('alerts.title')} message={t('alerts.empty')} actionLabel={t('tabs.browse')} onAction={() => router.push('/')} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.45, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  cat: { fontFamily: font.bodySemi, fontSize: type.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  desc: { fontFamily: font.bodyMedium, fontSize: type.base, marginTop: 2 },
});
