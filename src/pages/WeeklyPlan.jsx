import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function WeeklyPlan() {
  const navigate = useNavigate()
  const [meals, setMeals] = useState([])
  const [selectedMealIds, setSelectedMealIds] = useState(new Set())
  const [mealCount, setMealCount] = useState(7)
  const [weekLabel, setWeekLabel] = useState('')
  const [activePlan, setActivePlan] = useState(null)
  const [saving, setSaving] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: mealData } = await supabase.from('meals').select('id, name').order('name')
      setMeals(mealData ?? [])

      const { data: planData } = await supabase
        .from('weekly_plans')
        .select('*, plan_meals(day_index, meal_id)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planData) {
        setActivePlan(planData)
        setWeekLabel(planData.week_label ?? '')
        setShareUrl(`${window.location.origin}/share/${planData.share_token}`)
        const ids = new Set(
          planData.plan_meals?.filter(pm => pm.meal_id).map(pm => pm.meal_id) ?? []
        )
        setSelectedMealIds(ids)
      }
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

  function randomize() {
    const count = Math.min(Math.max(1, mealCount), meals.length)
    const shuffled = [...meals].sort(() => Math.random() - 0.5)
    setSelectedMealIds(new Set(shuffled.slice(0, count).map(m => m.id)))
  }

  async function savePlan() {
    setSaving(true)
    try {
      const mealIdsArray = [...selectedMealIds]
      if (activePlan) {
        await supabase.from('weekly_plans').update({ week_label: weekLabel, is_active: true }).eq('id', activePlan.id)
        await supabase.from('plan_meals').delete().eq('plan_id', activePlan.id)
        if (mealIdsArray.length > 0) {
          const rows = mealIdsArray.map((mid, i) => ({ plan_id: activePlan.id, day_index: i, meal_id: mid }))
          await supabase.from('plan_meals').insert(rows)
        }
        setShareUrl(`${window.location.origin}/share/${activePlan.share_token}`)
      } else {
        const { data: plan, error } = await supabase
          .from('weekly_plans')
          .insert({ week_label: weekLabel })
          .select('*')
          .single()
        if (error) throw error
        if (mealIdsArray.length > 0) {
          const rows = mealIdsArray.map((mid, i) => ({ plan_id: plan.id, day_index: i, meal_id: mid }))
          await supabase.from('plan_meals').insert(rows)
        }
        setActivePlan(plan)
        setShareUrl(`${window.location.origin}/share/${plan.share_token}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Hoe wil jy jou magie volmaak vandag? 🪄✨\n${shareUrl}`)}`
    : null

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-3xl">📅</span>
        <h2 className="text-2xl font-black">Weeklikse Plan</h2>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">Week beskrywing (opsioneel)</label>
        <input
          type="text"
          value={weekLabel}
          onChange={e => setWeekLabel(e.target.value)}
          placeholder="bv. Week van 16 Jun"
          className="input-field"
        />
      </div>

      <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 mb-5">
        <p className="font-extrabold text-purple-800 mb-3">🎲 Willekeurige Keuse</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-extrabold text-purple-600 mb-1 uppercase tracking-wide">Aantal maaltye</label>
            <input
              type="number"
              min={1}
              max={meals.length || 99}
              value={mealCount}
              onChange={e => setMealCount(Number(e.target.value))}
              className="w-full border-2 border-purple-200 rounded-xl px-3 py-2.5 font-bold text-sm focus:outline-none focus:border-purple-400 bg-white"
            />
          </div>
          <button
            onClick={randomize}
            disabled={meals.length === 0}
            className="shrink-0 bg-purple-500 text-white px-4 py-2.5 rounded-xl font-extrabold text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            🎲 Kies Vir My
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-extrabold text-gray-600 uppercase tracking-wide">
          Maaltye ({selectedMealIds.size} gekies)
        </p>
        {selectedMealIds.size > 0 && (
          <button
            onClick={() => setSelectedMealIds(new Set())}
            className="text-xs text-gray-400 font-bold"
          >
            Maak alles skoon
          </button>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {meals.map(meal => {
          const isSelected = selectedMealIds.has(meal.id)
          return (
            <button
              key={meal.id}
              type="button"
              onClick={() => toggleMeal(meal.id)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-98 ${
                isSelected
                  ? 'border-green-400 bg-green-50 shadow-sm'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center text-white text-sm font-black transition-all ${
                isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
              }`}>
                {isSelected && '✓'}
              </span>
              <span className="font-extrabold text-sm">{meal.name}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={savePlan}
        disabled={saving}
        className="btn-primary disabled:opacity-50 mb-4"
      >
        {saving ? '⏳ Besig…' : activePlan ? '🔄 Opdateer Plan' : '🎉 Stoor Plan'}
      </button>

      {shareUrl && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 space-y-3">
          <p className="font-extrabold text-green-800">🔗 Deel met jou familie!</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 text-xs border-2 border-gray-200 rounded-xl px-2 py-2 bg-white truncate font-mono"
            />
            <button
              onClick={copyLink}
              className="shrink-0 text-sm bg-white border-2 border-gray-200 rounded-xl px-3 py-2 font-extrabold"
            >
              {copied ? '✅' : '📋'}
            </button>
          </div>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3.5 rounded-2xl font-extrabold shadow-md active:scale-95 transition-transform"
          >
            💬 Deel op WhatsApp
          </a>
          <button
            onClick={() => navigate('/plan/selections')}
            className="btn-outline"
          >
            👀 Sien familie se keuses →
          </button>
        </div>
      )}
    </div>
  )
}
