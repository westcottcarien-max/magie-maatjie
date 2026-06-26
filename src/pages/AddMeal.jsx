import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import IngredientRow from '../components/IngredientRow'

const emptyIngredient = () => ({ item_name: '' })

// Store photo + recipe inside the existing notes column as JSON.
// Plain-text notes (old meals) are never touched.
function encodeMealNotes(text, image, recipe) {
  if (!image && !recipe) return text || null
  return JSON.stringify({ _v: 1, t: text || '', i: image || null, r: recipe || null })
}

function decodeMealNotes(raw) {
  if (!raw) return { text: '', image: null, recipe: null }
  try {
    const d = JSON.parse(raw)
    if (d && d._v === 1) return { text: d.t ?? '', image: d.i ?? null, recipe: d.r ?? null }
  } catch {}
  return { text: raw, image: null, recipe: null }
}

function compressToBase64(file) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objUrl)
      const MAX = 900
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.src = objUrl
  })
}

export default function AddMeal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const fileInputRef = useRef(null)

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [recipeUrl, setRecipeUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [ingredients, setIngredients] = useState([emptyIngredient()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    async function load() {
      try {
        const { data: meal } = await supabase.from('meals').select('*').eq('id', id).maybeSingle()
        const { data: ings } = await supabase.from('ingredients').select('*').eq('meal_id', id).order('sort_order')
        if (meal) {
          setName(meal.name)
          const decoded = decodeMealNotes(meal.notes)
          setNotes(decoded.text)
          setRecipeUrl(decoded.recipe ?? '')
          setImagePreview(decoded.image ?? '')
        }
        if (ings?.length) setIngredients(ings)
      } catch (err) {
        setError('Kon maaltyd nie laai nie.')
      }
    }
    load()
  }, [id, isEdit])

  function handleImagePick(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

      // Compress new photo if one was picked
      let finalImage = imagePreview || null
      if (imageFile) {
        finalImage = await compressToBase64(imageFile)
      }

      const notesValue = encodeMealNotes(notes.trim(), finalImage, recipeUrl.trim() || null)

      if (isEdit) {
        const { error: err } = await supabase.from('meals')
          .update({ name: name.trim(), notes: notesValue })
          .eq('id', id)
        if (err) throw err
        await supabase.from('ingredients').delete().eq('meal_id', id)
      } else {
        const { data, error: err } = await supabase.from('meals')
          .insert({ name: name.trim(), notes: notesValue })
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

  async function handleDelete() {
    if (!confirm('Verwyder hierdie maaltyd permanent?')) return
    setSaving(true)
    await supabase.from('meals').delete().eq('id', id)
    navigate('/meals')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{isEdit ? '✏️' : '🍳'}</span>
          <h2 className="text-2xl font-black">{isEdit ? 'Wysig Maaltyd' : 'Nuwe Maaltyd'}</h2>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <button type="button" onClick={handleDelete} disabled={saving}
              className="bg-red-50 text-red-500 font-extrabold text-sm px-3 py-2 rounded-xl disabled:opacity-40">
              🗑️ Skrap
            </button>
          )}
          <button type="button" onClick={() => navigate('/meals')}
            className="bg-gray-100 text-gray-500 font-extrabold text-sm px-3 py-2 rounded-xl">
            ← Terug
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 text-sm font-bold p-3 rounded-2xl">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">Maaltydnaam *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="bv. Spaghetti Bolognese" className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-3 uppercase tracking-wide">Bestanddele</label>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <IngredientRow key={i} ingredient={ing} index={i} onChange={updateIngredient} onRemove={removeIngredient} />
            ))}
          </div>
          <button type="button" onClick={addIngredient}
            className="mt-3 flex items-center gap-1 text-green-600 font-extrabold text-sm bg-green-50 px-4 py-2 rounded-xl hover:bg-green-100 transition-colors">
            ＋ Voeg bestanddeel by
          </button>
        </div>

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Kookinstruksies, wenke, porsies…" rows={4} className="input-field resize-none" />
        </div>

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">
            Resep Skakel <span className="text-gray-400 font-semibold normal-case">(opsioneel — TikTok, YouTube, ens.)</span>
          </label>
          <input type="url" value={recipeUrl} onChange={e => setRecipeUrl(e.target.value)}
            placeholder="https://www.tiktok.com/..." className="input-field" />
        </div>

        <div>
          <label className="block text-sm font-extrabold text-gray-600 mb-2 uppercase tracking-wide">
            Foto <span className="text-gray-400 font-semibold normal-case">(opsioneel)</span>
          </label>

          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="voorskou" className="w-full max-h-56 object-cover rounded-2xl" />
              <button type="button" onClick={removeImage}
                className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full font-black text-lg flex items-center justify-center shadow-lg">
                ×
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-8 flex flex-col items-center gap-2 text-gray-400 active:scale-95 transition-transform">
              <span className="text-4xl">📷</span>
              <span className="font-extrabold text-sm">Kies foto van foon</span>
            </button>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
        </div>

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Besig om te stoor…' : isEdit ? '💾 Stoor Wysigings' : '🎉 Stoor Maaltyd'}
        </button>
      </form>
    </div>
  )
}
