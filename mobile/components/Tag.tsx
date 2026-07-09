import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { Condition } from '../lib/types';

type TagKind = 'grade' | 'subject' | 'condition' | 'status';

export function Tag({
  label,
  kind = 'subject',
  condition,
}: {
  label: string;
  kind?: TagKind;
  condition?: Condition;
}) {
  const { colors } = useTheme();

  let bg = colors.surface2;
  let fg = colors.inkSoft;
  let border = colors.hairline;

  if (kind === 'grade') {
    bg = colors.accentTint;
    fg = colors.accent;
    border = 'transparent';
  } else if (kind === 'status') {
    bg = colors.gold;
    fg = colors.onAccent;
    border = 'transparent';
  } else if (kind === 'condition') {
    if (condition === 'new') {
      bg = colors.accentTint;
      fg = colors.accent;
    } else if (condition === 'worn') {
      bg = colors.errorSoft;
      fg = colors.error;
    }
    border = 'transparent';
  }

  const text =
    kind === 'condition' && label ? label.charAt(0).toUpperCase() + label.slice(1) : label;

  return (
    <View style={[styles.tag, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontFamily: font.bodySemi,
    fontSize: type.xs,
  },
});
