import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { font, spacing, type } from '../../theme/tokens';
import { InfoPage, H1, Lede } from '../../components/Prose';
import { SUPPORT_EMAIL } from '../../lib/constants';

// Condensed from privacy.html. Plain language, same commitments.
const SECTIONS: { h: string; p?: string; bullets?: string[] }[] = [
  {
    h: '1. Who we are',
    p: `GreenShelf is an independent project run by Hitesh Gurnani and Anshul Date. We are not a registered company. There are no investors, advertisers, or third parties profiting from your data. If anything is unclear, email ${SUPPORT_EMAIL}.`,
  },
  {
    h: '2. Information we collect',
    p: 'When you create an account or list a book, we collect:',
    bullets: [
      'Your name (shown on your profile and listings)',
      'Email address (for sign-in only, never shown publicly)',
      'Area / neighborhood, never your full address',
      'Listings you post: title, condition, photos, description, grade, subject',
      'Profile information you choose to add',
    ],
  },
  {
    h: '3. How we use it',
    bullets: [
      'To let you sign in and stay signed in',
      'To display your listings so other users can find books',
      'To help users contact each other about books',
      'To respond to reports of misuse or safety concerns',
    ],
  },
  {
    h: '4. How it is stored',
    p: 'Your data is stored securely on Supabase, a reputable cloud database used by thousands of apps. Passwords are hashed (we cannot read them). Photos are stored in encrypted cloud storage. We never sell your data and we do not run ads.',
  },
  {
    h: '5. Users under 18',
    p: 'Many of our users are minors. If you are under 18, please use GreenShelf with the knowledge and permission of a parent or guardian. We strongly recommend in-person book exchanges are supervised by an adult.',
  },
  {
    h: '6. Your rights',
    bullets: [
      'Edit or delete your listings anytime',
      'Update your profile information',
      'Request full deletion of your account and all data',
      'Request a copy of any data we hold about you',
    ],
  },
  {
    h: '7. Contact',
    p: `Questions, concerns, or requests about your data: ${SUPPORT_EMAIL}. We aim to respond within 7 days.`,
  },
];

export default function Privacy() {
  const { colors } = useTheme();
  return (
    <InfoPage>
      <Stack.Screen options={{ title: 'Privacy' }} />
      <H1>Privacy Policy</H1>
      <Lede>
        GreenShelf is a free, not-for-profit book-sharing platform built by two students in Oman. Plain language, no
        tricks.
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
