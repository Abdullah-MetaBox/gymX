'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Light/dark toggle.
 *
 * The class is applied by an inline script in the root layout before first
 * paint, so this component only has to reflect and change it — no flash of the
 * wrong theme on load.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('gymx.theme', next ? 'dark' : 'light');
    } catch {
      // Private browsing: the toggle still works for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg p-2 hover:surface-2"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
