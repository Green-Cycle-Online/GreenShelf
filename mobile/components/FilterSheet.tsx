import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { GRADES, AGE_BANDS, GENRES, CONDITIONS, BASE_SUBJECTS, SORT_OPTIONS, SortKey } from '../lib/constants';
import { useAreas } from '../lib/useAreas';
import { Category } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { Button } from './Button';
import { haptic } from '../lib/haptics';

export interface Filters {
  grade: string;      // a grade for school books, an age band for reading books
  subject: string;    // a subject for school books, a genre for reading books
  condition: string;
  area: string;
  school: string;     // school NAME, so old rows without school_id still match
  sort: SortKey;
  photosOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  grade: '', subject: '', condition: '', area: '', school: '', sort: 'newest', photosOnly: false,
};

export function activeFilterCount(f: Filters): number {
  return (
    [f.grade, f.subject, f.condition, f.area, f.school].filter(Boolean).length +
    (f.photosOnly ? 1 : 0) +
    (f.sort !== 'newest' ? 1 : 0)
  );
}

function ChipRow({
  options,
  value,
  onChange,
  radio = false,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  radio?: boolean; // radio rows cannot be deselected (e.g. sort)
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
              if (radio && selected) return;
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
            <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.inkSoft }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FilterSheet({
  visible,
  initial,
  category,
  subjects,
  areas,
  schools,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: Filters;
  category: Category;
  subjects: string[]; // extra values seen on listings (custom subjects / genres)
  areas: string[];
  schools: string[]; // active school names plus any names seen on listings
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { names: areaNames } = useAreas();
  const [draft, setDraft] = useState<Filters>(initial);

  // Re-sync the draft each time the sheet opens.
  React.useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible]);

  const isReading = category === 'reading';
  const levelOpts = isReading
    ? AGE_BANDS.map((a) => ({ label: a, value: a }))
    : GRADES.map((g) => ({ label: g.replace('Grade ', 'G'), value: g }));
  const base = isReading ? GENRES : BASE_SUBJECTS;
  const subjectOpts = [...new Set([...base, ...subjects])].sort().map((s) => ({ label: s, value: s }));
  const areaOpts = [...new Set([...areaNames, ...areas])].sort().map((a) => ({ label: a, value: a }));
  const schoolOpts = [...new Set(schools)].sort().map((s) => ({ label: s, value: s }));
  const sortOpts = SORT_OPTIONS.map((s) => ({ label: t(`sort.${s.value}` as const), value: s.value }));
  const conditionOpts = CONDITIONS.map((c) => ({ label: t(`condition.${c.value}` as const), value: c.value }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle}>
            <View style={[styles.grabber, { backgroundColor: colors.hairlineStrong }]} />
          </View>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.ink }]}>{t('filters.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('filters.close')}>
              <Ionicons name="close" size={24} color={colors.inkSoft} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.section, { color: colors.inkFaint }]}>{t('filters.sort')}</Text>
            <ChipRow options={sortOpts} value={draft.sort} radio onChange={(v) => setDraft((d) => ({ ...d, sort: (v || 'newest') as SortKey }))} />

            <Text style={[styles.section, { color: colors.inkFaint }]}>{isReading ? t('filters.age') : t('filters.grade')}</Text>
            <ChipRow options={levelOpts} value={draft.grade} onChange={(v) => setDraft((d) => ({ ...d, grade: v }))} />

            <Text style={[styles.section, { color: colors.inkFaint }]}>{isReading ? t('filters.genre') : t('filters.subject')}</Text>
            <ChipRow options={subjectOpts} value={draft.subject} onChange={(v) => setDraft((d) => ({ ...d, subject: v }))} />

            {!isReading && schoolOpts.length > 0 && (
              <>
                <Text style={[styles.section, { color: colors.inkFaint }]}>{t('filters.school')}</Text>
                <ChipRow options={schoolOpts} value={draft.school} onChange={(v) => setDraft((d) => ({ ...d, school: v }))} />
              </>
            )}

            <Text style={[styles.section, { color: colors.inkFaint }]}>{t('filters.condition')}</Text>
            <ChipRow options={conditionOpts} value={draft.condition} onChange={(v) => setDraft((d) => ({ ...d, condition: v }))} />

            <Text style={[styles.section, { color: colors.inkFaint }]}>{t('filters.area')}</Text>
            <ChipRow options={areaOpts} value={draft.area} onChange={(v) => setDraft((d) => ({ ...d, area: v }))} />

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.ink }]}>{t('filters.photosOnly')}</Text>
              <Switch
                value={draft.photosOnly}
                onValueChange={(v) => {
                  haptic.selection();
                  setDraft((d) => ({ ...d, photosOnly: v }));
                }}
                trackColor={{ true: colors.accent, false: colors.hairlineStrong }}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button title={t('filters.clear')} variant="secondary" fullWidth={false} onPress={() => setDraft(EMPTY_FILTERS)} style={{ flex: 1 }} />
            <Button title={t('filters.show')} fullWidth={false} onPress={() => onApply(draft)} style={{ flex: 1 }} />
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, paddingVertical: spacing.xs },
  switchLabel: { fontFamily: font.bodyMedium, fontSize: type.base, flex: 1, paddingRight: spacing.md },
  footer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
