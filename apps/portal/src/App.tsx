import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HotelPortal from './pages/HotelPortal';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"            element={<LandingPage />} />
        <Route path="/:hotelSlug" element={<HotelPortal />} />
        <Route path="*"            element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
