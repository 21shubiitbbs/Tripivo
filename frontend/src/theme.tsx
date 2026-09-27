import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { getItem, setItem } from './lib/storage';

// Shared palette for every screen. Screens build their styles with `makeStyles`, so switching
// between light and dark (Settings → Dark mode) restyles the whole app.

const light = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F8',
  border: '#E3E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  primary: '#1D6AE5',
  primaryPressed: '#1557C4',
  primarySoft: '#E6EFFD',
  onPrimary: '#FFFFFF',
  success: '#16A34A',
  danger: '#EF4444',
  dangerSoft: '#FDECEC',
  warning: '#F59E0B',
  warningSoft: '#FEF3E2',
  star: '#F5A623',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export type Colors = typeof light;

const dark: Colors = {
  background: '#0B1424',
  surface: '#131F33',
  surfaceAlt: '#1B2940',
  border: '#24344F',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  primary: '#3B82F6',
  primaryPressed: '#2563EB',
  primarySoft: '#1E3558',
  onPrimary: '#FFFFFF',
  success: '#22C55E',
  danger: '#F87171',
  dangerSoft: '#3A1E24',
  warning: '#FBBF24',
  warningSoft: '#3A2E17',
  star: '#FBBF24',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export type ThemePreference = 'system' | 'light' | 'dark';

type Theme = {
  colors: Colors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const PREFERENCE_KEY = 'tripivo.theme';

const ThemeContext = createContext<Theme>({
  colors: light,
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getItem(PREFERENCE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const theme = useMemo<Theme>(() => {
    const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
    return {
      colors: isDark ? dark : light,
      isDark,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        void setItem(PREFERENCE_KEY, next);
      },
    };
  }, [preference, systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Like `StyleSheet.create`, but the styles are rebuilt from the current theme's colors. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Colors) => T,
) {
  return function useStyles() {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

/** Content never stretches wider than this, so screens also look right on tablet and web. */
export const MAX_CONTENT_WIDTH = 560;
