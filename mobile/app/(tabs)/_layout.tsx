import React from 'react';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { font } from '../../theme/tokens';
import { haptic } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';

// Tab screens have no header, so scrolled content slides under the transparent
// status bar and clashes with the clock. A near-opaque paper scrim gives the
// bar a floor without hiding what passes beneath it.
function StatusBarScrim() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: colors.paper,
        opacity: 0.92,
        zIndex: 10,
      }}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.hairline,
        },
        tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.browse'),
          tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wanted"
        options={{
          title: t('tabs.wanted'),
          tabBarIcon: ({ color, size }) => <Ionicons name="hand-left-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.list'),
          tabBarIcon: ({ size }) => (
            <Ionicons name="add-circle" size={size + 8} color={colors.accent} />
          ),
        }}
        listeners={{
          // This tab is an action, not a destination: open the create modal.
          tabPress: (e) => {
            e.preventDefault();
            haptic.light();
            router.push('/create-listing');
          },
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: t('tabs.saved'),
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
    <StatusBarScrim />
    </View>
  );
}
