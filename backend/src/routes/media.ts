import express from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// Multer: memoria (no disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpeg, png, webp, gif).'));
  },
});

const BUCKET = 'solaris-media';

/**
 * POST /api/media/upload
 * Body: multipart/form-data  { file, folder? }
 * Responde: { url: string }
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    if (!supabaseAdmin)  return res.status(500).json({ error: 'Storage admin no disponible.' });

    const folder = (req.body.folder as string) || 'general';
    const ext    = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const nombre = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(nombre, req.file.buffer, {
        contentType:  req.file.mimetype,
        cacheControl: '3600',
        upsert:       true,
      });

    if (error) return res.status(500).json({ error: error.message });

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(nombre);

    return res.json({ url: urlData.publicUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
