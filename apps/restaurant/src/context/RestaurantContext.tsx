import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from './AuthContext';
import type { Restaurant, BusinessModule } from '../types';

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface RestaurantContextValue {
  // Restaurante activo
  restaurant: Restaurant | null;
  restaurantLoading: boolean;

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
  const { user } = useAuth();

  const [modules, setModules] = useState<BusinessModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<BusinessModule | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(true);

  // ── 1. Cargar módulos de restaurante disponibles para el usuario ──────────
  const fetchModules = useCallback(async () => {
    if (!user) {
      setModules([]);
      setModulesLoading(false);
      return;
    }
    setModulesLoading(true);

    // Intentar flujo de owner: business_modules con tipo_modulo = 'restaurant'
    // RLS filtra automáticamente por owner_id = auth.uid()
    const { data: ownerModules, error: ownerErr } = await supabase
      .from('business_modules')
      .select('*')
      .eq('tipo_modulo', 'restaurant')
      .eq('estado', 'activo');

    if (!ownerErr && ownerModules && ownerModules.length > 0) {
      setModules(ownerModules);
      setModulesLoading(false);
      return;
    }

    // Flujo de staff: usuarios_roles → obtener id_module → cruzar con business_modules
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
        setModulesLoading(false);
        return;
      }
    }

    setModules([]);
    setModulesLoading(false);
  }, [user]);

  // ── 2. Cargar datos del restaurante usando id_module ─────────────────────
  const fetchRestaurant = useCallback(async (mod: BusinessModule) => {
    setRestaurantLoading(true);
    const { data } = await supabase
      .from('restaurant')
      .select('*')
      .eq('id_module', mod.id_module)
      .maybeSingle();
    setRestaurant(data ?? null);
    setRestaurantLoading(false);
  }, []);

  // ── 3. Auto-selección cuando hay un solo módulo ───────────────────────────
  useEffect(() => {
    if (modulesLoading) return;

    if (modules.length === 1) {
      setActiveModule(modules[0]);
      return;
    }

    // Si ya había un módulo activo y sigue en la lista, mantenerlo
    if (activeModule) {
      const still = modules.find(m => m.id_module === activeModule.id_module);
      if (!still) setActiveModule(null);
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
    fetchModules();
    setActiveModule(null);
    setRestaurant(null);
  }, [user]);

  // ── Refetch completo (útil tras crear/editar datos) ───────────────────────
  const refetch = useCallback(async () => {
    if (activeModule) await fetchRestaurant(activeModule);
  }, [activeModule, fetchRestaurant]);

  const selectModule = useCallback((mod: BusinessModule) => {
    setActiveModule(mod);
  }, []);

  const needsSelector = !modulesLoading && modules.length > 1 && !activeModule;

  return (
    <RestaurantContext.Provider value={{
      restaurant,
      restaurantLoading,
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
