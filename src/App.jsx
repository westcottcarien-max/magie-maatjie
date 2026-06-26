import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AddMeal from './pages/AddMeal'
import MealsLibrary from './pages/MealsLibrary'
import WeeklyPlan from './pages/WeeklyPlan'
import FamilyShare from './pages/FamilyShare'
import SelectionsView from './pages/SelectionsView'
import ShoppingList from './pages/ShoppingList'
import EtesVirDieWeek from './pages/EtesVirDieWeek'
import VorigeWeke from './pages/VorigeWeke'
import HuisGoete, { RoomPage } from './pages/HuisGoete'

export default function App() {
  return (
    <Routes>
      {/* Public family selection page — no nav bar */}
      <Route path="/share/:shareToken" element={<FamilyShare />} />

      {/* Main app with nav */}
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/meals" replace />} />
        <Route path="/meals" element={<MealsLibrary />} />
        <Route path="/meals/add" element={<AddMeal />} />
        <Route path="/meals/:id/edit" element={<AddMeal />} />
        <Route path="/plan" element={<WeeklyPlan />} />
        <Route path="/plan/selections" element={<SelectionsView />} />
        <Route path="/shopping" element={<ShoppingList />} />
        <Route path="/hierdie-week" element={<EtesVirDieWeek />} />
        <Route path="/vorige-weke" element={<VorigeWeke />} />
        <Route path="/huisgoete" element={<HuisGoete />} />
        <Route path="/huisgoete/:roomId" element={<RoomPage />} />
      </Route>
    </Routes>
  )
}
