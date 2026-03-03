import { useState, useEffect, useRef, useMemo } from 'react'

const BASE = import.meta.env.BASE_URL

interface IconEntry {
  n: string  // name
  f: string  // filename
  c?: string // category
}

let cachedIndex: IconEntry[] | null = null
let cachedCategories: string[] | null = null

const PAGE_SIZE = 40

function humanize(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const ICON_PRESETS = [
  '#000000', '#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#6d4c41', '#ffffff',
]

export function IconBrowser({ onIconAdd }: { onIconAdd: (base64: string) => void }) {
  const [icons, setIcons] = useState<IconEntry[]>(cachedIndex || [])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(!cachedIndex)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [iconColor, setIconColor] = useState('#000000')
  const [categories, setCategories] = useState<string[]>(cachedCategories || [])

  useEffect(() => {
    if (cachedIndex) return
    fetch(`${BASE}icons/index.json`)
      .then(r => r.ok ? r.json() : [])
      .then((data: IconEntry[]) => {
        cachedIndex = data
        setIcons(data)
        const cats = [...new Set(data.map(e => e.c).filter(Boolean) as string[])].sort()
        cachedCategories = cats
        setCategories(cats)
      })
      .catch(() => setIcons([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = icons
    if (category) result = result.filter(ic => ic.c === category)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(ic => ic.n.includes(q) || (ic.c && ic.c.toLowerCase().includes(q)))
    }
    return result
  }, [icons, search, category])

  const visible = filtered.slice(0, limit)
  const hasMore = filtered.length > limit

  // Reset pagination when filters change
  useEffect(() => { setLimit(PAGE_SIZE) }, [search, category])

  const handleClick = (icon: IconEntry) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }
      const canvas = canvasRef.current
      canvas.width = 50
      canvas.height = 50
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 50, 50)
      ctx.drawImage(img, 0, 0, 50, 50)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = iconColor
      ctx.fillRect(0, 0, 50, 50)
      ctx.globalCompositeOperation = 'source-over'
      const base64 = canvas.toDataURL('image/png')
      onIconAdd(base64)
    }
    img.src = `${BASE}icons/${icon.f}`
  }

  if (loading) return <div className="tb-icon-meta">Loading icons...</div>
  if (icons.length === 0) return null

  return (
    <>
      <div className="tb-icon-colors">
        {ICON_PRESETS.map(c => (
          <button
            key={c}
            className={'tb-icon-color-swatch' + (iconColor === c ? ' active' : '')}
            style={{ background: c }}
            onClick={() => setIconColor(c)}
            title={c}
          />
        ))}
      </div>
      <div className="tb-icon-color-row">
        <span className="tb-icon-color-label">Custom color:</span>
        <input
          type="color"
          className="tb-icon-color-custom"
          value={iconColor}
          onChange={e => setIconColor(e.target.value)}
          title="Custom color"
        />
      </div>
      <input
        className="tb-input tb-icon-search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search icons..."
      />
      <select
        className="tb-input tb-icon-search"
        value={category}
        onChange={e => setCategory(e.target.value)}
      >
        <option value="">All categories</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="tb-icon-meta">{filtered.length} icons{(search || category) && ' found'}</div>
      <div className="tb-icon-scroll">
        <div className="tb-icon-results">
          {visible.map(icon => (
            <button
              key={icon.n}
              className="tb-icon-thumb"
              onClick={() => handleClick(icon)}
              title={icon.c ? `${humanize(icon.n)} (${icon.c})` : humanize(icon.n)}
            >
              <img src={`${BASE}icons/${icon.f}`} alt={icon.n} draggable={false} loading="lazy" />
            </button>
          ))}
        </div>
        {hasMore && (
          <button className="tb-btn" onClick={() => setLimit(l => l + PAGE_SIZE)}>
            Load more...
          </button>
        )}
      </div>
    </>
  )
}
