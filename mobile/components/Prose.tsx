import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';
import { font, spacing, type } from '../theme/tokens';

// Shared reading layout for the static info screens (how it works, about, etc.).
export function InfoPage({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Lede({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.lede, { color: colors.inkSoft }]}>{children}</Text>;
}

export function H1({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.h1, { color: colors.ink }]}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.h2, { color: colors.ink }]}>{children}</Text>;
}

export function P({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.p, { color: colors.inkSoft }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  h1: { fontFamily: font.displayBold, fontSize: type.xxl, marginBottom: spacing.sm },
  lede: { fontFamily: font.body, fontSize: type.md, lineHeight: type.md * 1.5, marginBottom: spacing.xl },
  h2: { fontFamily: font.displayBold, fontSize: type.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  p: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.6, marginBottom: spacing.md },
});
