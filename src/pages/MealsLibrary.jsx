import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function decodeMealNotes(raw) {
  if (!raw) return { text: '', image: null, recipe: null }
  try {
    const d = JSON.parse(raw)
    if (d && d._v === 1) return { text: d.t ?? '', image: d.i ?? null, recipe: d.r ?? null }
  } catch {}
  return { text: raw, image: null, recipe: null }
}

export default function MealsLibrary() {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [detailCache, setDetailCache] = useState({})
  const [loadingDetail, setLoadingDetail] = useState(null)

  async function fetchMeals() {
    const { data } = await supabase
      .from('meals')
      .select('id, name, notes, ingredients(id)')
      .order('created_at', { ascending: false })
    setMeals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchMeals() }, [])

  async function toggleExpand(meal) {
    if (expandedId === meal.id) { setExpandedId(null); return }
    setExpandedId(meal.id)
    if (detailCache[meal.id]) return
    setLoadingDetail(meal.id)
    const { data: ings } = await supabase
      .from('ingredients')
      .select('item_name')
      .eq('meal_id', meal.id)
      .order('sort_order')
    setDetailCache(prev => ({ ...prev, [meal.id]: ings ?? [] }))
    setLoadingDetail(null)
  }

  async function deleteMeal(id) {
    if (!confirm('Verwyder hierdie maaltyd? Dit kan nie ontdaan word nie.')) return
    setDeleting(id)
    await supabase.from('meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
    setDeleting(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 font-bold">
      <span className="animate-pulse">Laai maaltye… 🍽️</span>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black">My Maaltye</h2>
          <p className="text-xs text-gray-400 font-bold">{meals.length} maaltyd{meals.length !== 1 ? 'e' : ''} gestoor</p>
        </div>
        <Link
          to="/meals/add"
          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2.5 rounded-2xl text-sm font-extrabold shadow-md active:scale-95 transition-transform"
        >
          ＋ Voeg by
        </Link>
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">🍳</p>
          <p className="font-black text-lg text-gray-700">Nog geen maaltye nie!</p>
          <p className="text-sm text-gray-400 font-semibold mt-1">Tik "＋ Voeg by" om te begin.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {meals.map((meal, idx) => {
            const colors = ['border-l-green-400','border-l-emerald-400','border-l-teal-400','border-l-cyan-400','border-l-lime-400']
            const color = colors[idx % colors.length]
            const isOpen = expandedId === meal.id
            const ingredients = detailCache[meal.id] ?? []
            const isLoadingThis = loadingDetail === meal.id
            const { text: notesText, image: mealImage, recipe: mealRecipe } = decodeMealNotes(meal.notes)

            return (
              <li key={meal.id} className={`bg-white rounded-2xl shadow-md border border-gray-100 border-l-4 ${color} overflow-hidden`}>
                {/* Header row — tap to expand */}
                <div
                  className="flex items-center gap-3 px-4 py-4 cursor-pointer select-none active:bg-gray-50"
                  onClick={() => toggleExpand(meal)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-base">{meal.name}</p>
                    <p className="text-xs text-gray-400 font-bold mt-0.5">
                      🥬 {meal.ingredients?.length ?? 0} bestanddeel{meal.ingredients?.length !== 1 ? 'e' : ''}
                    </p>
                  </div>
                  <span className={`text-gray-400 font-black text-lg transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {isLoadingThis ? (
                      <p className="text-sm text-gray-400 animate-pulse text-center py-2">Laai…</p>
                    ) : (
                      <>
                        {ingredients.length > 0 && (
                          <div>
                            <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Bestanddele</p>
                            <ul className="space-y-1">
                              {ingredients.map((ing, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                  {ing.item_name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {notesText && (
                          <div>
                            <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Notas</p>
                            <p className="text-sm text-gray-600 font-medium">{notesText}</p>
                          </div>
                        )}

                        {mealImage && (
                          <img
                            src={mealImage}
                            alt={meal.name}
                            className="w-full max-h-64 object-cover rounded-2xl"
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        )}

                        <div className="flex gap-2 flex-wrap pt-1">
                          {mealRecipe && (
                            <a
                              href={mealRecipe}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-xs bg-blue-50 text-blue-600 font-extrabold px-3 py-1.5 rounded-xl"
                            >
                              🔗 Resep
                            </a>
                          )}
                          <Link
                            to={`/meals/${meal.id}/edit`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs bg-green-50 text-green-700 font-extrabold px-3 py-1.5 rounded-xl"
                          >
                            ✏️ Wysig
                          </Link>
                          <button
                            onClick={e => { e.stopPropagation(); deleteMeal(meal.id) }}
                            disabled={deleting === meal.id}
                            className="text-xs bg-red-50 text-red-500 font-extrabold px-3 py-1.5 rounded-xl disabled:opacity-40"
                          >
                            {deleting === meal.id ? '…' : '🗑️ Skrap'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
