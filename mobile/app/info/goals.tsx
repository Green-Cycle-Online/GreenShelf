import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { InfoPage, H1, Lede } from '../../components/Prose';

const GOALS = [
  {
    n: '04',
    title: 'Quality Education',
    tagline: 'Lowering the cost of textbooks so the next student is never priced out of the books they need to learn.',
    target: 'UN Target 4.1',
    detail: 'GreenShelf keeps the cost of each new school year close to zero, so no student is priced out.',
  },
  {
    n: '12',
    title: 'Responsible Consumption',
    tagline: 'Reuse over re-buy, by default, keeping good books in circulation instead of in a landfill.',
    target: 'UN Target 12.5',
    detail: 'Every book passed on here is one not reprinted, repackaged, or sent to landfill.',
  },
  {
    n: '13',
    title: 'Climate Action',
    tagline: 'Every reused book quietly avoids the carbon of printing, binding, and shipping a brand-new one.',
    target: 'UN Target 13.3',
    detail: 'Skipping one reprint avoids the carbon of paper, ink, binding, and freight.',
  },
];

export default function Goals() {
  const { colors } = useTheme();
  return (
    <InfoPage>
      <Stack.Screen options={{ title: 'Our goals' }} />
      <H1>A small idea, pointed at big goals</H1>
      <Lede>
        GreenShelf is a local act of reuse that ladders up to three of the United Nations Sustainable Development Goals.
      </Lede>
      {GOALS.map((g) => (
        <View key={g.n} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <View style={styles.head}>
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.badgeNum, { color: colors.onAccent }]}>{g.n}</Text>
            </View>
            <Text style={[styles.title, { color: colors.ink }]}>{g.title}</Text>
          </View>
          <Text style={[styles.tagline, { color: colors.inkSoft }]}>{g.tagline}</Text>
          <Text style={[styles.target, { color: colors.gold }]}>{g.target}</Text>
          <Text style={[styles.detail, { color: colors.inkFaint }]}>{g.detail}</Text>
        </View>
      ))}
      <Text style={[styles.footer, { color: colors.inkFaint }]}>In support of UN SDGs 4 · 12 · 13</Text>
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  badge: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badgeNum: { fontFamily: font.displayBold, fontSize: type.md },
  title: { fontFamily: font.displayBold, fontSize: type.lg, flex: 1 },
  tagline: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.5, marginBottom: spacing.md },
  target: { fontFamily: font.bodySemi, fontSize: type.xs, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  detail: { fontFamily: font.body, fontSize: type.sm, lineHeight: type.sm * 1.5 },
  footer: { fontFamily: font.bodyMedium, fontSize: type.sm, textAlign: 'center', marginTop: spacing.lg },
});
