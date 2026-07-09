import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { InfoPage, H1, Lede } from '../../components/Prose';

const STEPS = [
  {
    n: '01',
    title: 'Find a book',
    body: 'Filter by grade, subject, or condition. Find the exact textbook another family in Oman has on their shelf.',
  },
  {
    n: '02',
    title: 'Reach out',
    body: 'Message them on WhatsApp, call, or email directly, with no app inbox or middleman in between.',
  },
  {
    n: '03',
    title: 'Pick it up',
    body: 'Arrange a quick handover in a public place. The book gets a second life and your shelf gets a little space back.',
  },
];

export default function HowItWorks() {
  const { colors } = useTheme();
  return (
    <InfoPage>
      <Stack.Screen options={{ title: 'How it works' }} />
      <H1>How it works</H1>
      <Lede>Three simple steps, start to finish. Free, and no account needed to browse.</Lede>
      {STEPS.map((s) => (
        <View key={s.n} style={[styles.step, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <Text style={[styles.num, { color: colors.gold }]}>{s.n}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.ink }]}>{s.title}</Text>
            <Text style={[styles.body, { color: colors.inkSoft }]}>{s.body}</Text>
          </View>
        </View>
      ))}
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  num: { fontFamily: font.displayBold, fontSize: type.xl, width: 40 },
  title: { fontFamily: font.displayBold, fontSize: type.md, marginBottom: 4 },
  body: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.5 },
});
