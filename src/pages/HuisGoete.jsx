import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EXPIRE_MS = 24 * 60 * 60 * 1000

const ROOMS = [
  { id: 'kombuis',    label: 'Kombuis',          emoji: '🍳' },
  { id: 'sitkamer',   label: 'Sitkamer',         emoji: '🛋️' },
  { id: 'patio',      label: 'Patio',            emoji: '🪴' },
  { id: 'buite',      label: 'Buite',            emoji: '🌿' },
  { id: 'gangen',     label: 'Gang & Trappe',    emoji: '🚪' },
  { id: 'raikie',     label: "Raaikie se Kamer", emoji: '🌸' },
  { id: 'lala',       label: 'Lalaloops Kamer',  emoji: '🦄' },
  { id: 'girlsbad',   label: 'Girls Badkamer',   emoji: '💅' },
  { id: 'mammakamer', label: 'Ons Kamer',        emoji: '❤️' },
  { id: 'onsbad',     label: 'Ons Badkamer',     emoji: '🚿' },
  { id: 'garage',     label: 'Garage',           emoji: '🚗' },
]

function decodeItem(rawName) {
  try {
    const d = JSON.parse(rawName)
    if (d && d._hv === 1) return { name: d.n ?? '', link: d.l ?? null, image: d.i ?? null }
  } catch {}
  return { name: rawName, link: null, image: null }
}

function encodeItem(name, link, image) {
  const n = name.trim()
  const l = link?.trim() || null
  const i = image || null
  if (!l && !i) return n
  return JSON.stringify({ _hv: 1, n, l, i })
}

function compressToBase64(file) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objUrl)
      const MAX = 900
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.src = objUrl
  })
}

// Sort: unchecked A-Z (by decoded name), then checked at bottom
function sortRows(rows) {
  const unchecked = rows
    .filter(r => !r.checked_at)
    .sort((a, b) => decodeItem(a.item_name).name.localeCompare(decodeItem(b.item_name).name, 'af'))
  const checked = rows
    .filter(r => r.checked_at)
    .sort((a, b) => Number(a.checked_at) - Number(b.checked_at))
  return [...unchecked, ...checked]
}

// ─── Single item card ──────────────────────────────────────────────────────────
function ItemCard({ row, onRowChange, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const fileInputRef = useRef(null)

  const { name, link, image } = decodeItem(row.item_name)
  const isChecked = !!row.checked_at

  const [editName, setEditName] = useState(name)
  const [editLink, setEditLink] = useState(link ?? '')
  const [editImagePreview, setEditImagePreview] = useState(image ?? '')
  const [editImageFile, setEditImageFile] = useState(null)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const { data: updated } = await supabase.from('shopping_items')
      .update({ checked_at: row.checked_at ? null : Date.now() })
      .eq('id', row.id).select().single()
    if (updated) onRowChange(updated)
  }

  async function deleteItem() {
    if (!confirm(`Verwyder "${name}"?`)) return
    await supabase.from('shopping_items').delete().eq('id', row.id)
    onDeleted(row.id)
  }

  async function saveEdit() {
    if (!editName.trim()) return
    setSaving(true)
    let finalImage = editImagePreview || null
    if (editImageFile) finalImage = await compressToBase64(editImageFile)
    const newEncoded = encodeItem(editName, editLink, finalImage)
    const { data: updated } = await supabase.from('shopping_items')
      .update({ item_name: newEncoded })
      .eq('id', row.id).select().single()
    if (updated) onRowChange(updated)
    setEditing(false)
    setOpen(true)
    setSaving(false)
  }

  // Checked state: simplified dimmed row
  if (isChecked) {
    return (
      <li className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-gray-100 opacity-50">
        <button onClick={toggle}
          className="w-6 h-6 rounded-lg border-2 border-green-500 bg-green-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-black">
          ✓
        </button>
        <span className="flex-1 line-through text-gray-400 font-bold">{name}</span>
        <button onClick={deleteItem} className="text-gray-300 font-black text-xl leading-none">×</button>
      </li>
    )
  }

  // Edit mode
  if (editing) {
    return (
      <li className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 space-y-3">
        <div>
          <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Item naam</label>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            className="input-field mt-1" autoFocus />
        </div>
        <div>
          <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Skakel (opsioneel)</label>
          <input type="url" value={editLink} onChange={e => setEditLink(e.target.value)}
            className="input-field mt-1" placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2 block">Foto (opsioneel)</label>
          {editImagePreview ? (
            <div className="relative">
              <img src={editImagePreview} alt="foto" className="w-full max-h-48 object-cover rounded-xl" />
              <button type="button" onClick={() => { setEditImagePreview(''); setEditImageFile(null) }}
                className="absolute top-2 right-2 bg-red-500 text-white w-7 h-7 rounded-full font-black flex items-center justify-center">×</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-5 flex flex-col items-center gap-1 text-gray-400">
              <span className="text-3xl">📷</span>
              <span className="text-xs font-extrabold">Kies foto</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*"
            onChange={e => { const f = e.target.files[0]; if (f) { setEditImageFile(f); setEditImagePreview(URL.createObjectURL(f)) } }}
            className="hidden" />
        </div>
        <div className="flex gap-2">
          <button onClick={saveEdit} disabled={saving || !editName.trim()}
            className="flex-1 bg-green-500 text-white font-extrabold py-2.5 rounded-xl disabled:opacity-50">
            {saving ? 'Stoor…' : '💾 Stoor'}
          </button>
          <button onClick={() => setEditing(false)}
            className="flex-1 bg-gray-100 text-gray-600 font-extrabold py-2.5 rounded-xl">
            Kanselleer
          </button>
        </div>
      </li>
    )
  }

  // Normal expandable card
  return (
    <li className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={toggle}
          className="w-6 h-6 rounded-lg border-2 border-gray-300 flex-shrink-0 active:border-green-400" />
        <span onClick={() => setOpen(o => !o)} className="flex-1 font-extrabold cursor-pointer select-none">{name}</span>
        {(link || image) && <span className="text-xs text-gray-400">{image ? '📷' : ''}{link ? '🔗' : ''}</span>}
        <span onClick={() => setOpen(o => !o)}
          className={`text-gray-400 font-black text-lg cursor-pointer transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
        <button onClick={deleteItem} className="text-gray-300 font-black text-xl leading-none pl-1">×</button>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {image && (
            <img src={image} alt={name} className="w-full max-h-56 object-cover rounded-xl"
              onError={e => { e.target.style.display = 'none' }} />
          )}
          <div className="flex gap-2 flex-wrap">
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-blue-50 text-blue-600 font-extrabold px-3 py-1.5 rounded-xl">
                🔗 Skakel
              </a>
            )}
            <button onClick={() => { setEditing(true); setOpen(false) }}
              className="text-xs bg-green-50 text-green-700 font-extrabold px-3 py-1.5 rounded-xl">
              ✏️ Wysig
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

// ─── Room item list (/huisgoete/:roomId) ───────────────────────────────────────
export function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const room = ROOMS.find(r => r.id === roomId)
  const categoryId = `house_${roomId}`

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newLink, setNewLink] = useState('')
  const [newImagePreview, setNewImagePreview] = useState('')
  const [newImageFile, setNewImageFile] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [adding, setAdding] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    async function load() {
      // Clean up expired checked items
      const cutoff = Date.now() - EXPIRE_MS
      await supabase.from('shopping_items').delete()
        .eq('category', categoryId).not('checked_at', 'is', null).lt('checked_at', cutoff)

      const { data } = await supabase.from('shopping_items').select('*').eq('category', categoryId)
      setRows(data ?? [])
      setLoading(false)
    }
    load()

    const channel = supabase.channel(`huisgoete-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopping_items', filter: `category=eq.${categoryId}` },
        ({ new: row }) => setRows(prev => [...prev.filter(r => r.id !== row.id), row]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_items', filter: `category=eq.${categoryId}` },
        ({ new: row }) => setRows(prev => prev.map(r => r.id === row.id ? row : r)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shopping_items', filter: `category=eq.${categoryId}` },
        ({ old: row }) => setRows(prev => prev.filter(r => r.id !== row.id)))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [roomId, categoryId])

  function resetForm() {
    setNewName(''); setNewLink(''); setNewImagePreview(''); setNewImageFile(null)
    setShowAddForm(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function addItem() {
    if (!newName.trim()) return
    setAdding(true)
    let finalImage = null
    if (newImageFile) finalImage = await compressToBase64(newImageFile)
    const encoded = encodeItem(newName, newLink, finalImage)
    const { data: row } = await supabase.from('shopping_items')
      .upsert({ category: categoryId, item_name: encoded, checked_at: null }, { onConflict: 'category,item_name' })
      .select().single()
    if (row) setRows(prev => [...prev.filter(r => r.id !== row.id), row])
    resetForm()
    setAdding(false)
  }

  if (!room) return <div className="p-6 text-center text-gray-400">Kamer nie gevind nie.</div>

  const sorted = sortRows(rows)

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/huisgoete')}
          className="bg-gray-100 text-gray-500 font-extrabold text-sm px-3 py-2 rounded-xl">
          ← Terug
        </button>
        <span className="text-3xl">{room.emoji}</span>
        <h2 className="text-2xl font-black">{room.label}</h2>
      </div>

      {loading ? (
        <p className="text-center py-6 text-gray-400 font-bold animate-pulse">Laai…</p>
      ) : (
        <div className="space-y-3">
          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)}
              className="w-full bg-green-50 border-2 border-dashed border-green-200 rounded-2xl py-4 text-green-600 font-extrabold text-sm active:scale-95 transition-transform">
              ＋ Voeg item by
            </button>
          ) : (
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 space-y-3">
              <div>
                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Item naam *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  className="input-field mt-1" placeholder="bv. Gebreekte lig" autoFocus />
              </div>
              <div>
                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Skakel (opsioneel)</label>
                <input type="url" value={newLink} onChange={e => setNewLink(e.target.value)}
                  className="input-field mt-1" placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2 block">Foto (opsioneel)</label>
                {newImagePreview ? (
                  <div className="relative">
                    <img src={newImagePreview} alt="foto" className="w-full max-h-48 object-cover rounded-xl" />
                    <button type="button" onClick={() => { setNewImagePreview(''); setNewImageFile(null) }}
                      className="absolute top-2 right-2 bg-red-500 text-white w-7 h-7 rounded-full font-black flex items-center justify-center">×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl py-5 flex flex-col items-center gap-1 text-gray-400">
                    <span className="text-3xl">📷</span>
                    <span className="text-xs font-extrabold">Kies foto van foon</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*"
                  onChange={e => { const f = e.target.files[0]; if (f) { setNewImageFile(f); setNewImagePreview(URL.createObjectURL(f)) } }}
                  className="hidden" />
              </div>
              <div className="flex gap-2">
                <button onClick={addItem} disabled={adding || !newName.trim()}
                  className="flex-1 bg-green-500 text-white font-extrabold py-2.5 rounded-xl disabled:opacity-50">
                  {adding ? 'Stoor…' : '＋ Voeg by'}
                </button>
                <button onClick={resetForm}
                  className="flex-1 bg-gray-100 text-gray-600 font-extrabold py-2.5 rounded-xl">
                  Kanselleer
                </button>
              </div>
            </div>
          )}

          {sorted.length === 0 && !showAddForm && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📋</p>
              <p className="font-extrabold text-sm">Nog geen items nie</p>
            </div>
          )}

          <ul className="space-y-2">
            {sorted.map(row => (
              <ItemCard
                key={row.id}
                row={row}
                onRowChange={updated => setRows(prev => prev.map(r => r.id === updated.id ? updated : r))}
                onDeleted={id => setRows(prev => prev.filter(r => r.id !== id))}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Main Huisgoete overview ───────────────────────────────────────────────────
export default function HuisGoete() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})

  useEffect(() => {
    loadCounts()

    const channel = supabase.channel('huisgoete-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' },
        () => loadCounts())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function loadCounts() {
    const { data } = await supabase.from('shopping_items')
      .select('category')
      .like('category', 'house_%')
      .is('checked_at', null)
    if (!data) return
    const map = {}
    data.forEach(({ category }) => { map[category] = (map[category] ?? 0) + 1 })
    setCounts(map)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-3xl">🏠</span>
        <h2 className="text-2xl font-black">Huisgoete</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ROOMS.map(room => {
          const count = counts[`house_${room.id}`] ?? 0
          return (
            <button
              key={room.id}
              onClick={() => navigate(`/huisgoete/${room.id}`)}
              className="relative flex flex-col items-center justify-center gap-1.5 px-2 py-4 rounded-2xl bg-gray-100 text-gray-600 font-extrabold text-[11px] text-center leading-tight active:scale-95 active:bg-green-50 active:text-green-700 transition-all"
            >
              <span className="text-3xl">{room.emoji}</span>
              <span>{room.label}</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 leading-none">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
