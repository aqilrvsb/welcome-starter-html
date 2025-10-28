import * as React from 'react';

const { useEffect } = React;

// Simplified theme provider that only supports light mode
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force light theme
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
  }, []);

  return <>{children}</>;
}

// Keep the hook for compatibility but remove theme functionality
export function useTheme() {
  return {
    theme: 'light' as const,
    toggleTheme: () => {} // No-op
  };
}