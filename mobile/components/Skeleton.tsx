import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { radius, spacing } from '../theme/tokens';

// Shimmering placeholder card, shown while the first listings load (matches the
// website's skeleton-card). Pulse is disabled under reduce-motion.
export function SkeletonCard({ width }: { width: number }) {
  const { colors, reduceMotion } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);

  const block = (style: object) => (
    <Animated.View style={[style, { backgroundColor: colors.surface2, opacity: reduceMotion ? 0.6 : pulse }]} />
  );

  return (
    <View style={[styles.card, { width, backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      {block(styles.image)}
      <View style={styles.body}>
        {block(styles.lineTitle)}
        {block(styles.lineShort)}
        <View style={styles.tags}>
          {block(styles.tag)}
          {block(styles.tag)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { aspectRatio: 3 / 4, width: '100%' },
  body: { padding: spacing.md, gap: spacing.sm },
  lineTitle: { height: 14, borderRadius: 4, width: '85%' },
  lineShort: { height: 12, borderRadius: 4, width: '55%' },
  tags: { flexDirection: 'row', gap: spacing.xs, marginTop: 2 },
  tag: { height: 18, width: 52, borderRadius: radius.pill },
});
