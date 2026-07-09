import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, Palette, ThemeName } from './tokens';

// "system" follows the OS; "light"/"dark" are manual overrides. Mirrors the
// website's data-theme toggle, but defaults to following the device.
export type ThemePref = 'system' | ThemeName;

const STORAGE_KEY = 'gs-theme-pref';

interface ThemeCtx {
  scheme: ThemeName;
  colors: Palette;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  reduceMotion: boolean;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduceMotion(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  };

  const scheme: ThemeName = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  const value = useMemo<ThemeCtx>(
    () => ({ scheme, colors: palettes[scheme], pref, setPref, reduceMotion }),
    [scheme, pref, reduceMotion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
