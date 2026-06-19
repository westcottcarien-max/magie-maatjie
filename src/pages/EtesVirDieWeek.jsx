import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('af', { dateStyle: 'long' })
}

export default function EtesVirDieWeek() {
  const [plan, setPlan] = useState(null)
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: planData } = await supabase
        .from('weekly_plans')
        .select('id, week_label, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!planData) { setLoading(false); return }
      setPlan(planData)

      const { data: pmData } = await supabase
        .from('plan_meals')
        .select('day_index, meal_id, meals(id, name)')
        .eq('plan_id', planData.id)
        .not('meal_id', 'is', null)
        .order('day_index')

      setMeals(pmData?.filter(pm => pm.meals).map(pm => pm.meals) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 font-bold animate-pulse">
      Laai… ✅
    </div>
  )

  if (!plan) return (
    <div className="max-w-lg mx-auto px-4 py-6 text-center">
      <p className="text-6xl mb-4">📭</p>
      <p className="font-black text-lg text-gray-700">Nog geen plan bevestig nie</p>
      <p className="text-sm text-gray-400 font-semibold mt-2">
        Gaan na "Week se Etes", kies jou maaltye en druk "Etes Bevestig".
      </p>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-3xl">✅</span>
        <h2 className="text-2xl font-black">Etes vir die Week</h2>
      </div>

      <div className="mb-6">
        {plan.week_label && (
          <span className="inline-block bg-green-100 text-green-700 font-extrabold text-sm px-3 py-1 rounded-full mb-1">
            {plan.week_label}
          </span>
        )}
        <p className="text-xs text-gray-400 font-bold">
          Bevestig op {formatDate(plan.created_at)}
        </p>
      </div>

      {meals.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-black text-gray-700">Geen maaltye in hierdie plan nie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meals.map((meal, i) => (
            <div
              key={meal.id}
              className="flex items-center gap-3 bg-white border-2 border-green-100 rounded-2xl px-4 py-3.5 shadow-sm"
            >
              <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-black text-sm flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="font-extrabold">{meal.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
