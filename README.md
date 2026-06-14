# Solaris - PartnerCentral

Solaris es una plataforma "Multi-tenant" (múltiples inquilinos) diseñada para gestionar diversos modelos de negocio (Hoteles, Gimnasios, Restaurantes, etc.) desde un Hub centralizado. Cada negocio tiene su propia aplicación frontend y módulos específicos en el backend, compartiendo una base de datos centralizada en Supabase con seguridad de nivel de fila (RLS) para garantizar que los datos de cada propietario estén aislados y seguros.

## 💻 Tecnologías Utilizadas

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React (iconos), React Router.
- **Backend**: Node.js, Express.js, TypeScript.
- **Base de Datos & Autenticación**: Supabase (PostgreSQL), Row-Level Security (RLS) para el aislamiento de datos (Multi-tenant).
- **IA**: Google Gemini API (REST) — asistente conversacional con herramientas de acceso a la BD.
- **Pagos**: Stripe (módulo de billing con métodos de pago y suscripciones por módulo).
- **Gestión de Paquetes**: npm.
## 🏗️ Arquitectura del Proyecto

El proyecto está dividido en un monorepo (o estructura de múltiples carpetas) que separa claramente el Hub central, los módulos de cada negocio, el backend y la base de datos.

### Directorios Principales
- **`apps/hub/`**: La aplicación central (Dashboard/Panel de control). Es el punto de entrada para que los propietarios (owners) se registren, configuren su cuenta (setup) y creen/gestionen sus diferentes modelos de negocio.
  - **`pages/ChatHub.tsx`**: Asistente IA con 17 herramientas de acceso y escritura a la BD (consultas, reservas, huéspedes, pagos, habitaciones, métricas, etc.). Usa Gemini API vía REST.
  - **`pages/Billing.tsx`**: Módulo de facturación con suscripciones por módulo, métodos de pago y historial.
- **`apps/hotel/`**: Frontend específico para la gestión de hoteles.
- **`apps/gym/`**: Frontend específico para la gestión de gimnasios.
- **`apps/restaurant/`**: Frontend específico para la gestión de restaurantes.
- **`apps/admin/`**: Panel de administración interno (superadmin).
- **`apps/portal/`**: Portal público de landing page y acceso para propietarios.
- **`backend/`**: Servidor Node.js con Express.
  - **`routes/hub.ts`**: Rutas para autenticación y creación de negocios desde el Hub.
  - **`routes/ai.ts`**: Endpoint del asistente IA — procesa mensajes, ejecuta herramientas sobre la BD y devuelve respuestas en markdown.
  - **`routes/billing.ts`**: Gestión de suscripciones, métodos de pago y activación de módulos por plan.
  - **`routes/hotel/`, `routes/gym/`, `routes/restaurant/`**: Rutas específicas para cada módulo.
  - **`utils/tenantHelper.ts`**: Utilidad clave que ayuda a resolver el contexto del negocio actual, asegurando que las operaciones se realicen sobre el negocio (tenant) correcto.
- **`database/`**: Configuración de Supabase / PostgreSQL.
  - **`schema_00_base.sql`**: Tablas base (owners, business_modules, planes, billing).
  - **`schema_01_hotel.sql`**: Tablas del módulo hotel (habitaciones, reservas, huéspedes, pagos, etc.).
  - **`rls_*.sql`**: Scripts para aplicar políticas de seguridad Row-Level Security.

### 🔌 Puertos de Desarrollo (Frontend)
Para ejecutar el ecosistema en un entorno local, cada módulo tiene su propio puerto asignado para evitar colisiones:
- 🏢 **Hotel** (`apps/hotel`): **Puerto 5173**
- 🏠 **Hub** (`apps/hub`): **Puerto 5174** *(Panel central / Dashboard)*
- 🏋️‍♂️ **Gimnasio** (`apps/gym`): **Puerto 5175**
- 🍽️ **Restaurante** (`apps/restaurant`): **Puerto 5176**
- 🌐 **Portal** (`apps/portal`): **Puerto 5177**
- ⚙️ **Backend** (`backend`): **Puerto 4000**

---

## 🛠️ Cómo Agregar un Nuevo Modelo de Negocio

Si deseas expandir la plataforma y agregar un nuevo tipo de negocio (por ejemplo, `clinic` o `salon`), sigue estos pasos de manera estructurada:

### 1. Base de Datos (Obligatorio como Primer Paso)
Siguiendo la política estricta de la base de datos, siempre debes empezar actualizando el esquema central.
- Edita el archivo `database/schema.sql` y añade las tablas necesarias para el nuevo modelo (ej. `tabla_clinic`).
- **Reglas Estrictas**: 
  - Nunca alucinar nombres de tablas ni columnas.
  - Asegurarse de que cada tabla tenga `owner_id` (UUID, llave foránea hacia `auth.users`) para mantener el esquema multi-tenant seguro con RLS.
  - Mantener las relaciones de llaves foráneas correctas.
- Crea un archivo de políticas RLS, por ejemplo, `database/rls_clinic.sql`, donde definas políticas para que solo los dueños puedan leer/modificar sus propios datos basándose en el `owner_id`.

### 2. Frontend del Nuevo Módulo
- Crea una nueva aplicación dentro de la carpeta `apps/`.
- Usa una herramienta como Vite: `npx create-vite apps/clinic --template react-ts`
- Configura TailwindCSS y el ruteo interno de la misma forma que está estructurado `apps/gym` o `apps/hotel`.

### 3. Backend del Nuevo Módulo
- **Controladores de Contexto:** Crea `backend/src/controllers/clinic/context.controller.ts`. Utiliza `tenantHelper.ts` para obtener y verificar la información del owner y el negocio.
- **Rutas:** Crea el directorio `backend/src/routes/clinic/` y define sus endpoints (`index.ts`, `config.ts`, etc.).
- **Registrar Rutas:** Agrega las nuevas rutas en `backend/src/server.ts` (Ej. `app.use('/api/clinic', clinicRoutes);`).

### 4. Integración con el Hub (Panel Central)
Para que un usuario pueda crear este nuevo tipo de negocio desde su panel, debes actualizar el Hub central:
- **Frontend Hub (`apps/hub`)**:
  - Modifica `apps/hub/src/pages/Dashboard.tsx` para agregar la opción del nuevo módulo (ícono, botón de creación).
  - Actualiza el flujo de creación en `apps/hub/src/pages/SetupOwner.tsx` o `CreateBusiness.tsx` para que soporte el nuevo tipo de negocio.
  - Asegúrate de actualizar los servicios en `apps/hub/src/services/api.ts` para poder enviar los datos del nuevo negocio.
- **Backend Hub (`backend/src/routes/hub.ts`)**:
  - Modifica la lógica de registro de negocios en las rutas del Hub para interceptar cuando un owner crea un negocio del tipo nuevo y guárdalo correctamente en las tablas correspondientes defininas en el `schema.sql`.

## ✨ Características Recientes y Mejoras Visuales

- **Portal de Reservas con Mesh Gradient Animado**:
  - Rediseño estético y de usabilidad en la Landing Page de búsqueda (`apps/portal`).
  - Fondo dinámico fluido compuesto por esferas de colores en movimiento constante (tonos esmeralda, ámbar y azul) mediante **Framer Motion**, complementado por una cuadrícula semitransparente fija.
  - Logotipo del navbar rediseñado con un isotipo de rombo y punto solar brillante que representa la identidad de **Solarys**.
  - Reubicación y ajuste de dimensiones en componentes y tarjetas de hotel para evitar superposiciones de botones.
- **Soporte de Visores 360° (WebGL)**:
  - Integración nativa de visores panorámicos de 360 grados usando la librería **Pannellum** (cargada dinámicamente vía CDN) en la vista detallada de habitaciones.
  - Corrección de la subida de imágenes multipart para evitar colisiones con el tipo de contenido JSON predeterminado en las llamadas de Axios del frontend.
- **Sincronización de Reservas y Estado de Habitaciones**:
  - Automatización en la actualización física del estado de la habitación (`ocupada`, `limpieza`, `disponible`) según las transiciones de check-in, check-out o cancelaciones de las reservas del hotel.
- **Desacoplamiento de Roles del Personal de Gimnasios**:
  - Segregación completa de roles e invitaciones mediante tablas específicas (`usuarios_roles_gym`, `invitaciones_gym` y vista consolidada de personal) para mantener el multi-tenancy aislado por modelo de negocio.

---

## 🔒 Regla Estricta de Base de Datos
Cualquier desarrollador o agente que trabaje en este código **debe leer silenciosamente `database/schema.sql` antes de programar interacciones con la base de datos**.
1. **Cero Alucinaciones:** Usar nombres exactos de columnas tal como están en `schema.sql`.
2. **Tipado exacto:** Respetar UUIDs, arrays y ENUMs.
3. **Multi-tenant:** Incluir siempre el `owner_id` para garantizar que RLS funcione sin problemas.
4. Usar sintaxis oficial del cliente de Supabase (Ej. `.from('tabla_exacta').insert({...})`).
