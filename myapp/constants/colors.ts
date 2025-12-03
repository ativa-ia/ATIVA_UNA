/**
 * Design System - Colors
 * Paleta de cores do Assistente 360
 */

export const colors = {
  // Primary
  primary: '#135bec',
  primaryLight: '#3d7aef',
  primaryDark: '#0d47c4',
  
  // Backgrounds
  backgroundLight: '#f6f6f8',
  backgroundDark: '#101622',
  
  // Neutrals - Light Mode
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  
  // Neutrals - Dark Mode
  zinc50: '#fafafa',
  zinc100: '#f4f4f5',
  zinc200: '#e4e4e7',
  zinc300: '#d4d4d8',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  zinc600: '#52525b',
  zinc700: '#3f3f46',
  zinc800: '#27272a',
  zinc900: '#18181b',
  
  // Semantic
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  
  // Opacity variants
  primaryOpacity20: 'rgba(19, 91, 236, 0.2)',
  primaryOpacity30: 'rgba(19, 91, 236, 0.3)',
  blackOpacity60: 'rgba(0, 0, 0, 0.6)',
};

export type ColorKey = keyof typeof colors;
