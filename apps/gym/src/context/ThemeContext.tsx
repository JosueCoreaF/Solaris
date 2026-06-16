import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
  accentColor: string;
  setAccentColor: (hex: string) => void;
  resetAccentColor: () => void;
}

export const DEFAULT_ACCENT: Record<Theme, string> = {
  dark: '#c8ff3d',
  light: '#5f8a00',
};

const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  toggleTheme: () => {},
  accentColor: DEFAULT_ACCENT.dark,
  setAccentColor: () => {},
  resetAccentColor: () => {},
});

const THEME_KEY = 'gym_theme';
const ACCENT_KEY = 'gym_accent';

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const m = clean.match(/.{1,2}/g) ?? ['c8', 'ff', '3d'];
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
};

const rgbToHex = ([r, g, b]: number[]) =>
  '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');

const luminance = ([r, g, b]: number[]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

const applyAccent = (hex: string) => {
  const rgb = hexToRgb(hex);
  const root = document.documentElement.style;
  const rgbStr = rgb.join(', ');
  root.setProperty('--accent', hex);
  root.setProperty('--accent-rgb', rgbStr);
  root.setProperty('--accent-ink', luminance(rgb) > 0.55 ? '#0a0c0f' : '#ffffff');
  root.setProperty('--accent-strong', rgbToHex(rgb.map(c => c * 0.86)));
  root.setProperty('--accent-bg', `rgba(${rgbStr}, 0.10)`);
  root.setProperty('--accent-border', `rgba(${rgbStr}, 0.28)`);
  root.setProperty('--sidebar-item-active', `linear-gradient(90deg, rgba(${rgbStr}, 0.14), rgba(${rgbStr}, 0.02))`);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT[theme];
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    if (!localStorage.getItem(ACCENT_KEY)) {
      setAccentColorState(DEFAULT_ACCENT[theme]);
    }
  }, [theme]);

  useEffect(() => {
    applyAccent(accentColor);
  }, [accentColor]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const setAccentColor = (hex: string) => {
    setAccentColorState(hex);
    localStorage.setItem(ACCENT_KEY, hex);
  };

  const resetAccentColor = () => {
    const fallback = DEFAULT_ACCENT[theme];
    setAccentColorState(fallback);
    localStorage.removeItem(ACCENT_KEY);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor, resetAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
