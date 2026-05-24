import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthenticatedRequest extends Request {
  user?: any;
  ownerId?: string;
}

export const requireOwner = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      res.status(401).json({ error: 'Token no proporcionado o formato inválido' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Validar token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      res.status(401).json({ error: 'Token inválido o expirado' });
      return;
    }

    // Verificar si es propietario
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('rol', 'PROPIETARIO')
      .single();

    if (roleError || !roleData) {
      console.log(`Buscando owner por email (${user.email}) para auto-asociar...`);
      
      const { data: ownerByEmail, error: emailErr } = await supabaseAdmin
        .from('owners')
        .select('id_owner')
        .eq('email_contacto', user.email)
        .single();
        
      if (ownerByEmail) {
        console.log(`Auto-asociación exitosa. Owner ID: ${ownerByEmail.id_owner}`);
        req.user = user;
        req.ownerId = ownerByEmail.id_owner;
        next();
        return;
      }

      console.error('No se encontró rol ni perfil de owner para este email.');
      res.status(403).json({ error: 'Acceso denegado: Se requiere rol de PROPIETARIO' });
      return;
    }

    req.user = user;
    req.ownerId = roleData.owner_id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Error interno del servidor en la autenticación' });
  }
};
