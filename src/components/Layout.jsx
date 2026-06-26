import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/meals',         label: 'Maaltye',       icon: '🍽️' },
  { to: '/plan',          label: 'Week se Etes',  icon: '📅' },
  { to: '/shopping',      label: 'Inkopies',      icon: '🛒' },
  { to: '/hierdie-week',  label: 'Hierdie Week',  icon: '✅' },
  { to: '/huisgoete',     label: 'Huisgoete',     icon: '🏠' },
]

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 py-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🪄</span>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-tight">Magie Maatjie</h1>
            <p className="text-green-100 text-xs font-bold">Hoe wil jy jou magie volmaak vandag? ✨</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-green-100 safe-bottom z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex px-1 py-1 gap-0.5">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-1.5 px-0.5 rounded-xl text-[9px] font-extrabold transition-all leading-tight ${
                  isActive ? 'text-green-600 bg-green-50' : 'text-gray-400'
                }`
              }
            >
              <span className="text-xl mb-0.5">{icon}</span>
              <span className="text-center">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
