import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import HotelPortal from './pages/HotelPortal';
import RestaurantPortal from './pages/RestaurantPortal';
import GymPortal from './pages/GymPortal';
import RestaurantesLanding from './pages/RestaurantesLanding';
import GymsLanding from './pages/GymsLanding';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                           element={<HomePage />} />
        <Route path="/buscar"                     element={<LandingPage />} />
        <Route path="/landing/restaurant"         element={<RestaurantesLanding />} />
        <Route path="/landing/gym"                element={<GymsLanding />} />
        <Route path="/restaurante/:restauranteId" element={<RestaurantPortal />} />
        <Route path="/gym/:gymId"                 element={<GymPortal />} />
        <Route path="/:hotelSlug"                 element={<HotelPortal />} />
        <Route path="*"                           element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
