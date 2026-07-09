import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { GRADES, CONDITIONS, ALL_AREAS, BASE_SUBJECTS } from '../lib/constants';
import { Button } from './Button';
import { haptic } from '../lib/haptics';

export interface Filters {
  grade: string;
  subject: string;
  condition: string;
  area: string;
}

export const EMPTY_FILTERS: Filters = { grade: '', subject: '', condition: '', area: '' };

export function activeFilterCount(f: Filters): number {
  return [f.grade, f.subject, f.condition, f.area].filter(Boolean).length;
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              haptic.selection();
              onChange(selected ? '' : opt.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.accent : colors.surface,
                borderColor: selected ? colors.accent : colors.hairlineStrong,
              },
            ]}
          >
            <Text
              style={[styles.chipText, { color: selected ? colors.onAccent : colors.inkSoft }]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FilterSheet({
  visible,
  initial,
  subjects,
  areas,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: Filters;
  subjects: string[];
  areas: string[];
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Filters>(initial);

  // Re-sync the draft each time the sheet opens.
  React.useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible]);

  const subjectOpts = [...new Set([...BASE_SUBJECTS, ...subjects])]
    .sort()
    .map((s) => ({ label: s, value: s }));
  const areaOpts = [...new Set([...ALL_AREAS, ...areas])].sort().map((a) => ({ label: a, value: a }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle}>
            <View style={[styles.grabber, { backgroundColor: colors.hairlineStrong }]} />
          </View>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.ink }]}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close filters">
              <Ionicons name="close" size={24} color={colors.inkSoft} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.section, { color: colors.inkFaint }]}>Grade</Text>
            <ChipRow
              options={GRADES.map((g) => ({ label: g.replace('Grade ', 'G'), value: g }))}
              value={draft.grade}
              onChange={(v) => setDraft((d) => ({ ...d, grade: v }))}
            />

            <Text style={[styles.section, { color: colors.inkFaint }]}>Subject</Text>
            <ChipRow
              options={subjectOpts}
              value={draft.subject}
              onChange={(v) => setDraft((d) => ({ ...d, subject: v }))}
            />

            <Text style={[styles.section, { color: colors.inkFaint }]}>Condition</Text>
            <ChipRow
              options={CONDITIONS.map((c) => ({ label: c.label, value: c.value }))}
              value={draft.condition}
              onChange={(v) => setDraft((d) => ({ ...d, condition: v }))}
            />

            <Text style={[styles.section, { color: colors.inkFaint }]}>Area</Text>
            <ChipRow
              options={areaOpts}
              value={draft.area}
              onChange={(v) => setDraft((d) => ({ ...d, area: v }))}
            />
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Clear all"
              variant="secondary"
              fullWidth={false}
              onPress={() => setDraft(EMPTY_FILTERS)}
              style={{ flex: 1 }}
            />
            <Button
              title="Show results"
              fullWidth={false}
              onPress={() => onApply(draft)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  handle: { alignItems: 'center', paddingVertical: spacing.sm },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: font.displayBold, fontSize: type.xl },
  section: {
    fontFamily: font.bodySemi,
    fontSize: type.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipText: { fontFamily: font.bodyMedium, fontSize: type.sm },
  footer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
