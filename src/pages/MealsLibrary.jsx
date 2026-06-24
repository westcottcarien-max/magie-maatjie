import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MealsLibrary() {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [expandedPhoto, setExpandedPhoto] = useState(null)

  async function fetchMeals() {
    // Try with new columns first; fall back if they don't exist in DB yet
    let { data, error } = await supabase
      .from('meals')
      .select('id, name, notes, recipe_url, image_url, ingredients(id)')
      .order('created_at', { ascending: false })
    if (error) {
      const fallback = await supabase
        .from('meals')
        .select('id, name, notes, ingredients(id)')
        .order('created_at', { ascending: false })
      data = fallback.data
    }
    setMeals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchMeals() }, [])

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
            return (
              <li key={meal.id} className={`bg-white rounded-2xl shadow-md border border-gray-100 border-l-4 ${color} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-base truncate">{meal.name}</p>
                    <p className="text-xs text-gray-400 font-bold mt-0.5">
                      🥬 {meal.ingredients?.length ?? 0} bestanddeel{meal.ingredients?.length !== 1 ? 'e' : ''}
                    </p>
                    {meal.notes && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2 font-medium">{meal.notes}</p>
                    )}
                    {(meal.recipe_url || meal.image_url) && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {meal.recipe_url && (
                          <a
                            href={meal.recipe_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-blue-50 text-blue-600 font-extrabold px-3 py-1.5 rounded-xl"
                          >
                            🔗 Resep
                          </a>
                        )}
                        {meal.image_url && (
                          <button
                            onClick={() => setExpandedPhoto(prev => prev === meal.id ? null : meal.id)}
                            className="text-xs bg-purple-50 text-purple-600 font-extrabold px-3 py-1.5 rounded-xl"
                          >
                            {expandedPhoto === meal.id ? '🙈 Verberg' : '📷 Foto'}
                          </button>
                        )}
                      </div>
                    )}
                    {expandedPhoto === meal.id && meal.image_url && (
                      <img
                        src={meal.image_url}
                        alt={meal.name}
                        className="mt-3 rounded-2xl w-full max-h-64 object-cover"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Link
                      to={`/meals/${meal.id}/edit`}
                      className="text-xs bg-green-50 text-green-700 font-extrabold px-3 py-1.5 rounded-xl text-center"
                    >
                      ✏️ Wysig
                    </Link>
                    <button
                      onClick={() => deleteMeal(meal.id)}
                      disabled={deleting === meal.id}
                      className="text-xs bg-red-50 text-red-500 font-extrabold px-3 py-1.5 rounded-xl disabled:opacity-40"
                    >
                      {deleting === meal.id ? '…' : '🗑️ Skrap'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
