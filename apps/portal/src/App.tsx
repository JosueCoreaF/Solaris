import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import HotelPortal from './pages/HotelPortal';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<HomePage />} />
        <Route path="/buscar"      element={<LandingPage />} />
        <Route path="/:hotelSlug" element={<HotelPortal />} />
        <Route path="*"            element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
