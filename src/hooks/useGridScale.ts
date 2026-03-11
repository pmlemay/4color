import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 0.3
const BASE_MAX_ZOOM = 3.0
// Ensure the user can always zoom in to at least this effective scale
const MIN_EFFECTIVE_MAX = 2.0
const ZOOM_SENSITIVITY = 0.001
const CELL_SIZE = 50
// Extra pixels for grid border (1px border-collapse means ~1px per edge)
const GRID_PADDING = 2

interface UseGridScaleOptions {
  rows: number
  cols: number
  autoResetZoom?: boolean
}

export function useGridScale({ rows, cols, autoResetZoom = true }: UseGridScaleOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isPinching, setIsPinching] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const pinchStartDist = useRef(0)
  const pinchStartZoom = useRef(1)
  const panStart = useRef({ x: 0, y: 0 })
  const panStartOffset = useRef({ x: 0, y: 0 })
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

  // Reset zoom and pan when puzzle changes (opt-in)
  useEffect(() => {
    if (autoResetZoom) {
      setZoomLevel(1)
      setPan({ x: 0, y: 0 })
    }
  }, [rows, cols, autoResetZoom])

  // Wheel/trackpad handling:
  // - ctrlKey (trackpad pinch or Ctrl+scroll) → zoom
  // - deltaX present without ctrlKey (trackpad two-finger scroll) → pan
  // - pure deltaY without ctrlKey or deltaX (mouse wheel) → zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = containerRef.current
      if (!el || !el.contains(e.target as Node)) return
      e.preventDefault()
      e.stopPropagation()

      // Trackpad two-finger scroll: has deltaX or ctrlKey is false with fine-grained deltaY
      // Mouse wheel: no deltaX, larger discrete deltaY steps
      const isTrackpadPan = !e.ctrlKey && e.deltaX !== 0

      if (isTrackpadPan) {
        // Two-finger scroll on trackpad — pan
        const oldPan = panRef.current
        setPan({
          x: oldPan.x - e.deltaX,
          y: oldPan.y - e.deltaY,
        })
      } else {
        // Pinch-to-zoom, Ctrl+scroll, or mouse wheel — zoom toward cursor
        const oldZoom = zoomLevelRef.current
        const delta = -e.deltaY * ZOOM_SENSITIVITY
        const newZoom = Math.min(maxZoomRef.current, Math.max(MIN_ZOOM, oldZoom + delta))
        if (newZoom === oldZoom) return

        const rect = el.getBoundingClientRect()
        const cx = e.clientX - rect.left - rect.width / 2
        const cy = e.clientY - rect.top - rect.height / 2
        const oldScale = fitScaleRef.current * oldZoom
        const newScale = fitScaleRef.current * newZoom
        const ratio = newScale / oldScale
        const oldPan = panRef.current

        setPan({
          x: cx - ratio * (cx - oldPan.x),
          y: cy - ratio * (cy - oldPan.y),
        })
        setZoomLevel(newZoom)
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

  // Safari gesturestart/gesturechange for trackpad pinch (iPad + trackpad, Mac Safari)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleGestureStart = (e: Event) => {
      if (!el.contains(e.target as Node)) return
      e.preventDefault()
      ;(el as any).__gestureStartZoom = zoomLevelRef.current
    }

    const handleGestureChange = (e: Event) => {
      if (!el.contains(e.target as Node)) return
      e.preventDefault()
      const ge = e as any // Safari GestureEvent has .scale
      const startZoom = (el as any).__gestureStartZoom ?? zoomLevelRef.current
      const newZoom = Math.min(maxZoomRef.current, Math.max(MIN_ZOOM, startZoom * ge.scale))

      // Zoom toward gesture center
      const rect = el.getBoundingClientRect()
      const cx = ge.clientX - rect.left - rect.width / 2
      const cy = ge.clientY - rect.top - rect.height / 2
      const oldScale = fitScaleRef.current * startZoom
      const newScale = fitScaleRef.current * newZoom
      const ratio = newScale / oldScale
      const oldPan = panRef.current

      setPan({
        x: cx - ratio * (cx - oldPan.x),
        y: cy - ratio * (cy - oldPan.y),
      })
      setZoomLevel(newZoom)
    }

    const handleGestureEnd = (e: Event) => {
      if (!el.contains(e.target as Node)) return
      e.preventDefault()
    }

    el.addEventListener('gesturestart', handleGestureStart, { passive: false } as any)
    el.addEventListener('gesturechange', handleGestureChange, { passive: false } as any)
    el.addEventListener('gestureend', handleGestureEnd, { passive: false } as any)
    return () => {
      el.removeEventListener('gesturestart', handleGestureStart)
      el.removeEventListener('gesturechange', handleGestureChange)
      el.removeEventListener('gestureend', handleGestureEnd)
    }
  }, [])

  // Pinch-to-zoom centered on midpoint (mobile) — no single-finger pan
  useEffect(() => {
    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const getTouchMid = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    })

    const pinchStartMid = { x: 0, y: 0 }
    const pinchStartPan = { x: 0, y: 0 }

    const handleTouchStart = (e: TouchEvent) => {
      const el = containerRef.current
      if (!el || !el.contains(e.target as Node)) return
      if (e.touches.length === 2) {
        setIsPinching(true)
        pinchStartDist.current = getTouchDist(e.touches[0], e.touches[1])
        pinchStartZoom.current = zoomLevelRef.current
        const mid = getTouchMid(e.touches[0], e.touches[1])
        const rect = el.getBoundingClientRect()
        pinchStartMid.x = mid.x - rect.left - rect.width / 2
        pinchStartMid.y = mid.y - rect.top - rect.height / 2
        pinchStartPan.x = panRef.current.x
        pinchStartPan.y = panRef.current.y
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const el = containerRef.current
      if (!el) return

      const dist = getTouchDist(e.touches[0], e.touches[1])
      const ratio = dist / pinchStartDist.current
      const newZoom = Math.min(maxZoomRef.current, Math.max(MIN_ZOOM, pinchStartZoom.current * ratio))

      // Current midpoint relative to container center
      const mid = getTouchMid(e.touches[0], e.touches[1])
      const rect = el.getBoundingClientRect()
      const cx = mid.x - rect.left - rect.width / 2
      const cy = mid.y - rect.top - rect.height / 2

      // Pan so the point under the original midpoint follows the fingers
      const oldScale = fitScaleRef.current * pinchStartZoom.current
      const newScale = fitScaleRef.current * newZoom
      const scaleRatio = newScale / oldScale

      setPan({
        x: cx - scaleRatio * (pinchStartMid.x - pinchStartPan.x),
        y: cy - scaleRatio * (pinchStartMid.y - pinchStartPan.y),
      })
      setZoomLevel(newZoom)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        setTimeout(() => setIsPinching(false), 50)
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

  // Refs for use in touch/mouse/wheel handlers (avoid stale closures)
  const maxZoom = Math.max(BASE_MAX_ZOOM, MIN_EFFECTIVE_MAX / Math.max(fitScale, 0.01))
  const maxZoomRef = useRef(maxZoom)
  maxZoomRef.current = maxZoom
  const fitScaleRef = useRef(fitScale)
  fitScaleRef.current = fitScale
  const zoomLevelRef = useRef(zoomLevel)
  zoomLevelRef.current = zoomLevel
  const panRef = useRef(pan)
  panRef.current = pan

  const effectiveScale = fitScale * zoomLevel

  const resetZoom = useCallback(() => {
    setZoomLevel(1)
    setPan({ x: 0, y: 0 })
  }, [])

  /** Zoom and pan so that the given cell region fills the viewport */
  const focusOnRegion = useCallback((minRow: number, maxRow: number, minCol: number, maxCol: number) => {
    const el = containerRef.current
    if (!el) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    if (cw === 0 || ch === 0) return

    // Compute fitScale directly (same formula as the ResizeObserver)
    const currentFitScale = Math.max(0.1, Math.min(cw / gridW, ch / gridH, 1.5) * 0.92)

    const regionW = (maxCol - minCol + 1) * CELL_SIZE
    const regionH = (maxRow - minRow + 1) * CELL_SIZE
    // Desired effective scale to fit the region with comfortable padding
    const desiredEffScale = Math.min(cw / regionW, ch / regionH) * 0.6
    const newZoom = Math.min(
      Math.max(BASE_MAX_ZOOM, MIN_EFFECTIVE_MAX / Math.max(currentFitScale, 0.01)),
      Math.max(MIN_ZOOM, desiredEffScale / currentFitScale)
    )
    const eff = currentFitScale * newZoom

    // Region center offset from grid center, in grid pixels
    const regCX = (minCol + maxCol + 1) / 2 * CELL_SIZE
    const regCY = (minRow + maxRow + 1) / 2 * CELL_SIZE
    const offsetX = regCX - gridW / 2
    const offsetY = regCY - gridH / 2

    setFitScale(currentFitScale)
    setPan({ x: -offsetX * eff, y: -offsetY * eff })
    setZoomLevel(newZoom)
  }, [gridW, gridH])

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
    focusOnRegion,
  }
}
