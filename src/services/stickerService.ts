import { supabase } from '@/integrations/supabase/client';

const STICKERS_BUCKET = 'stickers';

let bucketEnsured = false;

/**
 * Asegura que el bucket de stickers exista. Si no existe, lo crea (público para que las URLs
 * públicas funcionen al enviar al Player Portal / WhatsApp / Twilio).
 */
export async function ensureStickersBucket(): Promise<boolean> {
  if (bucketEnsured) return true;
  try {
    const { data: existing, error: listError } = await supabase.storage.getBucket(STICKERS_BUCKET);
    if (existing && !listError) {
      bucketEnsured = true;
      return true;
    }

    const { error: createError } = await supabase.storage.createBucket(STICKERS_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/webp', 'image/png', 'image/gif', 'image/jpeg']
    });

    if (createError) {
      // "Bucket already exists" no es un error fatal
      if (createError.message?.toLowerCase().includes('already exists')) {
        bucketEnsured = true;
        return true;
      }
      console.error('[stickerService] Error creating bucket:', createError);
      return false;
    }

    bucketEnsured = true;
    return true;
  } catch (e) {
    console.error('[stickerService] ensureStickersBucket error:', e);
    return false;
  }
}

export interface UploadStickerResult {
  success: boolean;
  publicUrl?: string;
  filePath?: string;
  error?: string;
}

export interface SavedSticker {
  id: string;
  name: string | null;
  file_url: string;
  file_path: string | null;
  mime_type: string | null;
  usage_count: number;
  created_at: string;
}

/**
 * Sube un sticker al bucket de Storage y retorna la URL pública.
 * El path se genera como: <userId>/<timestamp>_<random>.<ext>
 */
export async function uploadSticker(
  file: File,
  userId: string
): Promise<UploadStickerResult> {
  try {
    const ok = await ensureStickersBucket();
    if (!ok) {
      return { success: false, error: 'No se pudo preparar el bucket de stickers' };
    }

    const ext = (file.name.split('.').pop() || 'webp').toLowerCase();
    const safeExt = ['webp', 'png', 'gif', 'jpg', 'jpeg'].includes(ext) ? ext : 'webp';
    const randomId = Math.random().toString(36).slice(2, 10);
    const ts = Date.now();
    const path = `${userId}/${ts}_${randomId}.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STICKERS_BUCKET)
      .upload(path, file, {
        contentType: file.type || 'image/webp',
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('[stickerService] Upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: publicData } = supabase.storage
      .from(STICKERS_BUCKET)
      .getPublicUrl(path);

    return {
      success: true,
      publicUrl: publicData.publicUrl,
      filePath: path
    };
  } catch (e: any) {
    console.error('[stickerService] uploadSticker error:', e);
    return { success: false, error: e?.message ?? 'Error desconocido' };
  }
}

/**
 * Elimina un sticker del bucket por su filePath.
 */
export async function deleteSticker(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(STICKERS_BUCKET)
      .remove([filePath]);
    if (error) {
      console.error('[stickerService] Delete error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[stickerService] deleteSticker error:', e);
    return false;
  }
}

/* ============ Biblioteca de stickers guardados ============ */

export async function listSavedStickers(accountOwnerId: string): Promise<SavedSticker[]> {
  const { data, error } = await supabase
    .from('stickers')
    .select('id, name, file_url, file_path, mime_type, usage_count, created_at')
    .eq('account_owner_id', accountOwnerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[stickerService] listSavedStickers error:', error);
    return [];
  }
  return (data || []) as SavedSticker[];
}

/**
 * Sube un archivo y lo guarda en la biblioteca de stickers de la cuenta.
 */
export async function saveStickerToLibrary(
  file: File,
  userId: string,
  accountOwnerId: string
): Promise<{ success: boolean; sticker?: SavedSticker; error?: string }> {
  const upload = await uploadSticker(file, accountOwnerId);
  if (!upload.success || !upload.publicUrl) {
    return { success: false, error: upload.error || 'No se pudo subir el sticker' };
  }

  const { data, error } = await supabase
    .from('stickers')
    .insert({
      account_owner_id: accountOwnerId,
      created_by: userId,
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
      file_url: upload.publicUrl,
      file_path: upload.filePath,
      mime_type: file.type || 'image/webp'
    })
    .select('id, name, file_url, file_path, mime_type, usage_count, created_at')
    .single();

  if (error) {
    console.error('[stickerService] saveStickerToLibrary error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, sticker: data as SavedSticker };
}

export async function removeSavedSticker(sticker: SavedSticker): Promise<boolean> {
  const { error } = await supabase.from('stickers').delete().eq('id', sticker.id);
  if (error) {
    console.error('[stickerService] removeSavedSticker error:', error);
    return false;
  }
  if (sticker.file_path) {
    await deleteSticker(sticker.file_path);
  }
  return true;
}

export async function incrementStickerUsage(sticker: SavedSticker): Promise<void> {
  await supabase
    .from('stickers')
    .update({ usage_count: (sticker.usage_count ?? 0) + 1 })
    .eq('id', sticker.id);
}

export const STICKER_ACCEPT = 'image/webp,image/png,image/gif,image/jpeg';
export const STICKER_MIME_TYPES = ['image/webp', 'image/png', 'image/gif', 'image/jpeg'];

export const stickerService = {
  ensureStickersBucket,
  uploadSticker,
  deleteSticker,
  listSavedStickers,
  saveStickerToLibrary,
  removeSavedSticker,
  incrementStickerUsage
};

export default stickerService;
