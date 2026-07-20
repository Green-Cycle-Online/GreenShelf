import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { font, spacing, type } from '../../theme/tokens';
import { InfoPage, H1, Lede } from '../../components/Prose';
import { SUPPORT_EMAIL } from '../../lib/constants';

// End User License Agreement / Terms of Use. The zero-tolerance section is
// required by App Store Guideline 1.2 (user-generated content) and is shown to
// every user before they create an account (see app/auth.tsx).
const SECTIONS: { h: string; p?: string; bullets?: string[] }[] = [
  {
    h: 'Zero tolerance for objectionable content and abusive users',
    p: 'GreenShelf has zero tolerance for objectionable content or abusive behavior. By using GreenShelf you agree not to post content that is offensive, hateful, harassing, threatening, sexually explicit, discriminatory, illegal, or otherwise objectionable, and not to abuse, harass, or harm other users. Listings must be genuine offers of school books.',
  },
  {
    h: 'How we enforce this',
    bullets: [
      'Every listing can be reported by any user from the listing screen.',
      'Any user can block another user, which instantly hides that user from their feed and flags them to us.',
      'We review reports and remove objectionable content within 24 hours.',
      'Users who post objectionable content or abuse others are removed from GreenShelf.',
    ],
  },
  {
    h: 'Your responsibilities',
    bullets: [
      'You are responsible for the content you post and your conduct with other users.',
      'Share only a general area, never your full home address.',
      'Meet safely, and if you are under 18, exchange books with a parent or guardian aware.',
    ],
  },
  {
    h: 'The service',
    p: 'GreenShelf is a free, not-for-profit platform for exchanging school books in Oman. It is provided as-is, with no guarantee that listings are accurate or that exchanges will happen. GreenShelf is not a party to any exchange between users.',
  },
  {
    h: 'Reporting and contact',
    p: `To report objectionable content or an abusive user, use the Report or Block option on any listing, or email ${SUPPORT_EMAIL}. We act on reports within 24 hours.`,
  },
];

export default function Terms() {
  const { colors } = useTheme();
  return (
    <InfoPage>
      <Stack.Screen options={{ title: 'Terms of Use' }} />
      <H1>Terms of Use</H1>
      <Lede>
        By creating an account or using GreenShelf, you agree to these terms. Please read the first section carefully.
      </Lede>
      {SECTIONS.map((s) => (
        <View key={s.h} style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.h, { color: colors.ink }]}>{s.h}</Text>
          {!!s.p && <Text style={[styles.p, { color: colors.inkSoft }]}>{s.p}</Text>}
          {s.bullets?.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Text style={[styles.dot, { color: colors.accent }]}>•</Text>
              <Text style={[styles.bullet, { color: colors.inkSoft }]}>{b}</Text>
            </View>
          ))}
        </View>
      ))}
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: font.displayBold, fontSize: type.md, marginBottom: spacing.sm },
  p: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.6 },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  dot: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.6 },
  bullet: { flex: 1, fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.6 },
});
