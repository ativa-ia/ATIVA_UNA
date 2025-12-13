/**
 * Design System - Colors
 * Paleta de cores do ATIVA IA
 */

export const colors = {
  // Primary - Indigo Brand
  primary: '#4f46e5',      // Indigo 600
  primaryLight: '#6366f1', // Indigo 500
  primaryDark: '#4338ca',  // Indigo 700

  // Secondary - Emerald Green (Success/Growth)
  secondary: '#10b981',      // Emerald 500
  secondaryLight: '#34d399', // Emerald 400
  secondaryDark: '#059669',  // Emerald 600

  // Accents
  accent: '#8b5cf6',       // Violet 500 (Harmony with Indigo)
  danger: '#f43f5e',       // Rose 500
  warning: '#f59e0b',      // Amber 500
  info: '#0ea5e9',         // Sky 500

  // Backgrounds - Light Mode Focus
  backgroundLight: '#f8fafc', // Slate 50 (Soft White)
  backgroundCard: '#ffffff',  // Pure White
  backgroundDark: '#0f172a',  // Slate 900 (for contrast elements)

  // Neutrals - Slate (Cooler grays for modern look)
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

  // Semantics
  white: '#ffffff',
  black: '#000000',
  gray: '#64748b',
  transparent: 'transparent',

  // Text
  textPrimary: '#1e293b',   // Slate 800 - Soft Black
  textSecondary: '#64748b', // Slate 500 - Medium Gray
  textInverted: '#ffffff',  // White text

  // Gradients (Reference ONLY - use LinearGradient component)
  gradientPrimary: ['#4f46e5', '#6366f1'],   // Indigo Flow
  gradientSuccess: ['#10b981', '#34d399'],   // Emerald Flow

  // Opacity variants
  primaryOpacity20: 'rgba(79, 70, 229, 0.2)', // Indigo 600 with 0.2 opacity
  primaryOpacity30: 'rgba(79, 70, 229, 0.3)', // Indigo 600 with 0.3 opacity
  blackOpacity60: 'rgba(0, 0, 0, 0.6)',
};

export type ColorKey = keyof typeof colors;
