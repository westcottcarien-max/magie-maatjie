import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrydag', 'Saterdag', 'Sondag']
const DAY_COLORS = [
  'from-blue-400 to-blue-500',
  'from-purple-400 to-purple-500',
  'from-pink-400 to-pink-500',
  'from-orange-400 to-orange-500',
  'from-yellow-400 to-amber-500',
  'from-teal-400 to-teal-500',
  'from-red-400 to-red-500',
]

export default function WeeklyPlan() {
  const navigate = useNavigate()
  const [meals, setMeals] = useState([])
  const [selectedMeals, setSelectedMeals] = useState(Array(7).fill(''))
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
        .single()

      if (planData) {
        setActivePlan(planData)
        setWeekLabel(planData.week_label ?? '')
        setShareUrl(`${window.location.origin}/share/${planData.share_token}`)
        const slots = Array(7).fill('')
        planData.plan_meals?.forEach(pm => { slots[pm.day_index] = pm.meal_id ?? '' })
        setSelectedMeals(slots)
      }
    }
    load()
  }, [])

  async function savePlan() {
    setSaving(true)
    try {
      if (activePlan) {
        await supabase.from('weekly_plans').update({ week_label: weekLabel, is_active: true }).eq('id', activePlan.id)
        await supabase.from('plan_meals').delete().eq('plan_id', activePlan.id)
        const rows = selectedMeals
          .map((mid, i) => ({ plan_id: activePlan.id, day_index: i, meal_id: mid || null }))
        await supabase.from('plan_meals').insert(rows)
        setShareUrl(`${window.location.origin}/share/${activePlan.share_token}`)
      } else {
        const { data: plan, error } = await supabase
          .from('weekly_plans')
          .insert({ week_label: weekLabel })
          .select('*')
          .single()
        if (error) throw error
        const rows = selectedMeals
          .map((mid, i) => ({ plan_id: plan.id, day_index: i, meal_id: mid || null }))
        await supabase.from('plan_meals').insert(rows)
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

      <div className="space-y-3 mb-6">
        {DAYS.map((day, i) => (
          <div key={day} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className={`bg-gradient-to-r ${DAY_COLORS[i]} px-4 py-2`}>
              <span className="text-white font-black text-sm uppercase tracking-wide">{day}</span>
            </div>
            <div className="p-3">
              <select
                value={selectedMeals[i]}
                onChange={e => {
                  const updated = [...selectedMeals]
                  updated[i] = e.target.value
                  setSelectedMeals(updated)
                }}
                className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 font-bold text-sm focus:outline-none focus:border-green-400 bg-white transition-colors"
              >
                <option value="">— Geen maaltyd gekies —</option>
                {meals.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
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
