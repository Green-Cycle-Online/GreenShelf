import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { fetchBlockedUsers, unblockUser } from '../lib/api';
import { BlockedUser } from '../lib/types';
import { haptic } from '../lib/haptics';

export default function BlockedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, refreshBlocked } = useAuth();
  const toast = useToast();

  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchBlockedUsers(user.id)
      .then(setBlocked)
      .catch(() => toast('Could not load blocked users.', 'error'))
      .finally(() => setLoading(false));
  }, [user]);

  useFocusEffect(useCallback(() => load(), [load]));

  function confirmUnblock(b: BlockedUser) {
    Alert.alert(
      `Unblock ${b.blocked_name || 'this user'}?`,
      'Their listings will appear in your feed again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            if (!user) return;
            try {
              await unblockUser(user.id, b.blocked_id);
              haptic.success();
              await refreshBlocked();
              setBlocked((prev) => prev.filter((x) => x.id !== b.id));
              toast('User unblocked.', 'success');
            } catch (e: any) {
              toast(e.message || 'Could not unblock.', 'error');
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }}
    >
      <Stack.Screen options={{ title: 'Blocked users' }} />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxxl }} />
      ) : blocked.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.inkFaint} />
          <Text style={[styles.emptyText, { color: colors.inkSoft }]}>
            You have not blocked anyone. You can block a user from any of their listings.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          {blocked.map((b, i) => (
            <View
              key={b.id}
              style={[styles.row, i < blocked.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}
            >
              <Ionicons name="person-outline" size={20} color={colors.inkSoft} />
              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                {b.blocked_name || 'Blocked user'}
              </Text>
              <Button title="Unblock" variant="secondary" fullWidth={false} onPress={() => confirmUnblock(b)} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: font.body, fontSize: type.base, textAlign: 'center', lineHeight: type.base * 1.5 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 56 },
  name: { flex: 1, fontFamily: font.bodyMedium, fontSize: type.base },
});
