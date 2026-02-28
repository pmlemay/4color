import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const LANGUAGES = [
  { code: '', label: 'English' },
  { code: 'fr', label: 'Fran\u00e7ais' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Portugu\u00eas' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'ja', label: '\u65e5\u672c\u8a9e' },
  { code: 'ko', label: '\ud55c\uad6d\uc5b4' },
  { code: 'zh-CN', label: '\u4e2d\u6587' },
  { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
  { code: 'hi', label: '\u0939\u093f\u0928\u094d\u0926\u0940' },
  { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'T\u00fcrk\u00e7e' },
  { code: 'sv', label: 'Svenska' },
]

function getGoogleTranslateSelect(): HTMLSelectElement | null {
  return document.querySelector('#google_translate_element select') as HTMLSelectElement | null
}

function getCurrentLang(): string {
  // Check the Google Translate cookie
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/)
  return match ? match[1] : ''
}

function triggerTranslate(langCode: string) {
  const sel = getGoogleTranslateSelect()
  if (!sel) return
  if (!langCode) {
    // Revert to English: set to empty and reload (Google's way)
    document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC'
    document.cookie = 'googtrans=; path=/; domain=' + window.location.hostname + '; expires=Thu, 01 Jan 1970 00:00:00 UTC'
    // Find the "Select Language" option or just set to first option
    sel.value = ''
    sel.dispatchEvent(new Event('change'))
    // Google Translate doesn't always revert cleanly, so reload
    window.location.reload()
    return
  }
  sel.value = langCode
  sel.dispatchEvent(new Event('change'))
}

export function LanguagePicker() {
  const [current, setCurrent] = useState(getCurrentLang)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current && !ref.current.contains(target) && (!menuRef.current || !menuRef.current.contains(target))) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
  }, [open])

  const currentLabel = LANGUAGES.find(l => l.code === current)?.label || 'English'

  return (
    <div className="lang-picker notranslate" ref={ref}>
      <button ref={btnRef} className="lang-picker-btn" onClick={() => setOpen(o => !o)} title="Change language">
        {currentLabel}
      </button>
      {open && menuPos && createPortal(
        <div ref={menuRef} className="lang-picker-menu" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              className={`lang-picker-item${lang.code === current ? ' active' : ''}`}
              onClick={() => {
                setCurrent(lang.code)
                triggerTranslate(lang.code)
                setOpen(false)
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
