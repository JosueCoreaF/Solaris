import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

// Middleware de autenticación básica (puede ampliarse con JWT)
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Por ahora, permitir todas las solicitudes
  // TODO: Implementar validación de JWT cuando sea necesario
  next();
};

// Middleware de manejo de errores
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error Middleware:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
  });
};
