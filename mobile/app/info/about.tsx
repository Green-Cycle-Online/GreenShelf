import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { InfoPage, H1, Lede, H2, P } from '../../components/Prose';

const FOUNDERS = [
  {
    name: 'Hitesh Gurnani',
    photo: require('../../assets/hitesh.jpg'),
    bio: 'My name is Hitesh and I really like side-quest projects like GreenShelf. Building stuff that makes everyday life in Oman a little easier is the goal, and I hope this helps you find or give a book away :)',
  },
  {
    name: 'Anshul Date',
    photo: require('../../assets/anshul.jpg'),
    bio: "My name is Anshul and I really like doing maths (go follow bobodoesmaths on insta). I'm building GreenShelf with Hitesh because passing your books on shouldn't be this hard.",
  },
];

export default function About() {
  const { colors } = useTheme();
  return (
    <InfoPage>
      <Stack.Screen options={{ title: 'About' }} />
      <H1>About GreenShelf</H1>
      <Lede>Built by two students in Oman who got tired of WhatsApp chaos.</Lede>

      {FOUNDERS.map((f) => (
        <View key={f.name} style={[styles.person, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
          <Image source={f.photo} style={styles.photo} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.ink }]}>{f.name}</Text>
            <Text style={[styles.bio, { color: colors.inkSoft }]}>{f.bio}</Text>
          </View>
        </View>
      ))}

      <H2>Why we built this</H2>
      <P>
        At the end of every school year, our friends' parents would post in WhatsApp groups: "Anyone need a Grade 9
        math book?" Within minutes, the message would be lost in 200 unrelated messages. Books that could have been
        passed on quietly ended up in the recycling.
      </P>
      <P>
        We thought: surely there's a calmer way. So we built GreenShelf, a small, free app to make book-sharing simple,
        searchable, and human. Pass it on, don't bin it.
      </P>

      <View style={[styles.quote, { borderLeftColor: colors.accent }]}>
        <Text style={[styles.quoteText, { color: colors.ink }]}>
          Every June in Oman, perfectly good textbooks pile up in homes, and two streets away, a family is searching for
          that exact book. GreenShelf is the bridge.
        </Text>
        <Text style={[styles.quoteBy, { color: colors.inkFaint }]}>Hitesh & Anshul, founders · Muscat, 2026</Text>
      </View>
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  person: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  photo: { width: 72, height: 72, borderRadius: radius.md },
  name: { fontFamily: font.displayBold, fontSize: type.md, marginBottom: 4 },
  bio: { fontFamily: font.body, fontSize: type.sm, lineHeight: type.sm * 1.55 },
  quote: { borderLeftWidth: 3, paddingLeft: spacing.lg, marginTop: spacing.lg },
  quoteText: { fontFamily: font.display, fontSize: type.md, lineHeight: type.md * 1.5, fontStyle: 'italic' },
  quoteBy: { fontFamily: font.bodyMedium, fontSize: type.xs, marginTop: spacing.sm },
});
