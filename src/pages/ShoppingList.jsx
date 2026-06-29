import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EXPIRE_MS = 24 * 60 * 60 * 1000
const CFG_CATEGORY = '_shopgrps'

const DEFAULT_GROUPS = [
  {
    id: 'kosgoete', label: 'Kos Goete', emoji: '🍎',
    tabs: [
      { id: 'kos',    label: 'Kos',       emoji: '🥦' },
      { id: 'ontbyt', label: 'Ontbyt',    emoji: '🥣' },
      { id: 'drink',  label: 'Drinkgoed', emoji: '🥤' },
      { id: 'blikke', label: 'Kosblikke', emoji: '🥫' },
    ]
  },
  {
    id: 'skoongoete', label: 'Skoonmaak Goete', emoji: '🧹',
    tabs: [
      { id: 'seep',  label: 'Seepgoete',      emoji: '🧼' },
      { id: 'girls', label: 'Girls Badkamer', emoji: '💅' },
      { id: 'ons',   label: 'Ons Badkamer',   emoji: '🚿' },
    ]
  },
  {
    id: 'andergoete', label: 'Ander Goete', emoji: '🔧',
    tabs: [
      { id: 'bederf',    label: 'Bederf Goete',    emoji: '🍫' },
      { id: 'niegirlie', label: 'Nie Girlie Goete', emoji: '🔧' },
    ]
  },
]

// Encode/decode item with optional photo+link
function decodeItem(raw) {
  try {
    const d = JSON.parse(raw)
    if (d && d._si === 1) return { name: d.n ?? '', link: d.l ?? null, image: d.i ?? null }
  } catch {}
  return { name: raw, link: null, image: null }
}

function encodeItem(name, link, image) {
  const n = name.trim()
  const l = link?.trim() || null
  const i = image || null
  if (!l && !i) return n
  return JSON.stringify({ _si: 1, n, l, i })
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

// Sort: unchecked A-Z first, then checked at bottom
function sortItems(rows) {
  const unchecked = rows
    .filter(r => !r.checked_at)
    .sort((a, b) => decodeItem(a.item_name).name.localeCompare(decodeItem(b.item_name).name, 'af'))
  const checked = rows
    .filter(r => r.checked_at)
    .sort((a, b) => Number(a.checked_at) - Number(b.checked_at))
  return [...unchecked, ...checked]
}

// Load custom group configs from DB
async function fetchCustomGroups() {
  const { data } = await supabase.from('shopping_items')
    .select('id, item_name, created_at')
    .eq('category', CFG_CATEGORY)
    .order('created_at', { ascending: true })
  if (!data) return []
  return data.flatMap(row => {
    try {
      const g = JSON.parse(row.item_name)
      if (g._cfg === 1) return [{ ...g, _rowId: row.id }]
    } catch {}
    return []
  })
}

// ─── Item card for tab view ────────────────────────────────────────────────────
function TabItemCard({ row, onToggle, onDelete, onRowUpdated }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const fileRef = useRef(null)

  const { name, link, image } = decodeItem(row.item_name)
  const isChecked = !!row.checked_at

  const [editName, setEditName] = useState(name)
  const [editLink, setEditLink] = useState(link ?? '')
  const [editPreview, setEditPreview] = useState(image ?? '')
  const [editFile, setEditFile] = useState(null)
  const [saving, setSaving] = useState(false)

  async function saveEdit() {
    if (!editName.trim()) return
    setSaving(true)
    let finalImage = editPreview || null
    if (editFile) finalImage = await compressToBase64(editFile)
    const encoded = encodeItem(editName, editLink, finalImage)
    const { data: updated } = await supabase.from('shopping_items')
      .update({ item_name: encoded })
      .eq('id', row.id)
      .select().single()
    if (updated) onRowUpdated(updated)
    setEditing(false)
    setOpen(true)
    setSaving(false)
  }

  if (isChecked) {
    return (
      <li className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-gray-100 opacity-50">
        <button onClick={() => onToggle(row)}
          className="w-6 h-6 rounded-lg border-2 border-green-500 bg-green-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-black">
          ✓
        </button>
        <span className="flex-1 line-through text-gray-400 font-bold">{name}</span>
        <button onClick={() => onDelete(row.id)} className="text-gray-300 font-black text-xl leading-none">×</button>
      </li>
    )
  }

  if (editing) {
    return (
      <li className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div>
          <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Naam</label>
          <input value={editName} onChange={e => setEditName(e.target.value)} className="input-field mt-1" autoFocus />
        </div>
        <div>
          <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Skakel (opsioneel)</label>
          <input type="url" value={editLink} onChange={e => setEditLink(e.target.value)}
            className="input-field mt-1" placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2 block">Foto (opsioneel)</label>
          {editPreview ? (
            <div className="relative">
              <img src={editPreview} alt="foto" className="w-full max-h-48 object-cover rounded-xl" />
              <button type="button" onClick={() => { setEditPreview(''); setEditFile(null) }}
                className="absolute top-2 right-2 bg-red-500 text-white w-7 h-7 rounded-full font-black flex items-center justify-center">×</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-400 flex flex-col items-center gap-1">
              <span className="text-2xl">📷</span>
              <span className="text-xs font-extrabold">Kies foto</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*"
            onChange={e => { const f = e.target.files[0]; if (f) { setEditFile(f); setEditPreview(URL.createObjectURL(f)) } }}
            className="hidden" />
        </div>
        <div className="flex gap-2">
          <button onClick={saveEdit} disabled={saving || !editName.trim()}
            className="flex-1 bg-green-500 text-white font-extrabold py-2.5 rounded-xl disabled:opacity-50">
            {saving ? 'Stoor…' : '💾 Stoor'}
          </button>
          <button onClick={() => setEditing(false)} className="flex-1 bg-gray-100 text-gray-600 font-extrabold py-2.5 rounded-xl">
            Kanselleer
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={() => onToggle(row)}
          className="w-6 h-6 rounded-lg border-2 border-gray-300 flex-shrink-0 active:border-green-400" />
        <span onClick={() => setOpen(o => !o)} className="flex-1 font-extrabold cursor-pointer select-none">{name}</span>
        {(link || image) && <span className="text-xs text-gray-400">{image ? '📷' : ''}{link ? '🔗' : ''}</span>}
        <span onClick={() => setOpen(o => !o)}
          className={`text-gray-400 font-black text-lg cursor-pointer transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
        <button onClick={() => onDelete(row.id)} className="text-gray-300 font-black text-xl leading-none pl-1">×</button>
      </div>
      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {image && (
            <img src={image} alt={name} className="w-full max-h-48 object-cover rounded-xl"
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

// ─── Shopping Tab Page (/shopping/:tabId) ──────────────────────────────────────
export function ShoppingTab() {
  const { tabId } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [tabInfo, setTabInfo] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLink, setNewLink] = useState('')
  const [newPreview, setNewPreview] = useState('')
  const [newFile, setNewFile] = useState(null)
  const [adding, setAdding] = useState(false)

  // Find tab label/emoji
  useEffect(() => {
    let found = null
    for (const g of DEFAULT_GROUPS) {
      found = g.tabs.find(t => t.id === tabId)
      if (found) break
    }
    if (found) {
      setTabInfo(found)
    } else {
      fetchCustomGroups().then(groups => {
        for (const g of groups) {
          const t = g.tabs?.find(t => t.id === tabId)
          if (t) { setTabInfo(t); break }
        }
      })
    }
  }, [tabId])

  // Load items + cleanup expired
  useEffect(() => {
    async function load() {
      const cutoff = Date.now() - EXPIRE_MS
      await supabase.from('shopping_items').delete()
        .eq('category', tabId).not('checked_at', 'is', null).lt('checked_at', cutoff)
      const { data } = await supabase.from('shopping_items').select('*').eq('category', tabId)
      setRows(data ?? [])
      setLoading(false)
    }
    load()

    const channel = supabase.channel(`shoptab-${tabId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopping_items', filter: `category=eq.${tabId}` },
        ({ new: row }) => setRows(prev => [...prev.filter(r => r.id !== row.id), row]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_items', filter: `category=eq.${tabId}` },
        ({ new: row }) => setRows(prev => prev.map(r => r.id === row.id ? row : r)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shopping_items', filter: `category=eq.${tabId}` },
        ({ old: row }) => setRows(prev => prev.filter(r => r.id !== row.id)))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [tabId])

  function resetForm() {
    setNewName(''); setNewLink(''); setNewPreview(''); setNewFile(null)
    setShowForm(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function addItem() {
    if (!newName.trim()) return
    setAdding(true)
    let finalImage = null
    if (newFile) finalImage = await compressToBase64(newFile)
    const encoded = encodeItem(newName, newLink, finalImage)
    const { data: row } = await supabase.from('shopping_items')
      .upsert({ category: tabId, item_name: encoded, checked_at: null }, { onConflict: 'category,item_name' })
      .select().single()
    if (row) setRows(prev => [...prev.filter(r => r.id !== row.id), row])
    resetForm()
    setAdding(false)
  }

  async function toggleItem(row) {
    const { data: updated } = await supabase.from('shopping_items')
      .update({ checked_at: row.checked_at ? null : Date.now() })
      .eq('id', row.id).select().single()
    if (updated) setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  async function deleteItem(id) {
    await supabase.from('shopping_items').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const sorted = sortItems(rows)

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/shopping')}
          className="bg-gray-100 text-gray-500 font-extrabold text-sm px-3 py-2 rounded-xl">
          ← Terug
        </button>
        <span className="text-3xl">{tabInfo?.emoji ?? '🛒'}</span>
        <h2 className="text-2xl font-black">{tabInfo?.label ?? '...'}</h2>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full bg-green-50 border-2 border-dashed border-green-200 rounded-2xl py-4 text-green-600 font-extrabold text-sm mb-4 active:scale-95 transition-transform">
          ＋ Voeg item by
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 space-y-3 mb-4">
          <div>
            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Naam *</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !newLink && !newPreview && addItem()}
              className="input-field mt-1" autoFocus placeholder="Voeg naam by…" />
          </div>
          <div>
            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Skakel (opsioneel)</label>
            <input type="url" value={newLink} onChange={e => setNewLink(e.target.value)}
              className="input-field mt-1" placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-2 block">Foto (opsioneel)</label>
            {newPreview ? (
              <div className="relative">
                <img src={newPreview} alt="foto" className="w-full max-h-48 object-cover rounded-xl" />
                <button type="button" onClick={() => { setNewPreview(''); setNewFile(null) }}
                  className="absolute top-2 right-2 bg-red-500 text-white w-7 h-7 rounded-full font-black flex items-center justify-center">×</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-400 flex flex-col items-center gap-1">
                <span className="text-2xl">📷</span>
                <span className="text-xs font-extrabold">Kies foto van foon</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*"
              onChange={e => { const f = e.target.files[0]; if (f) { setNewFile(f); setNewPreview(URL.createObjectURL(f)) } }}
              className="hidden" />
          </div>
          <div className="flex gap-2">
            <button onClick={addItem} disabled={adding || !newName.trim()}
              className="flex-1 bg-green-500 text-white font-extrabold py-2.5 rounded-xl disabled:opacity-50">
              {adding ? 'Stoor…' : '＋ Voeg by'}
            </button>
            <button onClick={resetForm} className="flex-1 bg-gray-100 text-gray-600 font-extrabold py-2.5 rounded-xl">
              Kanselleer
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-gray-400 font-bold animate-pulse">Laai…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📝</p>
          <p className="font-extrabold text-sm">Nog geen items nie</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map(row => (
            <TabItemCard key={row.id} row={row}
              onToggle={toggleItem}
              onDelete={deleteItem}
              onRowUpdated={updated => setRows(prev => prev.map(r => r.id === updated.id ? updated : r))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Main Shopping List overview ───────────────────────────────────────────────
export default function ShoppingList() {
  const navigate = useNavigate()
  const [customGroups, setCustomGroups] = useState([])
  const [counts, setCounts] = useState({})
  const [openGroups, setOpenGroups] = useState({ kosgoete: true })
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showAddTab, setShowAddTab] = useState(null) // groupId
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [newGroupEmoji, setNewGroupEmoji] = useState('')
  const [newTabLabel, setNewTabLabel] = useState('')
  const [newTabEmoji, setNewTabEmoji] = useState('')

  useEffect(() => {
    fetchCustomGroups().then(setCustomGroups)
    refreshCounts()

    const cfgChannel = supabase.channel('shop-cfg')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `category=eq.${CFG_CATEGORY}` },
        () => fetchCustomGroups().then(setCustomGroups))
      .subscribe()

    const countChannel = supabase.channel('shop-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' },
        () => refreshCounts())
      .subscribe()

    return () => { supabase.removeChannel(cfgChannel); supabase.removeChannel(countChannel) }
  }, [])

  async function refreshCounts() {
    const { data } = await supabase.from('shopping_items')
      .select('category').is('checked_at', null)
    if (!data) return
    const map = {}
    data.forEach(({ category }) => {
      if (!category.startsWith('_')) map[category] = (map[category] ?? 0) + 1
    })
    setCounts(map)
  }

  const allGroups = [...DEFAULT_GROUPS, ...customGroups]

  async function createGroup() {
    if (!newGroupLabel.trim()) return
    const groupId = `g_${Date.now()}`
    const config = { _cfg: 1, id: groupId, label: newGroupLabel.trim(), emoji: newGroupEmoji.trim() || '📦', tabs: [] }
    await supabase.from('shopping_items').insert({
      category: CFG_CATEGORY, item_name: JSON.stringify(config), checked_at: null
    })
    setNewGroupLabel(''); setNewGroupEmoji(''); setShowAddGroup(false)
  }

  async function createTab(group) {
    if (!newTabLabel.trim()) return
    const tabId = `t_${Date.now()}`
    const updatedTabs = [...(group.tabs ?? []), { id: tabId, label: newTabLabel.trim(), emoji: newTabEmoji.trim() || '📋' }]
    const newConfig = { _cfg: 1, id: group.id, label: group.label, emoji: group.emoji, tabs: updatedTabs }
    await supabase.from('shopping_items').update({ item_name: JSON.stringify(newConfig) }).eq('id', group._rowId)
    setNewTabLabel(''); setNewTabEmoji(''); setShowAddTab(null)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-3xl">🛒</span>
        <h2 className="text-2xl font-black">Inkopielys</h2>
      </div>

      <div className="space-y-3">
        {allGroups.map(group => (
          <div key={group.id} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => setOpenGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-100">
              <span className="text-2xl">{group.emoji}</span>
              <span className="flex-1 font-extrabold text-base">{group.label}</span>
              <span className={`text-gray-400 font-black text-xl transition-transform duration-200 ${openGroups[group.id] ? 'rotate-90' : ''}`}>›</span>
            </button>

            {openGroups[group.id] && (
              <div className="px-3 pb-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {group.tabs.map(tab => (
                    <button key={tab.id} onClick={() => navigate(`/shopping/${tab.id}`)}
                      className="relative flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-2xl bg-white shadow-sm border border-gray-100 font-extrabold text-[11px] text-center leading-tight active:scale-95 active:bg-green-50 active:text-green-700 transition-all">
                      <span className="text-2xl">{tab.emoji}</span>
                      <span>{tab.label}</span>
                      {(counts[tab.id] ?? 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 leading-none">
                          {counts[tab.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Add tab button — only for custom groups */}
                {group._rowId && (
                  showAddTab === group.id ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                      <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Nuwe knoppie</p>
                      <div className="flex gap-2">
                        <input value={newTabEmoji} onChange={e => setNewTabEmoji(e.target.value)}
                          placeholder="📋" className="input-field w-14 text-center text-xl" maxLength={2} />
                        <input value={newTabLabel} onChange={e => setNewTabLabel(e.target.value)}
                          placeholder="Naam" className="input-field flex-1" autoFocus />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => createTab(group)} disabled={!newTabLabel.trim()}
                          className="flex-1 bg-green-500 text-white font-extrabold py-2 rounded-xl text-sm disabled:opacity-50">
                          Voeg by
                        </button>
                        <button onClick={() => setShowAddTab(null)}
                          className="flex-1 bg-gray-100 text-gray-600 font-extrabold py-2 rounded-xl text-sm">
                          Kanselleer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddTab(group.id)}
                      className="w-full text-xs text-gray-400 font-extrabold py-2 border-2 border-dashed border-gray-200 rounded-xl active:border-green-300 active:text-green-600 transition-colors">
                      ＋ Knoppie byvoeg
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add custom group */}
        {showAddGroup ? (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4 space-y-3">
            <p className="font-extrabold text-sm text-gray-700">Nuwe Groep</p>
            <div className="flex gap-2">
              <input value={newGroupEmoji} onChange={e => setNewGroupEmoji(e.target.value)}
                placeholder="📦" className="input-field w-14 text-center text-2xl" maxLength={2} />
              <input value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)}
                placeholder="Groep naam" className="input-field flex-1" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={createGroup} disabled={!newGroupLabel.trim()}
                className="flex-1 bg-green-500 text-white font-extrabold py-2.5 rounded-xl disabled:opacity-50">
                Skep Groep
              </button>
              <button onClick={() => setShowAddGroup(false)}
                className="flex-1 bg-gray-100 text-gray-600 font-extrabold py-2.5 rounded-xl">
                Kanselleer
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddGroup(true)}
            className="w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl py-4 text-gray-400 font-extrabold text-sm active:border-green-300 active:text-green-600 transition-colors">
            ＋ Nuwe groep byvoeg
          </button>
        )}
      </div>
    </div>
  )
}
