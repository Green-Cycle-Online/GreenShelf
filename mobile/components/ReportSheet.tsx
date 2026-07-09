import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { REPORT_REASONS } from '../lib/constants';
import { Button } from './Button';
import { haptic } from '../lib/haptics';

export function ReportSheet({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, notes: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await onSubmit(reason, notes.trim());
      setReason('');
      setNotes('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle}>
            <View style={[styles.grabber, { backgroundColor: colors.hairlineStrong }]} />
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>Report this listing</Text>
          <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
            Tell us what is wrong. An admin will review it within 24 hours.
          </Text>

          <View style={styles.reasons}>
            {REPORT_REASONS.map((r) => {
              const selected = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => {
                    haptic.selection();
                    setReason(r.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.reason,
                    { borderColor: selected ? colors.accent : colors.hairline, backgroundColor: selected ? colors.accentTint : colors.surface },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? colors.accent : colors.inkFaint}
                  />
                  <Text style={[styles.reasonText, { color: colors.ink }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={500}
            style={[styles.notes, { backgroundColor: colors.surface, color: colors.ink, borderColor: colors.hairline }]}
          />

          <Button title="Submit report" onPress={submit} loading={busy} disabled={!reason} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg },
  handle: { alignItems: 'center', paddingVertical: spacing.sm },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  title: { fontFamily: font.displayBold, fontSize: type.xl, marginTop: spacing.sm },
  subtitle: { fontFamily: font.body, fontSize: type.base, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: type.base * 1.4 },
  reasons: { gap: spacing.sm },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  reasonText: { fontFamily: font.bodyMedium, fontSize: type.base },
  notes: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    minHeight: 80,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    fontFamily: font.body,
    fontSize: type.base,
    textAlignVertical: 'top',
  },
});
