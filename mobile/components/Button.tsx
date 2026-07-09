import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { haptic } from '../lib/haptics';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  fullWidth = true,
  hapticStyle = 'light',
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  hapticStyle?: 'light' | 'medium' | 'none';
}) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.error
        : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.onAccent
      : variant === 'danger'
        ? '#fff'
        : variant === 'ghost'
          ? colors.accent
          : colors.ink;
  const border =
    variant === 'secondary' ? colors.hairlineStrong : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        if (hapticStyle !== 'none') haptic[hapticStyle]();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        fullWidth && styles.full,
        {
          backgroundColor: variant === 'secondary' ? colors.surface : bg,
          borderColor: border,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  label: {
    fontFamily: font.bodySemi,
    fontSize: type.md,
  },
});
