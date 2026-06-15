import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'shopping-checked'

function aggregateIngredients(planMeals) {
  const seen = new Set()
  const items = []
  planMeals.forEach(pm => {
    pm.meals?.ingredients?.forEach(ing => {
      const key = ing.item_name.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        items.push({ item_name: ing.item_name })
      }
    })
  })
  return items.sort((a, b) => a.item_name.localeCompare(b.item_name))
}

export default function ShoppingList() {
  const [items, setItems] = useState([])
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  })
  const [loading, setLoading] = useState(true)
  const [planLabel, setPlanLabel] = useState('')

  useEffect(() => {
    async function load() {
      const { data: planData } = await supabase
        .from('weekly_plans')
        .select('id, week_label')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!planData) { setLoading(false); return }
      setPlanLabel(planData.week_label ?? '')

      const { data: pmData } = await supabase
        .from('plan_meals')
        .select('meal_id, meals(name, ingredients(item_name))')
        .eq('plan_id', planData.id)
        .not('meal_id', 'is', null)

      setItems(aggregateIngredients(pmData ?? []))
      setLoading(false)
    }
    load()
  }, [])

  function toggleItem(key) {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function clearChecked() {
    setChecked({})
    localStorage.removeItem(STORAGE_KEY)
  }

  const unchecked = items.filter(item => !checked[item.item_name.toLowerCase()])
  const done = items.filter(item => checked[item.item_name.toLowerCase()])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 font-bold animate-pulse">
      Laai inkopielys… 🛒
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🛒</span>
          <div>
            <h2 className="text-2xl font-black">Inkopielys</h2>
            {planLabel && <p className="text-xs text-green-700 font-bold">{planLabel}</p>}
          </div>
        </div>
        {done.length > 0 && (
          <button
            onClick={clearChecked}
            className="text-xs bg-red-50 text-red-400 font-extrabold px-3 py-1.5 rounded-xl"
          >
            🔄 Vee merke uit
          </button>
        )}
      </div>

      {unchecked.length > 0 && (
        <p className="text-xs text-gray-400 font-bold mb-3">
          {unchecked.length} item{unchecked.length !== 1 ? 's' : ''} oor
        </p>
      )}

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">🛒</p>
          <p className="font-black text-lg text-gray-700">Nog geen bestanddele nie!</p>
          <p className="text-sm text-gray-400 font-semibold mt-1">Stoor 'n weeklikse plan om jou inkopielys te genereer.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 mb-6">
            {unchecked.map(item => {
              const key = item.item_name.toLowerCase()
              return (
                <li
                  key={key}
                  onClick={() => toggleItem(key)}
                  className="flex items-center gap-3 bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-3.5 cursor-pointer select-none active:scale-98 transition-transform"
                >
                  <span className="w-6 h-6 rounded-lg border-2 border-gray-300 flex-shrink-0" />
                  <span className="flex-1 font-extrabold">{item.item_name}</span>
                  <span className="text-gray-300">›</span>
                </li>
              )
            })}
          </ul>

          {done.length > 0 && (
            <>
              <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                ✅ In mandjie / het reeds
              </p>
              <ul className="space-y-2">
                {done.map(item => {
                  const key = item.item_name.toLowerCase()
                  return (
                    <li
                      key={key}
                      onClick={() => toggleItem(key)}
                      className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3.5 cursor-pointer select-none opacity-50"
                    >
                      <span className="w-6 h-6 rounded-lg border-2 border-green-500 bg-green-500 flex-shrink-0 flex items-center justify-center text-white text-sm font-black">✓</span>
                      <span className="flex-1 line-through text-gray-400 font-bold">{item.item_name}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
