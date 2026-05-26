import { supabase } from '../api/supabase';

const BUCKET = import.meta.env.VITE_MEDIA_BUCKET ?? 'hotel-verona-media';

/**
 * Resolves gallery image URLs for a given entity type and ID.
 * Looks for files named: {type}/{id}-1.jpg, {id}-2.jpg, ... up to 6.
 */
export async function resolveGalleryUrls(type: string, id: string): Promise<string[]> {
  const urls: string[] = [];

  try {
    // Usamos list() para obtener los archivos en la carpeta (ej: habitacion/)
    const { data, error } = await supabase.storage.from(BUCKET).list(type, {
      search: id
    });

    if (error || !data) return [];

    // Filtramos los que coinciden con el id y tienen extensión jpg
    const files = data
      .map(f => f.name)
      .filter(name => name.startsWith(id) && name.endsWith('.jpg'))
      .sort(); // ej: id-1.jpg, id-2.jpg

    files.forEach(filename => {
      const path = `${type}/${filename}`;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (urlData?.publicUrl) {
        urls.push(urlData.publicUrl);
      }
    });
  } catch {
    /* skip */
  }

  return urls;
}
