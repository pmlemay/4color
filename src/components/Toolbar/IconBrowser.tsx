import { useState, useEffect, useRef } from 'react'

const BASE = import.meta.env.BASE_URL

interface IconEntry {
  n: string  // name
  f: string  // filename
}

let cachedIndex: IconEntry[] | null = null

const PAGE_SIZE = 40

function humanize(name: string): string {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function IconBrowser({ onIconAdd }: { onIconAdd: (base64: string) => void }) {
  const [icons, setIcons] = useState<IconEntry[]>(cachedIndex || [])
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(!cachedIndex)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (cachedIndex) return
    fetch(`${BASE}icons/index.json`)
      .then(r => r.ok ? r.json() : [])
      .then((data: IconEntry[]) => {
        cachedIndex = data
        setIcons(data)
      })
      .catch(() => setIcons([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = search
    ? icons.filter(ic => ic.n.includes(search.toLowerCase()))
    : icons

  const visible = filtered.slice(0, limit)
  const hasMore = filtered.length > limit

  // Reset pagination when search changes
  useEffect(() => { setLimit(PAGE_SIZE) }, [search])

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
      const base64 = canvas.toDataURL('image/png')
      onIconAdd(base64)
    }
    img.src = `${BASE}icons/${icon.f}`
  }

  if (loading) return <div className="tb-icon-meta">Loading icons...</div>
  if (icons.length === 0) return null

  return (
    <>
      <input
        className="tb-input tb-icon-search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search icons..."
      />
      <div className="tb-icon-meta">{filtered.length} icons{search && ' found'}</div>
      <div className="tb-icon-results">
        {visible.map(icon => (
          <button
            key={icon.n}
            className="tb-icon-thumb"
            onClick={() => handleClick(icon)}
            title={humanize(icon.n)}
          >
            <img src={`${BASE}icons/${icon.f}`} alt={icon.n} draggable={false} />
          </button>
        ))}
      </div>
      {hasMore && (
        <button className="tb-btn" onClick={() => setLimit(l => l + PAGE_SIZE)}>
          Load more...
        </button>
      )}
    </>
  )
}
