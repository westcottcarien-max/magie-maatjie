import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EXPIRE_MS = 24 * 60 * 60 * 1000

const TABS = [
  { id: 'kos',     label: 'Kos Goete',        emoji: '🥦' },
  { id: 'ontbyt',  label: 'Ontbyt Kos',        emoji: '🥞' },
  { id: 'blikke',  label: 'Kosblikke',         emoji: '🥫' },
  { id: 'drink',   label: 'Drinkgoed',         emoji: '🧃' },
  { id: 'seep',    label: 'Seep Goete',        emoji: '🧼' },
  { id: 'girls',   label: 'Girls Badkamer',    emoji: '💅' },
  { id: 'ons',     label: 'Ons Badkamer',      emoji: '🚿' },
  { id: 'bederf',  label: 'Bederf Goete',      emoji: '🍫' },
  { id: 'oops',    label: 'Oops Dit Is Klaar', emoji: '🙈' },
]

function isFresh(ts) {
  return typeof ts === 'number' && Date.now() - ts <= EXPIRE_MS
}

function aggregateIngredients(planMeals) {
  const seen = new Set()
  const items = []
  planMeals.forEach(pm => {
    pm.meals?.ingredients?.forEach(ing => {
      const key = ing.item_name.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        items.push(ing.item_name)
      }
    })
  })
  return items.sort((a, b) => a.localeCompare(b))
}

// KOS GOETE: ingredient list from the active plan, checked state in Supabase
function KosTab({ planLabel }) {
  const [ingredients, setIngredients] = useState([])
  const [dbItems, setDbItems] = useState([]) // shopping_items rows for category='kos'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Load plan ingredients
      const { data: planData } = await supabase
        .from('weekly_plans')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planData) {
        const { data: pmData } = await supabase
          .from('plan_meals')
          .select('meal_id, meals(name, ingredients(item_name))')
          .eq('plan_id', planData.id)
          .not('meal_id', 'is', null)
        setIngredients(aggregateIngredients(pmData ?? []))
      }

      // Load checked state from DB, delete expired
      const expiryCutoff = Date.now() - EXPIRE_MS
      await supabase
        .from('shopping_items')
        .delete()
        .eq('category', 'kos')
        .not('checked_at', 'is', null)
        .lt('checked_at', expiryCutoff)

      const { data: rows } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('category', 'kos')
      setDbItems(rows ?? [])
      setLoading(false)
    }
    load()

    // Realtime subscription
    const channel = supabase
      .channel('kos-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: 'category=eq.kos' }, () => {
        supabase.from('shopping_items').select('*').eq('category', 'kos').then(({ data }) => setDbItems(data ?? []))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function toggleItem(itemName) {
    const key = itemName.toLowerCase()
    const existing = dbItems.find(r => r.item_name.toLowerCase() === key)
    const currentlyChecked = existing && isFresh(existing.checked_at)

    if (currentlyChecked) {
      // Untick
      await supabase
        .from('shopping_items')
        .update({ checked_at: null })
        .eq('id', existing.id)
    } else if (existing) {
      // Re-tick
      await supabase
        .from('shopping_items')
        .update({ checked_at: Date.now() })
        .eq('id', existing.id)
    } else {
      // First tick — insert row
      await supabase
        .from('shopping_items')
        .insert({ category: 'kos', item_name: itemName, checked_at: Date.now() })
    }
  }

  async function clearChecked() {
    await supabase
      .from('shopping_items')
      .delete()
      .eq('category', 'kos')
      .not('checked_at', 'is', null)
  }

  if (loading) return <p className="text-center py-12 text-gray-400 font-bold animate-pulse">Laai bestanddele…</p>

  if (ingredients.length === 0) return (
    <div className="text-center py-20">
      <p className="text-6xl mb-4">🛒</p>
      <p className="font-black text-lg text-gray-700">Nog geen bestanddele nie!</p>
      <p className="text-sm text-gray-400 font-semibold mt-1">
        Stoor eers 'n week se etes plan om jou inkopielys te genereer.
      </p>
    </div>
  )

  const checkedMap = Object.fromEntries(dbItems.map(r => [r.item_name.toLowerCase(), r]))
  const unchecked = ingredients.filter(n => !isFresh(checkedMap[n.toLowerCase()]?.checked_at))
  const done = ingredients.filter(n => isFresh(checkedMap[n.toLowerCase()]?.checked_at))

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-extrabold text-gray-600 uppercase tracking-wide">Bestanddele</p>
        {done.length > 0 && (
          <button onClick={clearChecked} className="text-xs bg-red-50 text-red-400 font-extrabold px-3 py-1.5 rounded-xl">
            🔄 Vee merke uit
          </button>
        )}
      </div>
      {unchecked.length > 0 && (
        <p className="text-xs text-gray-400 font-bold mb-3">{unchecked.length} item{unchecked.length !== 1 ? 's' : ''} oor</p>
      )}
      <ul className="space-y-2 mb-6">
        {unchecked.map(name => (
          <li key={name} onClick={() => toggleItem(name)}
            className="flex items-center gap-3 bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-3.5 cursor-pointer select-none active:scale-98 transition-transform">
            <span className="w-6 h-6 rounded-lg border-2 border-gray-300 flex-shrink-0" />
            <span className="flex-1 font-extrabold">{name}</span>
            <span className="text-gray-300">›</span>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">✅ In mandjie / het reeds</p>
          <ul className="space-y-2">
            {done.map(name => (
              <li key={name} onClick={() => toggleItem(name)}
                className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3.5 cursor-pointer select-none opacity-50">
                <span className="w-6 h-6 rounded-lg border-2 border-green-500 bg-green-500 flex-shrink-0 flex items-center justify-center text-white text-sm font-black">✓</span>
                <span className="flex-1 line-through text-gray-400 font-bold">{name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

// Manual lists: items stored fully in Supabase with realtime sync
function ManualList({ categoryId }) {
  const [rows, setRows] = useState([])
  const [newItem, setNewItem] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Delete expired checked items on mount
      const expiryCutoff = Date.now() - EXPIRE_MS
      await supabase
        .from('shopping_items')
        .delete()
        .eq('category', categoryId)
        .not('checked_at', 'is', null)
        .lt('checked_at', expiryCutoff)

      const { data } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('category', categoryId)
        .order('created_at', { ascending: true })
      setRows(data ?? [])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`manual-${categoryId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `category=eq.${categoryId}` }, () => {
        supabase
          .from('shopping_items')
          .select('*')
          .eq('category', categoryId)
          .order('created_at', { ascending: true })
          .then(({ data }) => setRows(data ?? []))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [categoryId])

  async function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed) return
    setNewItem('')
    await supabase
      .from('shopping_items')
      .upsert({ category: categoryId, item_name: trimmed, checked_at: null }, { onConflict: 'category,item_name' })
  }

  async function removeItem(id) {
    await supabase.from('shopping_items').delete().eq('id', id)
  }

  async function toggleItem(row) {
    const currentlyChecked = isFresh(row.checked_at)
    await supabase
      .from('shopping_items')
      .update({ checked_at: currentlyChecked ? null : Date.now() })
      .eq('id', row.id)
  }

  if (loading) return <p className="text-center py-12 text-gray-400 font-bold animate-pulse">Laai lys…</p>

  const unchecked = rows.filter(r => !isFresh(r.checked_at))
  const done = rows.filter(r => isFresh(r.checked_at))

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Voeg item by…"
          className="input-field flex-1"
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim()}
          className="shrink-0 bg-green-500 text-white w-11 rounded-xl font-extrabold text-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          +
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-black text-gray-700">Nog geen items nie</p>
          <p className="text-sm text-gray-400 font-semibold mt-1">Tik 'n item hierbo en druk +</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 mb-4">
            {unchecked.map(row => (
              <li key={row.id} className="flex items-center gap-3 bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-3.5">
                <span onClick={() => toggleItem(row)} className="w-6 h-6 rounded-lg border-2 border-gray-300 flex-shrink-0 cursor-pointer" />
                <span onClick={() => toggleItem(row)} className="flex-1 font-extrabold cursor-pointer select-none">{row.item_name}</span>
                <button onClick={() => removeItem(row.id)} className="text-gray-300 hover:text-red-400 font-black text-xl leading-none transition-colors">×</button>
              </li>
            ))}
          </ul>
          {done.length > 0 && (
            <>
              <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">✅ Gekoop</p>
              <ul className="space-y-2">
                {done.map(row => (
                  <li key={row.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3.5 opacity-50">
                    <span onClick={() => toggleItem(row)} className="w-6 h-6 rounded-lg border-2 border-green-500 bg-green-500 flex-shrink-0 flex items-center justify-center text-white text-sm font-black cursor-pointer">✓</span>
                    <span onClick={() => toggleItem(row)} className="flex-1 line-through text-gray-400 font-bold cursor-pointer select-none">{row.item_name}</span>
                    <button onClick={() => removeItem(row.id)} className="text-gray-300 hover:text-red-400 font-black text-xl leading-none transition-colors">×</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function ShoppingList() {
  const [activeTab, setActiveTab] = useState(null)
  const [planLabel, setPlanLabel] = useState('')

  useEffect(() => {
    supabase
      .from('weekly_plans')
      .select('week_label')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setPlanLabel(data.week_label ?? '') })
  }, [])

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl">🛒</span>
        <div>
          <h2 className="text-2xl font-black">Inkopielys</h2>
          {planLabel && <p className="text-xs text-green-700 font-bold">{planLabel}</p>}
        </div>
      </div>

      {/* All category buttons in a 3×3 grid */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(prev => prev === tab.id ? null : tab.id)}
            className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-2xl font-extrabold text-[11px] text-center leading-tight transition-all active:scale-95 ${
              activeTab === tab.id
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className="text-2xl">{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'kos' && <KosTab key="kos" planLabel={planLabel} />}
      {activeTab && activeTab !== 'kos' && <ManualList key={activeTab} categoryId={activeTab} />}
    </div>
  )
}
