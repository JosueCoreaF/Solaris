import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import Topvar from '../components/Topvar'
import Cards from '../components/Cards';

export default function Dashboard() {
   return(
        <div className="bg-gray-100 min-h-screen">
      <Topvar />  
      <Cards/>
    </div>
   );
}

