import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { Option, Select } from '../components/Select';
import { CategoryToggle } from '../components/CategoryToggle';
import { SchoolSelect } from '../components/SchoolSelect';
import { AGE_BANDS, AREAS_MUSCAT, AREAS_OTHER_OMAN, BASE_SUBJECTS, GENRES, GRADES } from '../lib/constants';
import { insertRequest } from '../lib/api';
import { Category } from '../lib/types';
import { loadPosterDefaults } from '../lib/posterDefaults';
import { findObjectionable } from '../lib/moderation';
import { haptic } from '../lib/haptics';

export default function CreateRequestModal() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [category, setCategory] = useState<Category>('school');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [area, setArea] = useState('');
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPosterDefaults().then((d) => {
      setName((n) => n || d.owner_name || profile?.full_name || '');
      setArea((a) => a || d.area || '');
      setSchoolName((s) => s || d.school || profile?.school || '');
    });
  }, [profile?.full_name]);

  const isReading = category === 'reading';
  const subjectOptions: Option[] = [{ label: t('common.all'), value: '' }, ...(isReading ? GENRES : BASE_SUBJECTS).map((s) => ({ label: s, value: s }))];
  const levelOptions: Option[] = [{ label: t('common.all'), value: '' }, ...(isReading ? AGE_BANDS : GRADES).map((g) => ({ label: g, value: g }))];
  const areaOptions: Option[] = [
    { label: t('common.all'), value: '' },
    ...AREAS_MUSCAT.map((a) => ({ label: a, value: a, group: 'Muscat' })),
    ...AREAS_OTHER_OMAN.map((a) => ({ label: a, value: a, group: 'Outside Muscat' })),
  ];

  async function submit() {
    setError('');
    if (!title.trim()) return setError(t('request.needTitle'));
    if (!name.trim()) return setError(t('request.needName'));
    if (findObjectionable(title, note, subject, schoolName)) {
      return setError('Please remove inappropriate language before posting.');
    }
    if (!user) {
      toast(t('request.signIn'), 'info');
      router.push('/auth');
      return;
    }
    setBusy(true);
    try {
      await insertRequest(
        {
          title: title.trim(),
          category,
          subject: subject || null,
          grade_level: grade || null,
          area: area || null,
          school_id: isReading ? null : schoolId,
          school: isReading ? null : schoolName.trim() || null,
          note: note.trim() || null,
          requester_name: name.trim(),
        },
        user.id,
      );
      haptic.success();
      toast(t('request.posted'), 'success');
      router.back();
    } catch (e: any) {
      setError(e.message || t('common.error'));
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('request.title') }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.inkSoft }]}>{t('request.intro')}</Text>

        <Text style={[styles.label, { color: colors.inkSoft }]}>{t('create.category')}</Text>
        <View style={{ marginBottom: spacing.md }}>
          <CategoryToggle value={category} onChange={(c) => { setCategory(c); setSubject(''); setGrade(''); }} />
        </View>

        <Field label={t('request.bookTitle')} required>
          <Input value={title} onChangeText={setTitle} placeholder="e.g. Grade 9 Physics, Cambridge" maxLength={120} />
        </Field>

        <Select label={isReading ? t('create.genre') : t('filters.subject')} value={subject} options={subjectOptions} onChange={setSubject} />
        <Select label={isReading ? t('create.ageBand') : t('filters.grade')} value={grade} options={levelOptions} onChange={setGrade} />
        <Select label={t('filters.area')} value={area} options={areaOptions} onChange={setArea} />
        {!isReading && (
          <SchoolSelect
            label={t('create.school')}
            schoolId={schoolId}
            schoolName={schoolName}
            onChange={({ school_id, school }) => { setSchoolId(school_id); setSchoolName(school); }}
          />
        )}

        <Field label={t('request.note')}>
          <Input value={note} onChangeText={setNote} placeholder={t('request.notePlaceholder')} maxLength={300} multiline />
        </Field>

        <Field label={t('request.yourName')} required>
          <Input value={name} onChangeText={setName} maxLength={60} />
        </Field>

        {!!error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
        <Button title={user ? t('request.submit') : t('common.signIn')} onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput> & { multiline?: boolean }) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      {...props}
      style={[
        styles.input,
        props.multiline && { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
        { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.hairline },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: font.body, fontSize: type.base, marginBottom: spacing.lg, lineHeight: type.base * 1.4 },
  label: { fontFamily: font.bodySemi, fontSize: type.sm, marginBottom: spacing.xs },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50, fontFamily: font.body, fontSize: type.base },
  error: { fontFamily: font.bodyMedium, fontSize: type.sm, marginTop: spacing.md },
});
