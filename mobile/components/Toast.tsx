import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';
import { font, radius, spacing, type } from '../theme/tokens';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  message: string;
  type: ToastType;
}

const Ctx = createContext<(message: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;
  const insets = useSafeAreaInsets();
  const { colors, reduceMotion } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, t: ToastType = 'info') => {
      setToast({ message, type: t });
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 0 : 200, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: reduceMotion ? 0 : 220, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: reduceMotion ? 0 : 200, useNativeDriver: true }),
        Animated.timing(translate, { toValue: 20, duration: reduceMotion ? 0 : 200, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  const bg =
    toast?.type === 'success' ? colors.accent : toast?.type === 'error' ? colors.error : colors.ink;
  const fg =
    toast?.type === 'success' ? colors.onAccent : toast?.type === 'error' ? '#fff' : colors.paper;

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.wrap,
            { bottom: insets.bottom + 90, opacity, transform: [{ translateY: translate }] },
          ]}
        >
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  toast: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: {
    fontFamily: font.bodyMedium,
    fontSize: type.base,
    textAlign: 'center',
  },
});
