import { supabase } from '@/integrations/supabase/client';

export interface FileUploadResult {
  url: string;
  path: string;
}

export class FileUploadService {
  /**
   * Sube un archivo a Supabase Storage y retorna la URL pública
   */
  static async uploadFile(
    file: File,
    userId: string,
    conversationId: string
  ): Promise<FileUploadResult> {
    try {
      // Generar path único: userId/conversationId/timestamp-filename
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${userId}/${conversationId}/${timestamp}-${sanitizedFileName}`;

      console.log('[FileUploadService] Uploading file:', {
        fileName: file.name,
        size: file.size,
        type: file.type,
        path: filePath
      });

      // Subir archivo a Storage
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('[FileUploadService] Upload error:', error);
        throw error;
      }

      console.log('[FileUploadService] File uploaded successfully:', data);

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      console.log('[FileUploadService] Public URL:', publicUrl);

      return {
        url: publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('[FileUploadService] Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Elimina un archivo de Supabase Storage
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from('chat-attachments')
        .remove([filePath]);

      if (error) {
        console.error('[FileUploadService] Delete error:', error);
        throw error;
      }

      console.log('[FileUploadService] File deleted successfully:', filePath);
    } catch (error) {
      console.error('[FileUploadService] Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Valida el tipo y tamaño del archivo
   */
  static validateFile(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
    // Validar tamaño
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `El archivo debe ser menor a ${maxSizeMB}MB`
      };
    }

    // Tipos permitidos
    const allowedTypes = [
      // Imágenes
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // Videos
      'video/mp4',
      'video/3gpp',
      'video/quicktime',
      // Audio
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/wav',
      'audio/aac',
      // Documentos
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Tipo de archivo no soportado'
      };
    }

    return { valid: true };
  }
}
