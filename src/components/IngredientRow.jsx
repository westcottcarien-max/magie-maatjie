export default function IngredientRow({ ingredient, index, onChange, onRemove }) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-lg">🥬</span>
      <input
        type="text"
        placeholder="Bestanddeel naam…"
        value={ingredient.item_name}
        onChange={e => onChange(index, 'item_name', e.target.value)}
        className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 font-semibold focus:outline-none focus:border-green-400 transition-colors bg-white"
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-400 rounded-xl text-xl font-bold hover:bg-red-100 transition-colors"
        aria-label="Verwyder"
      >
        ×
      </button>
    </div>
  )
}
