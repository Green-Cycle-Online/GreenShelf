import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { Leaf } from '../components/Logo';
import { haptic } from '../lib/haptics';

type Mode = 'signin' | 'signup' | 'forgot';

export default function AuthModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, resetPassword } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ pending?: string }>();
  const pending = params.pending === '1';

  const [mode, setMode] = useState<Mode>(pending ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const title =
    mode === 'forgot'
      ? 'Reset your password'
      : pending
        ? 'Almost there'
        : 'Welcome to GreenShelf';
  const subtitle =
    mode === 'forgot'
      ? 'We will email you a link to set a new password.'
      : pending
        ? 'Create a quick account to publish your listing. We saved everything you typed.'
        : 'Sign in or create an account to share books.';

  const submit = async () => {
    setError('');
    const em = email.trim();
    if (!em) {
      setError('Enter your email.');
      return;
    }
    if (mode !== 'forgot' && password.length < 6) {
      setError('Password needs to be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(em, password);
        haptic.success();
        toast('Welcome back', 'success');
        router.back();
      } else if (mode === 'signup') {
        const { needsConfirm } = await signUp(em, password);
        haptic.success();
        if (needsConfirm) {
          toast('Check your inbox to verify your email.', 'success');
        } else {
          toast('Welcome to GreenShelf', 'success');
        }
        router.back();
      } else {
        await resetPassword(em);
        toast('Check your inbox for a reset link.', 'success');
        setMode('signin');
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Try again?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.close}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={26} color={colors.inkSoft} />
        </Pressable>

        <View style={styles.brand}>
          <Leaf size={40} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{subtitle}</Text>

        {mode !== 'forgot' && (
          <View style={[styles.tabs, { backgroundColor: colors.surface2 }]}>
            {(['signin', 'signup'] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    haptic.selection();
                    setMode(m);
                    setError('');
                  }}
                  style={[styles.tab, active && { backgroundColor: colors.surface }]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.tabText, { color: active ? colors.ink : colors.inkFaint }]}
                  >
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.label, { color: colors.inkSoft }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.inkFaint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[styles.input, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.hairline }]}
        />

        {mode !== 'forgot' && (
          <>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Password</Text>
            <View style={[styles.pwWrap, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                style={[styles.pwInput, { color: colors.ink }]}
              />
              <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={8} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.inkFaint} />
              </Pressable>
            </View>
            {mode === 'signin' && (
              <Pressable onPress={() => { setMode('forgot'); setError(''); }} style={styles.forgot}>
                <Text style={[styles.forgotText, { color: colors.accent }]}>Forgot password?</Text>
              </Pressable>
            )}
          </>
        )}

        {!!error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        <Button
          title={mode === 'forgot' ? 'Send reset link' : mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />

        {mode === 'forgot' && (
          <Pressable onPress={() => { setMode('signin'); setError(''); }} style={styles.back}>
            <Text style={[styles.forgotText, { color: colors.accent }]}>Back to sign in</Text>
          </Pressable>
        )}

        <Text style={[styles.fineprint, { color: colors.inkFaint }]}>
          You do not need an account to browse. Sign in only to list a book.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: 'flex-end', padding: spacing.xs },
  brand: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  title: { fontFamily: font.displayBold, fontSize: type.xxl, textAlign: 'center' },
  subtitle: { fontFamily: font.body, fontSize: type.base, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: type.base * 1.45 },
  tabs: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginBottom: spacing.xl },
  tab: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: 'center' },
  tabText: { fontFamily: font.bodySemi, fontSize: type.sm },
  label: { fontFamily: font.bodySemi, fontSize: type.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
    fontFamily: font.body,
    fontSize: type.base,
  },
  pwWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
  },
  pwInput: { flex: 1, fontFamily: font.body, fontSize: type.base, height: '100%' },
  forgot: { alignSelf: 'flex-end', marginTop: spacing.sm },
  forgotText: { fontFamily: font.bodySemi, fontSize: type.sm },
  back: { alignItems: 'center', marginTop: spacing.lg },
  error: { fontFamily: font.bodyMedium, fontSize: type.sm, marginTop: spacing.md },
  fineprint: { fontFamily: font.body, fontSize: type.xs, textAlign: 'center', marginTop: spacing.xxl, lineHeight: type.xs * 1.5 },
});
