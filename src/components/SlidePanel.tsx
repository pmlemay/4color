import { useEffect } from 'react'

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function SlidePanel({ open, onClose, children }: SlidePanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <div className={`slide-panel-backdrop ${open ? 'open' : ''}`} onClick={onClose}>
      <div
        className={`slide-panel ${open ? 'open' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
