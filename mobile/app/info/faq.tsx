import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { InfoPage, H1, Lede } from '../../components/Prose';
import { SUPPORT_EMAIL } from '../../lib/constants';
import { haptic } from '../../lib/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEMS: { q: string; a: string }[] = [
  { q: 'Is GreenShelf free?', a: 'Yes, completely. No fees, no commission.' },
  {
    q: 'Is GreenShelf safe?',
    a: 'Safety matters, especially because many of our users are students. Every user creates a profile with a real first name. Listings show your neighborhood, never your exact address. Anyone can report a listing or user behaving badly, and we review reports within 24 hours. For in-person handovers, we recommend meeting in public places during daytime, and that anyone under 18 is accompanied by a parent.',
  },
  {
    q: 'How do I list a book?',
    a: 'Tap the List tab anywhere in the app. Fill in the title, grade, subject, condition and how people can reach you. If you do not have an account yet, we will have you create one in 20 seconds at the end.',
  },
  { q: 'How do I get a book someone listed?', a: 'Open the listing, see the contact info, and reach out directly.' },
  {
    q: 'Is my contact info safe?',
    a: 'Your account email is private. We only ask for your area, never your full address. Read our Privacy screen for details.',
  },
  { q: 'What if the book is damaged?', a: 'Be honest about condition when listing. Use photos.' },
  { q: 'What happens after a book is claimed?', a: 'Mark it as claimed. You can un-claim it anytime from your listing.' },
  { q: 'How do I delete my account?', a: 'In your profile, scroll down to the Danger zone and tap Delete my account.' },
  { q: 'I saw a spammy listing.', a: "Open the listing and tap Report. We will review it within 24 hours." },
];

function Item({ q, a }: { q: string; a: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((o) => !o);
      }}
      style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View style={styles.qRow}>
        <Text style={[styles.q, { color: colors.ink }]}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkFaint} />
      </View>
      {open && <Text style={[styles.a, { color: colors.inkSoft }]}>{a}</Text>}
    </Pressable>
  );
}

export default function Faq() {
  const { colors } = useTheme();
  return (
    <InfoPage>
      <Stack.Screen options={{ title: 'FAQ' }} />
      <H1>Questions you might have</H1>
      <Lede>Short answers. If yours is not here, email {SUPPORT_EMAIL}.</Lede>
      {ITEMS.map((it) => (
        <Item key={it.q} q={it.q} a={it.a} />
      ))}
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  item: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, marginBottom: spacing.sm },
  qRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  q: { flex: 1, fontFamily: font.bodySemi, fontSize: type.base },
  a: { fontFamily: font.body, fontSize: type.sm, lineHeight: type.sm * 1.6, marginTop: spacing.md },
});
