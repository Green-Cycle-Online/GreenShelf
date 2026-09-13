import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { Category } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/haptics';

// Segmented control: School books | Reading books. Used on Browse and on the
// create forms so the two halves of the catalogue never mix by accident.
export function CategoryToggle({
  value,
  onChange,
  compact = false,
}: {
  value: Category;
  onChange: (c: Category) => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const items: { value: Category; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'school', label: t('category.school'), icon: 'school-outline' },
    { value: 'reading', label: t('category.reading'), icon: 'book-outline' },
  ];
  return (
    <View style={[styles.track, { backgroundColor: colors.surface2, borderColor: colors.hairline }]}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <Pressable
            key={it.value}
            onPress={() => {
              if (active) return;
              haptic.selection();
              onChange(it.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.seg,
              compact && styles.segCompact,
              active && { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
            ]}
          >
            <Ionicons name={it.icon} size={15} color={active ? colors.accent : colors.inkFaint} />
            <Text style={[styles.label, { color: active ? colors.ink : colors.inkSoft }]} numberOfLines={1}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: radius.pill,
  },
  segCompact: { height: 34 },
  label: { fontFamily: font.bodySemi, fontSize: type.sm },
});
