import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

// This tab is an action, not a screen: the tab bar intercepts the press and opens
// the create modal. If it ever gets focus directly (deep link), bounce to the modal.
export default function CreateTabRedirect() {
  useFocusEffect(
    React.useCallback(() => {
      router.replace('/');
      router.push('/create-listing');
    }, []),
  );
  return <View />;
}
