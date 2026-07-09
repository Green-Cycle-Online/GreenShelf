import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../theme/theme';
import { font, spacing, type } from '../theme/tokens';

// Thin bar under the status bar when the device drops offline, so listings that
// fail to load have an obvious cause instead of looking broken.
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return () => unsub();
  }, []);

  if (!offline) return null;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6, backgroundColor: colors.ink }]}>
      <Text style={[styles.text, { color: colors.paper }]}>
        You are offline. Showing what we have.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  text: {
    fontFamily: font.bodyMedium,
    fontSize: type.sm,
  },
});
