import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const logString = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}\nError: ${err.message}\nStack: ${err.stack}\n`;
  
  try {
    fs.appendFileSync(path.join(process.cwd(), 'backend-error.log'), logString + '\n\n');
  } catch (fsErr) {
    console.error('Failed to write to log file', fsErr);
  }

  console.error('\x1b[31m%s\x1b[0m', '🔥 Error Crítico Detectado:');
  console.error('\x1b[31m%s\x1b[0m', err.message);

  res.status(500).json({ error: 'Error interno del servidor' });
}
