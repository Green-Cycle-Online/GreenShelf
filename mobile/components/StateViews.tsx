import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, spacing, type } from '../theme/tokens';
import { Button } from './Button';

// Shared empty / error scaffolding so every list looks consistent.
export function EmptyState({
  icon = 'leaf-outline',
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentTint }]}>
        <Ionicons name={icon} size={30} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {!!message && <Text style={[styles.message, { color: colors.inkSoft }]}>{message}</Text>}
      {(actionLabel || secondaryLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <Button title={actionLabel} onPress={onAction} fullWidth={false} />
          )}
          {secondaryLabel && onSecondary && (
            <Button title={secondaryLabel} onPress={onSecondary} variant="secondary" fullWidth={false} />
          )}
        </View>
      )}
    </View>
  );
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Could not load"
      message={message || 'Something went wrong. Check your connection and try again.'}
      actionLabel="Retry"
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl, gap: spacing.md },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { fontFamily: font.displayBold, fontSize: type.lg, textAlign: 'center' },
  message: { fontFamily: font.body, fontSize: type.base, textAlign: 'center', lineHeight: type.base * 1.5, maxWidth: 320 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
});
