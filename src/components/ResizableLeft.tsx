import { useRef, useState, useCallback, useEffect } from 'react'

interface ResizableLeftProps {
  children: React.ReactNode
  defaultWidth?: number
  storageKey?: string
}

export function ResizableLeft({ children, defaultWidth = 400, storageKey = '4color:leftWidth' }: ResizableLeftProps) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? Number(saved) : defaultWidth
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const newWidth = Math.max(180, Math.min(800, startWidth.current + e.clientX - startX.current))
      setWidth(newWidth)
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(storageKey, String(width))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [width, storageKey])

  // Auto-shrink on small windows
  useEffect(() => {
    const onResize = () => {
      const maxAllowed = Math.min(800, window.innerWidth * 0.4)
      if (width > maxAllowed) setWidth(maxAllowed)
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [width])

  return (
    <div className="panel-left-wrapper">
      <aside className="panel-left" style={{ width }}>
        {children}
      </aside>
      <div
        className={`panel-left-handle ${dragging.current ? 'dragging' : ''}`}
        onMouseDown={onMouseDown}
      />
    </div>
  )
}
