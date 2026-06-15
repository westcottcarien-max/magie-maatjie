import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import IngredientRow from '../components/IngredientRow'

const emptyIngredient = () => ({ item_name: '' })

export default function AddMeal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState([emptyIngredient()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    async function load() {
      const { data: meal } = await supabase.from('meals').select('*').eq('id', id).single()
      const { data: ings } = await supabase.from('ingredients').select('*').eq('meal_id', id).order('sort_order')
      if (meal) { setName(meal.name); setNotes(meal.notes ?? '') }
      if (ings?.length) setIngredients(ings)
    }
    load()
  }, [id, isEdit])

  function updateIngredient(index, field, value) {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing))
  }

  function removeIngredient(index) {
    setIngredients(prev => prev.length === 1 ? [emptyIngredient()] : prev.filter((_, i) => i !== index))
  }

  function addIngredient() {
    setIngredients(prev => [...prev, emptyIngredient()])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Maaltydnaam is verpligtend.'); return }
    setSaving(true)
    setError(null)

    try {
      let mealId = id

      if (isEdit) {
        await supabase.from('meals').update({ name: name.trim(), notes: notes.trim() }).eq('id', id)
        await supabase.from('ingredients').delete().eq('meal_id', id)
      } else {
        const { data, error: err } = await supabase
          .from('meals')
          .insert({ name: name.trim(), notes: notes.trim() })
          .select('id')
          .single()
        if (err) throw err
        mealId = data.id
      }

      const validIngredients = ingredients
        .filter(ing => ing.item_name.trim())
        .map((ing, i) => ({ meal_id: mealId, item_name: ing.item_name.trim(), sort_order: i }))

      if (validIngredients.length) {
        await supabase.from('ingredients').insert(validIngredients)
      }

      navigate('/meals')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-3xl">{isEdit ? '✏️' : '🍳'}</span>
        <h2 className="text-2xl font-black">{isEdit ? 'Wysig Maaltyd' : 'Nuwe Maaltyd'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 text-sm font-bold p-3 rounded-2xl">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">Maaltydnaam *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="bv. Spaghetti Bolognese"
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-3 uppercase tracking-wide">Bestanddele</label>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <IngredientRow
                key={i}
                ingredient={ing}
                index={i}
                onChange={updateIngredient}
                onRemove={removeIngredient}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="mt-3 flex items-center gap-1 text-green-600 font-extrabold text-sm bg-green-50 px-4 py-2 rounded-xl hover:bg-green-100 transition-colors"
          >
            ＋ Voeg bestanddeel by
          </button>
        </div>

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">Notas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Kookinstruksies, wenke, porsies…"
            rows={4}
            className="input-field resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? 'Besig om te stoor…' : isEdit ? '💾 Stoor Wysigings' : '🎉 Stoor Maaltyd'}
        </button>
      </form>
    </div>
  )
}
