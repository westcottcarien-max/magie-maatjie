import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('af', { dateStyle: 'long' })
}

export default function VorigeWeke() {
  const [plans, setPlans] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [mealCache, setMealCache] = useState({})
  const [loadingMeals, setLoadingMeals] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Find the most recent active plan to exclude from history
      const { data: activePlan } = await supabase
        .from('weekly_plans')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let query = supabase
        .from('weekly_plans')
        .select('id, week_label, created_at')
        .order('created_at', { ascending: false })

      if (activePlan) query = query.neq('id', activePlan.id)

      const { data } = await query
      setPlans(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function togglePlan(planId) {
    if (expandedId === planId) {
      setExpandedId(null)
      return
    }
    setExpandedId(planId)

    if (mealCache[planId]) return

    setLoadingMeals(planId)
    const { data } = await supabase
      .from('plan_meals')
      .select('day_index, meal_id, meals(id, name)')
      .eq('plan_id', planId)
      .not('meal_id', 'is', null)
      .order('day_index')

    const meals = data?.filter(pm => pm.meals).map(pm => pm.meals) ?? []
    setMealCache(prev => ({ ...prev, [planId]: meals }))
    setLoadingMeals(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 font-bold animate-pulse">
      Laai… 📋
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-3xl">📋</span>
        <h2 className="text-2xl font-black">Vorige Weke se Etes</h2>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">📭</p>
          <p className="font-black text-lg text-gray-700">Nog geen vorige planne nie</p>
          <p className="text-sm text-gray-400 font-semibold mt-2">
            Planne wat meer as 7 dae oud is verskyn hier outomaties wanneer jy 'n nuwe plan maak.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const isOpen = expandedId === plan.id
            const meals = mealCache[plan.id] ?? []
            const isLoading = loadingMeals === plan.id

            return (
              <div key={plan.id} className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => togglePlan(plan.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                >
                  <div className="flex-1">
                    <p className="font-extrabold text-base">
                      {plan.week_label || 'Naamlose week'}
                    </p>
                    <p className="text-xs text-gray-400 font-semibold mt-0.5">
                      {formatDate(plan.created_at)}
                    </p>
                  </div>
                  <span className={`text-gray-400 font-black text-lg transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    {isLoading ? (
                      <p className="text-sm text-gray-400 font-bold animate-pulse text-center py-4">
                        Laai maaltye…
                      </p>
                    ) : meals.length === 0 ? (
                      <p className="text-sm text-gray-400 font-semibold text-center py-4">
                        Geen maaltye in hierdie plan nie.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {meals.map((meal, i) => (
                          <div
                            key={meal.id}
                            className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5"
                          >
                            <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 font-black text-xs flex items-center justify-center flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="font-bold text-sm">{meal.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
