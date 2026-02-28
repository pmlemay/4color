import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 3.0
const ZOOM_SENSITIVITY = 0.002
const CELL_SIZE = 50
// Extra pixels for grid border (1px border-collapse means ~1px per edge)
const GRID_PADDING = 2

interface UseGridScaleOptions {
  rows: number
  cols: number
}

export function useGridScale({ rows, cols }: UseGridScaleOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isPinching, setIsPinching] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const pinchStartDist = useRef(0)
  const pinchStartZoom = useRef(1)
  const panStart = useRef({ x: 0, y: 0 })
  const panStartOffset = useRef({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const isMiddleDragging = useRef(false)

  const gridW = cols * CELL_SIZE + GRID_PADDING
  const gridH = rows * CELL_SIZE + GRID_PADDING

  // Auto-fit: observe container size and compute fitScale
  useEffect(() => {
    const el = containerRef.current
    if (!el || rows === 0 || cols === 0) return

    const update = () => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cw === 0 || ch === 0) return
      const s = Math.min(cw / gridW, ch / gridH, 1.5) * 0.92
      setFitScale(Math.max(0.1, s))
    }

    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [rows, cols, gridW, gridH])

  // Reset zoom and pan when puzzle changes
  useEffect(() => {
    setZoomLevel(1)
    setPan({ x: 0, y: 0 })
  }, [rows, cols])

  // Scroll: Ctrl+scroll = zoom, plain scroll = pan
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = containerRef.current
      if (!el || !el.contains(e.target as Node)) return

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        e.preventDefault()
        e.stopPropagation()
        setZoomLevel(prev => {
          const delta = -e.deltaY * ZOOM_SENSITIVITY
          return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta))
        })
      } else {
        // Pan
        e.preventDefault()
        setPan(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', handleWheel, { capture: true })
  }, [])

  // Middle-mouse-button drag to pan (PC)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return // middle button only
      const el = containerRef.current
      if (!el || !el.contains(e.target as Node)) return
      e.preventDefault()
      isMiddleDragging.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      panStartOffset.current = { ...panRef.current }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMiddleDragging.current) return
      e.preventDefault()
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan({
        x: panStartOffset.current.x + dx,
        y: panStartOffset.current.y + dy,
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) isMiddleDragging.current = false
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Pinch-to-zoom + pan (mobile) — use document-level listeners to avoid stale ref
  useEffect(() => {
    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

    const handleTouchStart = (e: TouchEvent) => {
      const el = containerRef.current
      if (!el || !el.contains(e.target as Node)) return
      if (e.touches.length === 2) {
        setIsPinching(true)
        pinchStartDist.current = getTouchDist(e.touches[0], e.touches[1])
        pinchStartZoom.current = zoomLevelRef.current
      } else if (e.touches.length === 1) {
        // Pan if zoomed in, or if touch started outside the grid
        const onGrid = !!(e.target as HTMLElement).closest?.('.puzzle-grid')
        if (zoomLevelRef.current > 1.05 || !onGrid) {
          isPanning.current = true
          panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          panStartOffset.current = { ...panRef.current }
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dist = getTouchDist(e.touches[0], e.touches[1])
        const ratio = dist / pinchStartDist.current
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom.current * ratio))
        setZoomLevel(newZoom)
      } else if (e.touches.length === 1 && isPanning.current) {
        e.preventDefault()
        const dx = e.touches[0].clientX - panStart.current.x
        const dy = e.touches[0].clientY - panStart.current.y
        setPan({
          x: panStartOffset.current.x + dx,
          y: panStartOffset.current.y + dy,
        })
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        setTimeout(() => setIsPinching(false), 50)
      }
      if (e.touches.length === 0) {
        isPanning.current = false
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // Refs for use in touch/mouse handlers (avoid stale closures)
  const zoomLevelRef = useRef(zoomLevel)
  zoomLevelRef.current = zoomLevel
  const panRef = useRef(pan)
  panRef.current = pan

  const effectiveScale = fitScale * zoomLevel

  const resetZoom = useCallback(() => {
    setZoomLevel(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const style: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})`,
    transformOrigin: 'center center',
  }

  return {
    containerRef,
    scale: effectiveScale,
    zoomLevel,
    style,
    isPinching,
    resetZoom,
  }
}
