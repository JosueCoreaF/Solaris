import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

export default function Cards() {
  return (
    <div className="flex gap-6 p-8">
      
     
      <div className="bg-white rounded-lg shadow w-64">
        <img 
          src="https://numerosdeerario.mexicoevalua.org/wp-content/themes/yootheme/cache/0f/imagenes-02-0f939e76.webp" 
          alt="Restaurante"
          className="w-full h-40 object-cover rounded-t-lg"
        />
        <div className="p-4">
          <h3 className="font-bold text-lg">Ingresos del restaurante</h3>
          <p className="text-gray-600 mb-4">Ver informacion de los ingresos del restaurante</p>
          <button className="bg-blue-500 text-white px-4 py-2 rounded w-full">Entrar</button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow w-64">
        <img 
          src="https://emprendepyme.net/caracteristicas-de-un-producto.html/cualidades-producto#main" 
          alt="Productos"
          className="w-full h-40 object-cover rounded-t-lg"
        />
        <div className="p-4">
          <h3 className="font-bold text-lg">Productos</h3>
          <p className="text-gray-600 mb-4">Ver informacion de los productos solicitados</p>
          <button className="bg-blue-500 text-white px-4 py-2 rounded w-full">Entrar</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow w-64">
        <img 
          src="https://www.heropay.eu/blog-images/559102219/sourcing-fournisseur-hero.webp" 
          alt="Productos"
          className="w-full h-40 object-cover rounded-t-lg"
        />
        <div className="p-4">
          <h3 className="font-bold text-lg">Pedidos</h3>
          <p className="text-gray-600 mb-4">Ver los pedidos hechos a proveedores de tu restaurante</p>
          <button className="bg-blue-500 text-white px-4 py-2 rounded w-full">Entrar</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow w-64">
        <img 
          src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjfBJQr3r8Yr00wn8j0aXaf9ZMzZdBOpcvgM30aiOg826xbR0BWvaGEDGvO63H4TijpSMJ6IBAmSANaYJPLD5nhqLJ6xxCspb-VnmHpPmQtIbXzJyX8AGWoKG3oUrKWjOS5SRKanlcquH8/s1600/El+Marketing+Mix+Promoci%25C3%25B3n.jpg" 
          alt="Productos"
          className="w-full h-40 object-cover rounded-t-lg"
        />
        <div className="p-4">
          <h3 className="font-bold text-lg">Promociones</h3>
          <p className="text-gray-600 mb-4">Ver las promociones mas vendidas de tu restaurante</p>
          <button className="bg-blue-500 text-white px-4 py-2 rounded w-full">Entrar</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow w-64">
        <img 
          src="https://www.unileverfoodsolutions.com.co/tendencias/mas-que-chefs-mas-que-salsas/tendencias/platos-mas-vendidos-en-colombia/_jcr_content/parsys/set2/row2/span12/image.img.png/1645514458869.png" 
          alt="Productos"
          className="w-full h-40 object-cover rounded-t-lg"
        />
        <div className="p-4">
          <h3 className="font-bold text-lg">Platos</h3>
          <p className="text-gray-600 mb-4">Ver los productos que mas movimiento tienen</p>
          <button className="bg-blue-500 text-white px-4 py-2 rounded w-full">Entrar</button>
        </div>
      </div>
      
    </div>
  );
}