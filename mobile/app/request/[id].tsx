import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { font, radius, spacing, type } from '../../theme/tokens';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { Tag } from '../../components/Tag';
import { Option, Select } from '../../components/Select';
import { ErrorState } from '../../components/StateViews';
import { BookRequest, ContactMethod, RequestResponse } from '../../lib/types';
import {
  deleteRequest, fetchRequestById, fetchResponsesForRequest, respondToRequest, setRequestStatus,
} from '../../lib/api';
import { CONTACT_METHODS } from '../../lib/constants';
import { contactLabelFor, formatRelativeTime, getContactLink } from '../../lib/format';
import { loadPosterDefaults, savePosterDefaults } from '../../lib/posterDefaults';
import { haptic } from '../../lib/haptics';

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [request, setRequest] = useState<BookRequest | null>(null);
  const [responses, setResponses] = useState<RequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  const isOwner = !!user && !!request && request.requester_id === user.id;
  const myReply = user ? responses.find((r) => r.responder_id === user.id) : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetchRequestById(id);
      if (!r) {
        setError(true);
        return;
      }
      setRequest(r);
      // RLS returns every reply to the owner, and only their own to a responder.
      if (user) setResponses(await fetchResponsesForRequest(id).catch(() => []));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (error || !request) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <ErrorState onRetry={load} message={t('wanted.notFound')} />
      </View>
    );
  }

  const where = [request.area, request.school].filter(Boolean).join(' · ');
  const fulfilled = request.status === 'fulfilled';

  const toggleStatus = async () => {
    try {
      const next = fulfilled ? 'open' : 'fulfilled';
      await setRequestStatus(request.id, next);
      setRequest({ ...request, status: next });
      haptic.success();
    } catch (e: any) {
      toast(e.message || t('common.error'), 'error');
    }
  };

  const doDelete = () => {
    Alert.alert(t('wanted.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRequest(request.id);
            haptic.success();
            router.back();
          } catch (e: any) {
            toast(e.message || t('common.error'), 'error');
          }
        },
      },
    ]);
  };

  const onReplyPress = () => {
    if (!user) {
      toast(t('wanted.signInToReply'), 'info');
      router.push('/auth');
      return;
    }
    setReplyOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack.Screen options={{ title: t('wanted.title') }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.md }}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{isOwner ? t('wanted.yourRequest') : t('wanted.lookingFor')}</Text>
        <Text style={[styles.title, { color: colors.ink }]}>{request.title}</Text>
        <View style={styles.tags}>
          {fulfilled && <Tag label={t('wanted.fulfilled')} kind="status" />}
          {request.category === 'reading' && <Tag label={t('category.reading')} kind="subject" />}
          {!!request.grade_level && <Tag label={request.grade_level} kind="grade" />}
          {!!request.subject && <Tag label={request.subject} kind="subject" />}
        </View>
        {!!where && <Section label={t('detail.area')} value={where} />}
        {!!request.note && <Section label={t('detail.about')} value={request.note} />}
        <Text style={[styles.meta, { color: colors.inkFaint }]}>
          {t('wanted.postedBy', { name: request.requester_name })} · {formatRelativeTime(request.created_at)}
        </Text>

        {isOwner ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>
              {t('wanted.responses')}{responses.length ? ` (${responses.length})` : ''}
            </Text>
            {responses.length === 0 ? (
              <Text style={[styles.muted, { color: colors.inkSoft }]}>{t('wanted.noResponses')}</Text>
            ) : (
              responses.map((r) => <ResponseCard key={r.id} response={r} />)
            )}
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button title={fulfilled ? t('wanted.reopen') : t('wanted.markFound')} variant="secondary" onPress={toggleStatus} />
              <Button title={t('wanted.delete')} variant="danger" onPress={doDelete} />
            </View>
          </>
        ) : myReply ? (
          <View style={[styles.repliedCard, { backgroundColor: colors.accentTint }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            <Text style={[styles.repliedText, { color: colors.accent }]}>{t('wanted.youResponded')}</Text>
          </View>
        ) : (
          !fulfilled && <Button title={t('wanted.iHaveThis')} onPress={onReplyPress} style={{ marginTop: spacing.md }} />
        )}
      </ScrollView>

      {user && (
        <ReplySheet
          visible={replyOpen}
          onClose={() => setReplyOpen(false)}
          defaults={{ name: profile?.full_name || '' }}
          onSubmit={async (name, method, value, message) => {
            try {
              await respondToRequest(request.id, user.id, name, method, value, message);
              savePosterDefaults({ owner_name: name, contact_method: method, contact_value: value });
              setReplyOpen(false);
              haptic.success();
              toast(t('wanted.responded'), 'success');
              load();
            } catch (e: any) {
              toast(e.message || t('common.error'), 'error');
            }
          }}
        />
      )}
    </View>
  );
}

function ResponseCard({ response }: { response: RequestResponse }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { t } = useI18n();
  const method = (response.contact_method || 'whatsapp') as ContactMethod;
  const link = response.contact_value ? getContactLink(method, response.contact_value) : null;
  return (
    <View style={[styles.responseCard, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      <Text style={[styles.responderName, { color: colors.ink }]}>{response.responder_name}</Text>
      {!!response.message && <Text style={[styles.responseMsg, { color: colors.inkSoft }]}>{response.message}</Text>}
      {link && (
        <Pressable
          onPress={async () => {
            haptic.medium();
            try {
              if (await Linking.canOpenURL(link)) Linking.openURL(link);
              else toast(t('common.error'), 'error');
            } catch {
              toast(t('common.error'), 'error');
            }
          }}
          style={[styles.contactBtn, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
        >
          <Ionicons name={method === 'whatsapp' ? 'logo-whatsapp' : method === 'phone' ? 'call' : 'mail'} size={16} color={colors.onAccent} />
          <Text style={[styles.contactBtnText, { color: colors.onAccent }]}>{contactLabelFor(method)} {response.contact_value}</Text>
        </Pressable>
      )}
      <Text style={[styles.meta, { color: colors.inkFaint }]}>{formatRelativeTime(response.created_at)}</Text>
    </View>
  );
}

function ReplySheet({
  visible,
  onClose,
  defaults,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  defaults: { name: string };
  onSubmit: (name: string, method: ContactMethod, value: string, message: string | null) => Promise<void>;
}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(defaults.name);
  const [method, setMethod] = useState<ContactMethod>('whatsapp');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    loadPosterDefaults().then((d) => {
      setName((n) => n || d.owner_name || defaults.name);
      if (d.contact_method) setMethod(d.contact_method);
      setValue((v) => v || d.contact_value || '');
    });
  }, [visible]);

  const contactOptions: Option[] = CONTACT_METHODS.map((c) => ({ label: c.label, value: c.value }));

  const submit = async () => {
    setErr('');
    if (!name.trim()) return setErr(t('request.needName'));
    if (!value.trim()) return setErr(t('common.error'));
    setBusy(true);
    try {
      await onSubmit(name.trim(), method, value.trim(), message.trim() || null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('reply.title')}</Text>
          <Text style={[styles.muted, { color: colors.inkSoft }]}>{t('reply.intro')}</Text>
          <Text style={[styles.label, { color: colors.inkSoft }]}>{t('request.yourName')} *</Text>
          <TextInput value={name} onChangeText={setName} maxLength={60} placeholderTextColor={colors.inkFaint}
            style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.hairline }]} />
          <Select label={t('detail.contact')} value={method} options={contactOptions} onChange={(v) => setMethod(v as ContactMethod)} required />
          <TextInput value={value} onChangeText={setValue} placeholder="96891234567" maxLength={60} placeholderTextColor={colors.inkFaint}
            keyboardType={method === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none"
            style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.hairline }]} />
          <Text style={[styles.label, { color: colors.inkSoft }]}>{t('reply.message')}</Text>
          <TextInput value={message} onChangeText={setMessage} maxLength={300} multiline placeholderTextColor={colors.inkFaint}
            style={[styles.input, styles.multiline, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.hairline }]} />
          {!!err && <Text style={[styles.error, { color: colors.error }]}>{err}</Text>}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <Button title={t('common.cancel')} variant="secondary" fullWidth={false} onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('reply.send')} fullWidth={false} onPress={submit} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.sectionLabel, { color: colors.inkFaint }]}>{label}</Text>
      <Text style={[styles.sectionValue, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: font.bodySemi, fontSize: type.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontFamily: font.displayBold, fontSize: type.xxl, lineHeight: type.xxl * 1.1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionLabel: { fontFamily: font.bodySemi, fontSize: type.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionValue: { fontFamily: font.body, fontSize: type.md, lineHeight: type.md * 1.45 },
  meta: { fontFamily: font.body, fontSize: type.xs },
  sectionTitle: { fontFamily: font.displayBold, fontSize: type.lg, marginTop: spacing.lg },
  muted: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.45 },
  repliedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, marginTop: spacing.md },
  repliedText: { fontFamily: font.bodySemi, fontSize: type.base, flex: 1 },
  responseCard: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm, marginTop: spacing.sm },
  responderName: { fontFamily: font.displayBold, fontSize: type.md },
  responseMsg: { fontFamily: font.body, fontSize: type.base, lineHeight: type.base * 1.45 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 44, borderRadius: radius.pill },
  contactBtnText: { fontFamily: font.bodySemi, fontSize: type.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.xs },
  sheetTitle: { fontFamily: font.displayBold, fontSize: type.xl, marginBottom: spacing.xs },
  label: { fontFamily: font.bodySemi, fontSize: type.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50, fontFamily: font.body, fontSize: type.base },
  multiline: { height: 80, paddingTop: spacing.md, textAlignVertical: 'top' },
  error: { fontFamily: font.bodyMedium, fontSize: type.sm, marginTop: spacing.sm },
});
