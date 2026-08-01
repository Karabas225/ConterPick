"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "counterpick-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function preferredTheme(): Theme {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  // The first client render must equal the server render. Reading localStorage
  // during useState caused a hydration mismatch for players with a saved theme.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(preferredTheme());
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); window.localStorage.setItem(STORAGE_KEY, next); applyTheme(next);
  };

  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"} title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}><span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span><small>{theme === "dark" ? "DARK" : "LIGHT"}</small></button>;
}
