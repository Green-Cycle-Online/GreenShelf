import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';
import { haptic } from '../lib/haptics';

export interface Option {
  label: string;
  value: string;
  group?: string;
}

// A tappable field that opens a native modal list. Groups render as section
// headers (used for Muscat vs outside-Muscat areas).
export function Select({
  label,
  value,
  placeholder = 'Choose...',
  options,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  placeholder?: string;
  options: Option[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <Pressable
        onPress={() => {
          haptic.selection();
          setOpen(true);
        }}
        style={[styles.control, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selectedLabel || placeholder}`}
      >
        <Text style={[styles.controlText, { color: selectedLabel ? colors.ink : colors.inkFaint }]}>
          {selectedLabel || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.inkFaint} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handleRow}>
              <View style={[styles.grabber, { backgroundColor: colors.hairlineStrong }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: colors.ink }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              style={{ maxHeight: 420 }}
              renderItem={({ item, index }) => {
                const showGroup = item.group && item.group !== options[index - 1]?.group;
                const selected = item.value === value;
                return (
                  <>
                    {showGroup && (
                      <Text style={[styles.group, { color: colors.inkFaint }]}>{item.group}</Text>
                    )}
                    <Pressable
                      onPress={() => {
                        haptic.selection();
                        onChange(item.value);
                        setOpen(false);
                      }}
                      style={[styles.option, { borderBottomColor: colors.hairline }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.optionText, { color: colors.ink, fontFamily: selected ? font.bodySemi : font.body }]}>
                        {item.label}
                      </Text>
                      {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                    </Pressable>
                  </>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontFamily: font.bodySemi, fontSize: type.sm, marginBottom: spacing.xs },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
  },
  controlText: { fontFamily: font.body, fontSize: type.base },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing.lg },
  handleRow: { alignItems: 'center', paddingVertical: spacing.sm },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  sheetTitle: { fontFamily: font.displayBold, fontSize: type.lg, marginBottom: spacing.sm },
  group: {
    fontFamily: font.bodySemi,
    fontSize: type.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  optionText: { fontSize: type.base },
});
