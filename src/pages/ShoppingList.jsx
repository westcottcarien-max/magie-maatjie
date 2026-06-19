import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const KOS_CHECKED_KEY = 'shopping-kos-checked'

const TABS = [
  { id: 'kos',    label: 'Kos Goete',          emoji: '🥦' },
  { id: 'seep',   label: 'Seep Goete',          emoji: '🧼' },
  { id: 'girls',  label: 'Girls Badkamer',       emoji: '💅' },
  { id: 'ons',    label: 'Ons Badkamer',         emoji: '🚿' },
  { id: 'bederf', label: 'Bederf Goete',         emoji: '🍫' },
]

function aggregateIngredients(meals) {
  const seen = new Set()
  const items = []
  meals.forEach(meal => {
    meal.ingredients?.forEach(ing => {
      const key = ing.item_name.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        items.push({ item_name: ing.item_name })
      }
    })
  })
  return items.sort((a, b) => a.item_name.localeCompare(b.item_name))
}

function ManualList({ categoryId }) {
  const itemsKey = `shopping-${categoryId}-items`
  const checkedKey = `shopping-${categoryId}-checked`

  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(itemsKey) ?? '[]') } catch { return [] }
  })
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(checkedKey) ?? '{}') } catch { return {} }
  })
  const [newItem, setNewItem] = useState('')

  function addItem() {
    const trimmed = newItem.trim()
    if (!trimmed) return
    const updated = [...items, trimmed]
    setItems(updated)
    localStorage.setItem(itemsKey, JSON.stringify(updated))
    setNewItem('')
  }

  function removeItem(item) {
    const updated = items.filter(i => i !== item)
    setItems(updated)
    localStorage.setItem(itemsKey, JSON.stringify(updated))
    const next = { ...checked }
    delete next[item.toLowerCase()]
    setChecked(next)
    localStorage.setItem(checkedKey, JSON.stringify(next))
  }

  function toggleItem(item) {
    const key = item.toLowerCase()
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    localStorage.setItem(checkedKey, JSON.stringify(next))
  }

  const unchecked = items.filter(i => !checked[i.toLowerCase()])
  const done = items.filter(i => checked[i.toLowerCase()])

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

      {items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-black text-gray-700">Nog geen items nie</p>
          <p className="text-sm text-gray-400 font-semibold mt-1">Tik 'n item hierbo en druk +</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 mb-4">
            {unchecked.map(item => (
              <li
                key={item}
                className="flex items-center gap-3 bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-3.5"
              >
                <span
                  onClick={() => toggleItem(item)}
                  className="w-6 h-6 rounded-lg border-2 border-gray-300 flex-shrink-0 cursor-pointer"
                />
                <span
                  onClick={() => toggleItem(item)}
                  className="flex-1 font-extrabold cursor-pointer select-none"
                >
                  {item}
                </span>
                <button
                  onClick={() => removeItem(item)}
                  className="text-gray-300 hover:text-red-400 font-black text-xl leading-none transition-colors"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {done.length > 0 && (
            <>
              <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">✅ Gekoop</p>
              <ul className="space-y-2">
                {done.map(item => (
                  <li
                    key={item}
                    className="flex items-center gap-3 bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3.5 opacity-50"
                  >
                    <span
                      onClick={() => toggleItem(item)}
                      className="w-6 h-6 rounded-lg border-2 border-green-500 bg-green-500 flex-shrink-0 flex items-center justify-center text-white text-sm font-black cursor-pointer"
                    >✓</span>
                    <span
                      onClick={() => toggleItem(item)}
                      className="flex-1 line-through text-gray-400 font-bold cursor-pointer select-none"
                    >
                      {item}
                    </span>
                    <button
                      onClick={() => removeItem(item)}
                      className="text-gray-300 hover:text-red-400 font-black text-xl leading-none transition-colors"
                    >
                      ×
                    </button>
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
  const [activeTab, setActiveTab] = useState('kos')
  const [allMeals, setAllMeals] = useState([])
  const [selectedMealIds, setSelectedMealIds] = useState(new Set())
  const [kosItems, setKosItems] = useState([])
  const [kosChecked, setKosChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KOS_CHECKED_KEY) ?? '{}') } catch { return {} }
  })
  const [loading, setLoading] = useState(true)
  const [listGenerated, setListGenerated] = useState(false)
  const [planLabel, setPlanLabel] = useState('')

  useEffect(() => {
    async function load() {
      const { data: mealData } = await supabase
        .from('meals')
        .select('id, name, ingredients(item_name)')
        .order('name')
      const meals = mealData ?? []
      setAllMeals(meals)

      const { data: planData } = await supabase
        .from('weekly_plans')
        .select('id, week_label')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planData) {
        setPlanLabel(planData.week_label ?? '')
        const { data: pmData } = await supabase
          .from('plan_meals')
          .select('meal_id')
          .eq('plan_id', planData.id)
          .not('meal_id', 'is', null)

        const planMealIds = new Set(pmData?.map(pm => pm.meal_id) ?? [])
        setSelectedMealIds(planMealIds)

        if (planMealIds.size > 0) {
          const selected = meals.filter(m => planMealIds.has(m.id))
          setKosItems(aggregateIngredients(selected))
          setListGenerated(true)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  function toggleMeal(id) {
    setSelectedMealIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function generateList() {
    const selected = allMeals.filter(m => selectedMealIds.has(m.id))
    setKosItems(aggregateIngredients(selected))
    setListGenerated(true)
    setKosChecked({})
    localStorage.removeItem(KOS_CHECKED_KEY)
  }

  function toggleKosItem(key) {
    setKosChecked(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(KOS_CHECKED_KEY, JSON.stringify(next))
      return next
    })
  }

  function clearKosChecked() {
    setKosChecked({})
    localStorage.removeItem(KOS_CHECKED_KEY)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 font-bold animate-pulse">
      Laai inkopielys… 🛒
    </div>
  )

  const kosUnchecked = kosItems.filter(item => !kosChecked[item.item_name.toLowerCase()])
  const kosDone = kosItems.filter(item => kosChecked[item.item_name.toLowerCase()])

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl">🛒</span>
        <div>
          <h2 className="text-2xl font-black">Inkopielys</h2>
          {planLabel && <p className="text-xs text-green-700 font-bold">{planLabel}</p>}
        </div>
      </div>

      {/* Scrollable tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-extrabold text-xs transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* KOS GOETE */}
      {activeTab === 'kos' && (
        <>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold text-blue-800">
                Kies maaltye ({selectedMealIds.size} gekies)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMealIds(new Set(allMeals.map(m => m.id)))}
                  className="text-xs text-blue-600 font-bold"
                >
                  Alles
                </button>
                <span className="text-blue-300">|</span>
                <button
                  onClick={() => setSelectedMealIds(new Set())}
                  className="text-xs text-blue-600 font-bold"
                >
                  Geen
                </button>
              </div>
            </div>

            {planLabel && (
              <p className="text-xs text-blue-600 font-semibold mb-3 bg-blue-100 px-2 py-1 rounded-lg inline-block">
                📅 Week plan maaltye is vooraf gemerk
              </p>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {allMeals.map(meal => {
                const isSelected = selectedMealIds.has(meal.id)
                return (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => toggleMeal(meal.id)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all ${
                      isSelected ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center text-white text-xs font-black transition-all ${
                      isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                    }`}>
                      {isSelected && '✓'}
                    </span>
                    <span className="font-bold text-sm">{meal.name}</span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={generateList}
              disabled={selectedMealIds.size === 0}
              className="btn-primary disabled:opacity-50 mt-4"
            >
              🛒 Genereer Inkopielys
            </button>
          </div>

          {listGenerated && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-extrabold text-gray-600 uppercase tracking-wide">Bestanddele</p>
                {kosDone.length > 0 && (
                  <button
                    onClick={clearKosChecked}
                    className="text-xs bg-red-50 text-red-400 font-extrabold px-3 py-1.5 rounded-xl"
                  >
                    🔄 Vee merke uit
                  </button>
                )}
              </div>

              {kosUnchecked.length > 0 && (
                <p className="text-xs text-gray-400 font-bold mb-3">
                  {kosUnchecked.length} item{kosUnchecked.length !== 1 ? 's' : ''} oor
                </p>
              )}

              {kosItems.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">🤷</p>
                  <p className="font-black text-gray-700">Geen bestanddele gevind nie</p>
                  <p className="text-sm text-gray-400 font-semibold mt-1">Die gekose maaltye het geen bestanddele nie.</p>
                </div>
              ) : (
                <>
                  <ul className="space-y-2 mb-6">
                    {kosUnchecked.map(item => {
                      const key = item.item_name.toLowerCase()
                      return (
                        <li
                          key={key}
                          onClick={() => toggleKosItem(key)}
                          className="flex items-center gap-3 bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-3.5 cursor-pointer select-none active:scale-98 transition-transform"
                        >
                          <span className="w-6 h-6 rounded-lg border-2 border-gray-300 flex-shrink-0" />
                          <span className="flex-1 font-extrabold">{item.item_name}</span>
                          <span className="text-gray-300">›</span>
                        </li>
                      )
                    })}
                  </ul>
                  {kosDone.length > 0 && (
                    <>
                      <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                        ✅ In mandjie / het reeds
                      </p>
                      <ul className="space-y-2">
                        {kosDone.map(item => {
                          const key = item.item_name.toLowerCase()
                          return (
                            <li
                              key={key}
                              onClick={() => toggleKosItem(key)}
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
            </>
          )}
        </>
      )}

      {/* Manual list tabs */}
      {activeTab !== 'kos' && <ManualList categoryId={activeTab} />}
    </div>
  )
}
