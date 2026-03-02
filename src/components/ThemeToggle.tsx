interface ThemeToggleProps {
  theme: 'light' | 'dark'
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button className="lang-picker-btn" onClick={onToggle} title="Toggle theme">
      {theme === 'light' ? '\u263E Dark' : '\u2600 Light'}
    </button>
  )
}
