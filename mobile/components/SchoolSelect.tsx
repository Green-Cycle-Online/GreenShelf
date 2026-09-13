import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { Option, Select } from './Select';
import { useSchools } from '../lib/useSchools';
import { useI18n } from '../lib/i18n';

export const OTHER_SCHOOL = '__other__';
export const NO_SCHOOL = '';

// Picks a school from the admin-managed list, with an "Other" escape hatch that
// reveals a free-text box. Emits both the id (for new clients and filters) and
// the plain name (kept in `listings.school` for older builds and the website).
export function SchoolSelect({
  label,
  schoolId,
  schoolName,
  onChange,
  required = false,
  allowNone = true,
}: {
  label: string;
  schoolId: string | null;
  schoolName: string;
  onChange: (next: { school_id: string | null; school: string }) => void;
  required?: boolean;
  allowNone?: boolean;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { active } = useSchools();

  // A name from an older row that is not on the list shows as "Other" with the
  // text prefilled, so editing never silently drops the school.
  const matched = useMemo(
    () => (schoolId ? active.find((s) => s.id === schoolId) : active.find((s) => s.name === schoolName)),
    [active, schoolId, schoolName],
  );
  const selectValue = matched ? matched.id : schoolName ? OTHER_SCHOOL : NO_SCHOOL;

  const options: Option[] = [
    ...(allowNone ? [{ label: t('schools.none'), value: NO_SCHOOL }] : []),
    ...active.map((s) => ({ label: s.name, value: s.id, group: s.area || undefined })),
    { label: t('schools.other'), value: OTHER_SCHOOL },
  ];

  return (
    <View>
      <Select
        label={label}
        value={selectValue}
        placeholder={t('schools.choose')}
        options={options}
        required={required}
        onChange={(v) => {
          if (v === NO_SCHOOL) onChange({ school_id: null, school: '' });
          else if (v === OTHER_SCHOOL) onChange({ school_id: null, school: matched ? '' : schoolName });
          else {
            const s = active.find((x) => x.id === v);
            onChange({ school_id: v, school: s ? s.name : '' });
          }
        }}
      />
      {selectValue === OTHER_SCHOOL && (
        <View style={{ marginTop: -spacing.xs, marginBottom: spacing.md }}>
          <Text style={[styles.label, { color: colors.inkSoft }]}>{t('create.otherSchool')}</Text>
          <TextInput
            value={schoolName}
            onChangeText={(txt) => onChange({ school_id: null, school: txt })}
            placeholder="e.g. British School Muscat"
            placeholderTextColor={colors.inkFaint}
            maxLength={120}
            style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.hairline }]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.bodySemi, fontSize: type.sm, marginBottom: spacing.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
    fontFamily: font.body,
    fontSize: type.base,
  },
});
