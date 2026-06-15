import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrydag', 'Saterdag', 'Sondag']

export default function FamilyShare() {
  const { shareToken } = useParams()
  const [plan, setPlan] = useState(null)
  const [planMeals, setPlanMeals] = useState([])
  const [memberName, setMemberName] = useState('')
  const [selectedMealIds, setSelectedMealIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: planData } = await supabase
        .from('weekly_plans')
        .select('*')
        .eq('share_token', shareToken)
        .single()

      if (!planData) { setError('Plan not found.'); setLoading(false); return }
      setPlan(planData)

      const { data: pmData } = await supabase
        .from('plan_meals')
        .select('day_index, meal_id, meals(id, name, notes, ingredients(item_name))')
        .eq('plan_id', planData.id)
        .order('day_index')

      setPlanMeals(pmData?.filter(pm => pm.meal_id) ?? [])
      setLoading(false)
    }
    load()
  }, [shareToken])

  function toggleMeal(mealId) {
    setSelectedMealIds(prev =>
      prev.includes(mealId) ? prev.filter(id => id !== mealId) : [...prev, mealId]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!memberName.trim()) { setError('Voer asseblief jou naam in.'); return }
    if (selectedMealIds.length === 0) { setError('Kies asseblief ten minste een maaltyd.'); return }
    setError(null)
    setSubmitting(true)

    const { error: err } = await supabase.from('family_selections').insert({
      plan_id: plan.id,
      member_name: memberName.trim(),
      selected_meal_ids: selectedMealIds
    })

    if (err) { setError(err.message); setSubmitting(false); return }
    setSubmitted(true)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen font-extrabold text-gray-400 animate-pulse">
      Laai… 🍽️
    </div>
  )
  if (error && !plan) return (
    <div className="flex items-center justify-center h-screen text-red-500 px-6 text-center font-bold">
      😕 {error}
    </div>
  )

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-gradient-to-br from-green-50 to-emerald-100">
        <p className="text-7xl mb-4">🎉</p>
        <h2 className="text-3xl font-black mb-2">Dankie, {memberName}!</h2>
        <p className="text-gray-600 font-semibold">Jou maaltydkeuses is gestoor.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 bg-gradient-to-br from-green-50 via-white to-emerald-50 min-h-screen">
      <div className="text-center mb-8">
        <p className="text-5xl mb-3">🍽️</p>
        <h1 className="text-2xl font-black">Wat wil jy eet?</h1>
        {plan?.week_label && <p className="text-green-700 font-bold text-sm mt-1 bg-green-100 inline-block px-3 py-1 rounded-full">{plan.week_label}</p>}
        <p className="text-gray-500 font-semibold text-sm mt-3">Merk die maaltye wat jy wil hê — jy kan meer as een kies!</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 text-sm font-bold p-3 rounded-2xl">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">Jou naam *</label>
          <input
            type="text"
            value={memberName}
            onChange={e => setMemberName(e.target.value)}
            placeholder="bv. Mamma"
            className="input-field"
          />
        </div>

        <div className="space-y-3">
          {planMeals.map(pm => {
            const meal = pm.meals
            const isSelected = selectedMealIds.includes(meal.id)
            return (
              <button
                key={meal.id}
                type="button"
                onClick={() => toggleMeal(meal.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-98 ${
                  isSelected
                    ? 'border-green-400 bg-green-50 shadow-md'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center text-white text-sm font-black transition-all ${
                    isSelected ? 'bg-green-500 border-green-500 scale-110' : 'border-gray-300'
                  }`}>
                    {isSelected && '✓'}
                  </span>
                  <div>
                    <p className="font-extrabold">{DAYS[pm.day_index]}: {meal.name}</p>
                    {meal.ingredients?.length > 0 && (
                      <p className="text-xs text-gray-400 font-semibold mt-1">
                        🥬 {meal.ingredients.map(ing => ing.item_name).join(' · ')}
                      </p>
                    )}
                    {meal.notes && <p className="text-xs text-gray-400 font-medium mt-1 italic">{meal.notes}</p>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary disabled:opacity-50 mt-2"
        >
          {submitting ? '⏳ Besig…' : '🎉 Stuur my keuses'}
        </button>
      </form>
    </div>
  )
}
