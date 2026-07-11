import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import {
  BASE_SUBJECTS,
  GRADES,
  CONDITIONS,
  CONTACT_METHODS,
  AREAS_MUSCAT,
  AREAS_OTHER_OMAN,
  MAX_PHOTOS,
} from '../lib/constants';
import { Option, Select } from '../components/Select';
import { Button } from '../components/Button';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { haptic } from '../lib/haptics';
import { fetchListingById, insertListing, updateListing, uploadPhoto } from '../lib/api';
import { loadPosterDefaults, savePosterDefaults } from '../lib/posterDefaults';
import { ContactMethod } from '../lib/types';

interface PhotoSlot {
  uri: string;
  remote: boolean; // already an https URL (edit mode)
}

const OTHER = 'Other';

export default function CreateModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!params.editId;

  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [area, setArea] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [school, setSchool] = useState('');
  const [condition, setCondition] = useState('');
  const [description, setDescription] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactMethod>('whatsapp');
  const [contactValue, setContactValue] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(isEditing);

  // Prefill from profile (new listing) or from the existing listing (edit).
  useEffect(() => {
    if (isEditing) {
      fetchListingById(params.editId!)
        .then((l) => {
          if (!l) return;
          setTitle(l.title);
          if (BASE_SUBJECTS.includes(l.subject)) setSubject(l.subject);
          else {
            setSubject(OTHER);
            setCustomSubject(l.subject);
          }
          setGrade(l.grade_level);
          const allAreas = [...AREAS_MUSCAT, ...AREAS_OTHER_OMAN];
          if (l.area && allAreas.includes(l.area)) setArea(l.area);
          else if (l.area) {
            setArea(OTHER);
            setCustomArea(l.area);
          }
          setSchool(l.school || '');
          setCondition(l.condition);
          setDescription(l.description || '');
          setOwnerName(l.owner_name);
          setContactMethod(l.contact_method);
          setContactValue(l.contact_value);
          setPhotos((l.photos || []).map((uri) => ({ uri, remote: true })));
        })
        .finally(() => setLoadingEdit(false));
    } else {
      // Saved poster defaults fill name/contact/area/school; anything the user
      // already typed in this session wins, then profile as a last fallback.
      loadPosterDefaults().then((d) => {
        setOwnerName((prev) => prev || d.owner_name || profile?.full_name || '');
        setSchool((prev) => prev || d.school || profile?.school || '');
        if (d.contact_method) setContactMethod((prev) => (prev === 'whatsapp' ? d.contact_method! : prev));
        setContactValue((prev) => prev || d.contact_value || '');
        if (d.area) {
          const allAreas = [...AREAS_MUSCAT, ...AREAS_OTHER_OMAN];
          setArea((prev) => prev || (allAreas.includes(d.area!) ? d.area! : OTHER));
          if (!allAreas.includes(d.area)) setCustomArea((prev) => prev || d.area!);
        }
      });
    }
  }, [isEditing, profile?.full_name]);

  const subjectOptions: Option[] = [...BASE_SUBJECTS, OTHER].map((s) => ({ label: s, value: s }));
  const gradeOptions: Option[] = GRADES.map((g) => ({ label: g, value: g }));
  const conditionOptions: Option[] = CONDITIONS.map((c) => ({ label: c.label, value: c.value }));
  const contactOptions: Option[] = CONTACT_METHODS.map((c) => ({ label: c.label, value: c.value }));
  const areaOptions: Option[] = [
    ...AREAS_MUSCAT.map((a) => ({ label: a, value: a, group: 'Muscat' })),
    ...AREAS_OTHER_OMAN.map((a) => ({ label: a, value: a, group: 'Outside Muscat' })),
    { label: 'Other', value: OTHER, group: 'Outside Muscat' },
  ];

  async function pickFrom(source: 'camera' | 'library') {
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast('Camera permission is needed to take a photo.', 'info');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
        });
      }
      if (!result.canceled && result.assets?.[0]) {
        haptic.light();
        setPhotos((p) => [...p, { uri: result.assets[0].uri, remote: false }].slice(0, MAX_PHOTOS));
      }
    } catch {
      toast('Could not open the photo picker.', 'error');
    }
  }

  function addPhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take Photo', 'Choose from Library', 'Cancel'], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) pickFrom('camera');
          else if (i === 1) pickFrom('library');
        },
      );
    } else {
      Alert.alert('Add a photo', undefined, [
        { text: 'Take Photo', onPress: () => pickFrom('camera') },
        { text: 'Choose from Library', onPress: () => pickFrom('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function validate(): string | null {
    if (!title.trim()) return 'Add the book title.';
    if (!subject) return 'Choose a subject.';
    if (subject === OTHER && !customSubject.trim()) return 'Specify the subject.';
    if (!grade) return 'Choose a grade.';
    if (!area) return 'Choose a pickup area.';
    if (area === OTHER && !customArea.trim()) return 'Specify the area.';
    if (!condition) return 'Choose a condition.';
    if (!ownerName.trim()) return 'Add your name.';
    if (!contactValue.trim()) return 'Add your contact details.';
    if (contactMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue.trim()))
      return "That email address does not look right.";
    if (
      (contactMethod === 'phone' || contactMethod === 'whatsapp') &&
      !/^\+?[0-9 ()-]{7,20}$/.test(contactValue.trim())
    )
      return 'That number does not look right. Include the 968 country code.';
    return null;
  }

  async function submit() {
    setError('');
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    // Guest path: not signed in. Keep the filled form, send them to sign up, and
    // come back to this same (still-mounted) modal to post.
    if (!user) {
      router.push('/auth?pending=1');
      return;
    }

    setBusy(true);
    try {
      const finalSubject = subject === OTHER ? customSubject.trim() : subject;
      const finalArea = area === OTHER ? customArea.trim() : area;

      // Upload any local photos, keep existing remote URLs as-is.
      const urls: string[] = [];
      for (const slot of photos) {
        if (slot.remote) urls.push(slot.uri);
        else urls.push(await uploadPhoto(slot.uri, user.id));
      }

      const draft = {
        title: title.trim(),
        subject: finalSubject,
        grade_level: grade,
        area: finalArea,
        school: school.trim() || null,
        condition: condition as any,
        description: description.trim() || null,
        owner_name: ownerName.trim(),
        contact_method: contactMethod,
        contact_value: contactValue.trim(),
        photos: urls.length ? urls : null,
      };

      if (isEditing) await updateListing(params.editId!, draft);
      else await insertListing(draft, user.id);

      // Posted successfully: remember these details for the next listing.
      savePosterDefaults({
        owner_name: draft.owner_name,
        contact_method: draft.contact_method,
        contact_value: draft.contact_value,
        area: draft.area,
        school: draft.school || undefined,
      });

      haptic.success();
      await refreshProfile();
      toast(isEditing ? 'Listing updated.' : 'Posted. Your book is live', 'success');
      router.back();
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again?');
      haptic.error();
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = isEditing ? 'Save changes' : user ? 'Post listing' : 'Continue to create account';

  if (loadingEdit) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: isEditing ? 'Edit listing' : 'List a book' }} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.intro, { color: colors.inkSoft }]}>
          {isEditing
            ? 'Update the details below.'
            : user
              ? 'Pass it on to another student. No money, no fuss.'
              : 'Fill this in, then create a quick account to publish.'}
        </Text>

        {/* Photos */}
        <Text style={[styles.label, { color: colors.inkSoft }]}>Photos (optional, up to {MAX_PHOTOS})</Text>
        <View style={styles.photoGrid}>
          {photos.map((p, i) => (
            <View key={`${i}-${p.uri}`} style={styles.photoSlot}>
              <Image source={{ uri: p.uri }} style={styles.photoImg} />
              <Pressable
                onPress={() => setPhotos((arr) => arr.filter((_, idx) => idx !== i))}
                style={styles.photoRemove}
                hitSlop={6}
                accessibilityLabel={`Remove photo ${i + 1}`}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable
              onPress={addPhoto}
              style={[styles.photoAdd, { borderColor: colors.hairlineStrong, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
            >
              <Ionicons name="camera-outline" size={24} color={colors.inkSoft} />
              <Text style={[styles.photoAddText, { color: colors.inkSoft }]}>Add photo</Text>
            </Pressable>
          )}
        </View>

        <Field label="Book title" required>
          <Input value={title} onChangeText={setTitle} placeholder="e.g. Grade 9 Math textbook" maxLength={120} />
        </Field>

        <Select label="Subject" value={subject} options={subjectOptions} onChange={setSubject} required />
        {subject === OTHER && (
          <Field label="Specify subject" required>
            <Input value={customSubject} onChangeText={setCustomSubject} placeholder="e.g. Geography" maxLength={60} />
          </Field>
        )}

        <Select label="Grade" value={grade} options={gradeOptions} onChange={setGrade} required />

        <Select label="Pickup area" value={area} options={areaOptions} onChange={setArea} required />
        {area === OTHER && (
          <Field label="Specify area" required>
            <Input value={customArea} onChangeText={setCustomArea} placeholder="Area only, not your address" maxLength={60} />
          </Field>
        )}
        <Text style={[styles.hint, { color: colors.inkFaint }]}>
          Just the general area, please. Never share your full address.
        </Text>

        <Field label="School (optional)">
          <Input value={school} onChangeText={setSchool} placeholder="e.g. British School Muscat" maxLength={120} />
        </Field>

        <Select label="Condition" value={condition} options={conditionOptions} onChange={setCondition} required />

        <Field label="About this book (optional)">
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Highlighting, missing pages, etc."
            maxLength={500}
            multiline
          />
        </Field>

        <Field label="Your name (shown on the listing)" required>
          <Input value={ownerName} onChangeText={setOwnerName} placeholder="What should we call you?" maxLength={60} />
        </Field>

        <Select
          label="Contact via"
          value={contactMethod}
          options={contactOptions}
          onChange={(v) => setContactMethod(v as ContactMethod)}
          required
        />
        <Field label="Contact details" required>
          <Input
            value={contactValue}
            onChangeText={setContactValue}
            placeholder="96891234567"
            maxLength={60}
            keyboardType={contactMethod === 'email' ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
          />
        </Field>
        <Text style={[styles.hint, { color: colors.inkFaint }]}>
          Shown on your listing so people can reach you. For phone or WhatsApp, include the 968 country code.
        </Text>

        {!!error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        <Button title={submitLabel} onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>
        {label}
        {required ? ' *' : ''}
      </Text>
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
  hint: { fontFamily: font.body, fontSize: type.xs, marginTop: -spacing.xs, marginBottom: spacing.md, lineHeight: type.xs * 1.5 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
    fontFamily: font.body,
    fontSize: type.base,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  photoSlot: { width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddText: { fontFamily: font.bodyMedium, fontSize: type.xs },
  error: { fontFamily: font.bodyMedium, fontSize: type.sm, marginTop: spacing.md },
});
