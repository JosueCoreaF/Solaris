import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config_env, supabase } from './config/supabase.js';
import rolesRouter from './routes/roles.js';
import usersRouter from './routes/users.js';
import mediaRouter from './routes/media.js';
import auditRouter from './routes/audit.js';
import publicRouter from './routes/public.js';
import hubRouter from './routes/hub.js';
// Hotel sub-routers
import hotelRouter from './routes/hotel/index.js';
import configRouter from './routes/hotel/config.js';
import bookingsRouter from './routes/hotel/bookings.js';
import tarifasRouter from './routes/hotel/tarifas.js';
import reportesRouter from './routes/hotel/reportes.js';
import finanzasRouter from './routes/hotel/finanzas.js';
import chatRouter, { setIO } from './routes/hotel/chat.js';
import gymRouter from './routes/gym/index.js';
import restaurantRouter from './routes/restaurant/index.js';
import { startExchangeRateScheduler } from './utils/exchangeRateUpdater.js';

config();

const app: Express = express();
const server = http.createServer(app);

// Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: config_env.corsOrigin.split(',').map((o: string) => o.trim()),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Pasar io a rutas
setIO(io);

// Middleware
const allowedOrigins = config_env.corsOrigin.split(',').map((o: string) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Permite sin origin (curl, Postman) o cualquiera de los orígenes configurados
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: ${origin} no permitido`));
    }
  },
  credentials: true,
}));

// Middleware de logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

import billingRouter from './routes/billing.js';
import supportRouter from './routes/support.js';

// Rutas que necesitan raw body (Stripe Webhook) deben ir antes de express.json()
app.use('/api/hub/billing', billingRouter);
app.use('/api/hub/support', supportRouter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Health Check
app.get('/api/health-check', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('hoteles').select('id_hotel').limit(1);
    if (error) throw error;
    res.status(200).json({ status: 'online', database: 'connected' });
  } catch (err: any) {
    res.status(500).json({ status: 'offline', error: err.message });
  }
});

// API Routes
app.use('/api/roles', rolesRouter);
app.use('/api/users', usersRouter);
app.use('/api/media', mediaRouter);
app.use('/api/hub', hubRouter);
app.use('/api', auditRouter);
// Hotel routes (todas bajo /api/hotel/*)
app.use('/api/hotel', hotelRouter);
app.use('/api/gym', gymRouter);
app.use('/api/restaurant', restaurantRouter);
// Compat aliases (mantener URLs antiguas funcionando durante la migración)
app.use('/api/config', configRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/tarifas', tarifasRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/finanzas', finanzasRouter);
app.use('/api/chat', chatRouter);
app.use('/api/public', publicRouter);
import habitacionesRouter from './routes/hotel/habitaciones.js';
app.use('/api/habitaciones', habitacionesRouter);

// Placeholder para rutas (a implementar)
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'Sistema de Gestión Hotelera - Backend API v1.0',
    endpoints: {
      health: 'GET /api/health',
      reservations: 'GET /api/reservations',
      rooms: 'GET /api/rooms',
      finance: 'GET /api/finance',
      config: 'GET /api/config',
      chat: 'GET /api/chat/channels',
    },
  });
});

// ════ SOCKET.IO EVENTS ═════════════════════════════════════════

io.on('connection', (socket) => {
  console.log(`👤 Usuario conectado: ${socket.id}`);

  // Join channel
  socket.on('join_channel', (channelId: string) => {
    socket.join(`channel:${channelId}`);
    console.log(`✅ Usuario ${socket.id} se unió a channel:${channelId}`);
  });

  // Leave channel
  socket.on('leave_channel', (channelId: string) => {
    socket.leave(`channel:${channelId}`);
    console.log(`❌ Usuario ${socket.id} salió de channel:${channelId}`);
  });

  // Typing indicator
  socket.on('typing', (channelId: string, userData: any) => {
    socket.to(`channel:${channelId}`).emit('user_typing', userData);
  });

  // Stop typing
  socket.on('stop_typing', (channelId: string, userData: any) => {
    socket.to(`channel:${channelId}`).emit('user_stop_typing', userData);
  });

  socket.on('disconnect', () => {
    console.log(`👤 Usuario desconectado: ${socket.id}`);
  });
});

// Manejo de rutas no encontradas
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method,
  });
});

// Manejo de errores global
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: config_env.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Iniciar servidor
const PORT = config_env.port;
server.listen(PORT, () => {
  console.log(`🏨 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📍 Ambiente: ${config_env.nodeEnv}`);
  console.log(`🌐 CORS Origin: ${config_env.corsOrigin}`);
  console.log(`💬 WebSocket escuchando en ws://localhost:${PORT}`);
  
  // Iniciar actualizador automático de tasa de cambio (cada 12 horas)
  startExchangeRateScheduler();
});
