import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para cargar archivos media con autenticación de WAHA o Twilio
 * Convierte URLs protegidas en blob URLs para mostrar en el navegador
 */
export const useAuthenticatedMedia = (url: string | null, twilioConnectionId?: string | null) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determinar si es una URL protegida
  const isProtectedUrl = useMemo(() => {
    if (!url) return false;
    return url.includes('/api/files/') || url.includes('api.twilio.com') || url.includes('media.twiliocdn.com');
  }, [url]);

  // isLoading es true si tenemos URL protegida y aún no tenemos blobUrl
  const isLoading = isProtectedUrl && !blobUrl && !error;

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    const isWahaUrl = url.includes('/api/files/');
    const isTwilioUrl = url.includes('api.twilio.com') || url.includes('media.twiliocdn.com');

    // Si no es una URL protegida, usarla directamente
    if (!isWahaUrl && !isTwilioUrl) {
      setBlobUrl(url);
      return;
    }

    let isMounted = true;

    const loadAuthenticatedMedia = async () => {
      setError(null);

      try {
        let data: { file: string; mimeType: string } | null = null;

        if (isWahaUrl) {
          // Usar edge function de WAHA
          const { data: wahaData, error: invokeError } = await supabase.functions.invoke('waha-get-file', {
            body: { fileUrl: url }
          });

          if (invokeError) throw invokeError;
          if (!wahaData?.file) throw new Error('No se recibió el archivo');
          data = wahaData;
        } else if (isTwilioUrl) {
          // Usar edge function de Twilio
          console.log('[useAuthenticatedMedia] Fetching Twilio media:', { url, twilioConnectionId });
          const { data: twilioData, error: invokeError } = await supabase.functions.invoke('twilio-get-file', {
            body: { mediaUrl: url, twilioConnectionId: twilioConnectionId }
          });

          if (invokeError) {
            console.error('[useAuthenticatedMedia] Twilio invoke error:', invokeError);
            throw invokeError;
          }
          if (!twilioData?.file) throw new Error('No se recibió el archivo');
          data = twilioData;
        }

        if (!data) {
          // Solo para URLs no protegidas (fallback)
          if (!isTwilioUrl && !isWahaUrl) {
            setBlobUrl(url);
          } else {
            setError('No se pudo cargar el archivo');
          }
          return;
        }

        // Convertir base64 a blob
        const base64Data = data.file.split(',')[1] || data.file;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'application/octet-stream' });
        
        const newBlobUrl = URL.createObjectURL(blob);
        
        if (isMounted) {
          setBlobUrl(newBlobUrl);
        }
      } catch (err) {
        console.error('Error loading authenticated media:', err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Error al cargar el archivo';
          setError(errorMessage);
          // NO hacer fallback a URL original para Twilio - causa popup de auth
          // Solo hacer fallback para URLs no protegidas
          if (!isTwilioUrl && !isWahaUrl) {
            setBlobUrl(url);
          }
        }
      }
    };

    loadAuthenticatedMedia();

    // Cleanup: solo marcar como desmontado. NO revocar el blob aquí porque
    // puede estar siendo usado en otra pestaña (window.open) o en un modal.
    // El navegador liberará la memoria automáticamente al cerrar la pestaña.
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, twilioConnectionId]);

  return { blobUrl, isLoading, error };
};
