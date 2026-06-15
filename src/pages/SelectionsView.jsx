import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SelectionsView() {
  const [selections, setSelections] = useState([])
  const [mealMap, setMealMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: planData } = await supabase
        .from('weekly_plans')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!planData) { setLoading(false); return }

      const [{ data: sels }, { data: meals }] = await Promise.all([
        supabase
          .from('family_selections')
          .select('*')
          .eq('plan_id', planData.id)
          .order('submitted_at', { ascending: false }),
        supabase.from('meals').select('id, name')
      ])

      setSelections(sels ?? [])
      const map = {}
      meals?.forEach(m => { map[m.id] = m.name })
      setMealMap(map)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-400 font-bold animate-pulse">
      Laai… 👀
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-3xl">👨‍👩‍👧‍👦</span>
        <div>
          <h2 className="text-2xl font-black">Familie se Keuses</h2>
          <p className="text-xs text-gray-400 font-bold">{selections.length} respons{selections.length !== 1 ? 'e' : ''}</p>
        </div>
      </div>

      {selections.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-6xl mb-4">📭</p>
          <p className="font-black text-lg text-gray-700">Nog geen response nie!</p>
          <p className="text-sm text-gray-400 font-semibold mt-1">Deel die plan skakel en wag vir die familie.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {selections.map((sel, idx) => {
            const avatarColors = ['bg-green-400','bg-purple-400','bg-orange-400','bg-pink-400','bg-blue-400','bg-teal-400']
            const color = avatarColors[idx % avatarColors.length]
            return (
              <div key={sel.id} className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-black text-lg`}>
                    {sel.member_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-extrabold">{sel.member_name}</p>
                    <p className="text-xs text-gray-400 font-semibold">
                      {new Date(sel.submitted_at).toLocaleString('af', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                {sel.selected_meal_ids?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sel.selected_meal_ids.map(mid => (
                      <span key={mid} className="bg-green-50 text-green-700 font-bold text-sm px-3 py-1 rounded-full border border-green-200">
                        ✓ {mealMap[mid] ?? 'Onbekende maaltyd'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 font-semibold">Geen maaltye gekies nie.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
