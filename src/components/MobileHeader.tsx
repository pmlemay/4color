import { Link } from 'react-router-dom'

interface MobileHeaderProps {
  title?: string
  timerDisplay?: React.ReactNode
  onMenuToggle: () => void
}

export function MobileHeader({ title, timerDisplay, onMenuToggle }: MobileHeaderProps) {
  return (
    <div className="mobile-header">
      <button className="mobile-menu-btn" onClick={onMenuToggle}>&#9776;</button>
      <Link to="/" className="mobile-back-btn">&larr;</Link>
      <div className="mobile-header-title">{title || 'Puzzle'}</div>
      {timerDisplay && <div className="mobile-header-timer">{timerDisplay}</div>}
    </div>
  )
}
