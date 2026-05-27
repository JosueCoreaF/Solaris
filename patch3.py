import re

file_path = r'C:\Users\Zyros RK\Desktop\Solaris\apps\hotel\src\features\bookings\Bookings.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. ADD IMPORTS
import_str = "import { fetchBookings, createBooking, updateBooking, updateBookingDates, cancelBooking, getBinnacleByReserva, simulateImportReservas, confirmImportReservas } from '../../api/bookingsService';"
content = re.sub(r"import \{ fetchBookings.*?\} from '\.\./\.\./api/bookingsService';", import_str.replace('\\', '\\\\'), content)

# 2. ADD STATES after setDetailReserva
state_str = '''  const [isDragging, setIsDragging] = useState(false);
  const [detailReserva, setDetailReserva] = useState<Reserva | null>(null);

  const [isSimulatingLoading, setIsSimulatingLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedReservas, setSimulatedReservas] = useState<Reserva[]>([]);
  const [simulatedRooms, setSimulatedRooms] = useState<Habitacion[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ mes: string; idx: number; total: number; insertadas: number; errores: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);'''
content = content.replace('  const [isDragging, setIsDragging] = useState(false);\n  const [detailReserva, setDetailReserva] = useState<Reserva | null>(null);', state_str)

# 3. FIX filteredRooms
fil_str = '''  const habitacionesFiltradas = useMemo(() => {
    const allRooms = isSimulating ? [...habitaciones, ...simulatedRooms] : habitaciones;
    const filtered = hotelFiltro === 'todos' ? allRooms : allRooms.filter(h => h.id_hotel === hotelFiltro || h.id_hotel === 'unknown');
    
    // Ordenar por numero extraido del nombre
    return filtered.sort((a, b) => {
      const numA = parseInt(a.nombre_habitacion.match(/\\d+/)?.[0] ?? '0', 10);
      const numB = parseInt(b.nombre_habitacion.match(/\\d+/)?.[0] ?? '0', 10);
      return numA - numB;
    });
  },
<truncated 12118 bytes>