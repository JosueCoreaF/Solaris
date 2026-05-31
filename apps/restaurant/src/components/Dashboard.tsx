import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import Topvar from './Topvar'
import Cards from './Cards';

export default function Dashboard() {
   return(
      <div className="bg-white min-h-screen">
   
      <Topvar />  
      <Cards/>
      

      </div>


   );
}

