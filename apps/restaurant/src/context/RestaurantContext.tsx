import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from './AuthContext';
import type { Restaurant, BusinessModule } from '../types';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export interface PlanInfo {
  id_plan: string | null;
  nombre: string | null;
  estado: string | null;
  feature_flags: string[];
}

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface RestaurantContextValue {
  // Restaurante activo
  restaurant: Restaurant | null;
  restaurantLoading: boolean;

  // Plan de suscripción del restaurante activo
  plan: PlanInfo | null;

  // Lista de módulos disponibles (para el selector)
  modules: BusinessModule[];
  modulesLoading: boolean;

  // Módulo activo seleccionado
  activeModule: BusinessModule | null;

  // Necesita selector (más de un restaurante)
  needsSelector: boolean;

  // Acción para cambiar de restaurante
  selectModule: (mod: BusinessModule) => void;

  refetch: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────
export const RestaurantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();

  const [modules, setModules] = useState<BusinessModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<BusinessModule | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  // ── 1. Cargar módulos de restaurante disponibles para el usuario ──────────
  const fetchModules = useCallback(async () => {
    if (!user) {
      setModules([]);
      setModulesLoading(false);
      return;
    }
    setModulesLoading(true);
    try {
      // Flujo owner: business_modules filtrado por RLS (owner_id = auth.uid())
      const { data: ownerModules, error: ownerErr } = await supabase
        .from('business_modules')
        .select('*')
        .eq('tipo_modulo', 'restaurant')
        .eq('estado', 'activo');

      if (!ownerErr && ownerModules && ownerModules.length > 0) {
        setModules(ownerModules);
        return;
      }

      // Flujo staff: usuarios_roles → id_module → business_modules
      const { data: roles } = await supabase
        .from('usuarios_roles')
        .select('*')
        .eq('user_id', user.id);

      if (roles && roles.length > 0) {
        const idModules = roles.map((r: any) => r.id_module).filter(Boolean);
        if (idModules.length > 0) {
          const { data: staffModules } = await supabase
            .from('business_modules')
            .select('*')
            .in('id_module', idModules)
            .eq('tipo_modulo', 'restaurant')
            .eq('estado', 'activo');

          setModules(staffModules ?? []);
          return;
        }
      }

      setModules([]);
    } catch {
      setModules([]);
    } finally {
      setModulesLoading(false);
    }
  }, [user]);

  // ── 2. Cargar datos del restaurante + plan usando sync-context API ────────
  const fetchRestaurant = useCallback(async (mod: BusinessModule) => {
    setRestaurantLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        const res = await fetch(`${API}/restaurant/sync-context?business_id=${mod.id_module}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const { plan: planData, ...restData } = json.data ?? {};
          setRestaurant(restData ?? null);
          setPlan(planData ?? null);
          return;
        }
      }
      // Fallback directo a Supabase
      const { data } = await supabase
        .from('restaurant')
        .select('*')
        .eq('id_module', mod.id_module)
        .maybeSingle();
      setRestaurant(data ?? null);
      setPlan(null);
    } catch {
      setRestaurant(null);
      setPlan(null);
    } finally {
      setRestaurantLoading(false);
    }
  }, []);

  // ── 3. Auto-selección cuando hay un solo módulo ───────────────────────────
  useEffect(() => {
    if (modulesLoading) return;

    if (modules.length === 0) return;

    if (modules.length === 1) {
      setActiveModule(modules[0]);
      return;
    }

    // Si ya había un módulo activo y sigue en la lista, mantenerlo
    if (activeModule) {
      const still = modules.find(m => m.id_module === activeModule.id_module);
      if (!still) setActiveModule(null);
      return;
    }

    // Intentar recuperar el módulo desde localStorage (cuando se entra desde el hub)
    const saved = localStorage.getItem('active_restaurant_id');
    if (saved) {
      const found = modules.find(m => m.id_module === saved);
      if (found) { setActiveModule(found); return; }
    }
  }, [modules, modulesLoading]);

  // ── 4. Recuperar restaurante cuando cambia el módulo activo ──────────────
  useEffect(() => {
    if (activeModule) {
      fetchRestaurant(activeModule);
    } else {
      setRestaurant(null);
      setRestaurantLoading(false);
    }
  }, [activeModule]);

  // ── 5. Inicializar cuando el usuario cambia ───────────────────────────────
  useEffect(() => {
    if (authLoading) return; // Esperar a que la auth resuelva antes de actuar
    if (!user) {
      localStorage.removeItem('active_restaurant_id');
      setActiveModule(null);
      setRestaurant(null);
    } else {
      fetchModules();
    }
  }, [user, authLoading]);

  // ── Refetch completo (útil tras crear/editar datos) ───────────────────────
  const refetch = useCallback(async () => {
    if (activeModule) await fetchRestaurant(activeModule);
  }, [activeModule, fetchRestaurant]);

  const selectModule = useCallback((mod: BusinessModule) => {
    setActiveModule(mod);
    localStorage.setItem('active_restaurant_id', mod.id_module);
  }, []);

  const needsSelector = !modulesLoading && modules.length > 1 && !activeModule;

  return (
    <RestaurantContext.Provider value={{
      restaurant,
      restaurantLoading,
      plan,
      modules,
      modulesLoading,
      activeModule,
      needsSelector,
      selectModule,
      refetch,
    }}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = (): RestaurantContextValue => {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant debe usarse dentro de RestaurantProvider');
  return ctx;
};
