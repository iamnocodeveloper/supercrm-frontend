import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, FileText, Image as ImageIcon, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthenticatedMedia } from '@/hooks/useAuthenticatedMedia';

interface AttachmentRendererProps {
  attachmentUrl: string;
  messageType?: string;
  isOutgoing: boolean;
  twilioConnectionId?: string | null;
}

const AttachmentRenderer: React.FC<AttachmentRendererProps> = ({
  attachmentUrl,
  messageType,
  isOutgoing,
  twilioConnectionId
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Usar hook para cargar archivos con autenticación
  const { blobUrl, isLoading: isLoadingMedia, error: mediaError } = useAuthenticatedMedia(attachmentUrl, twilioConnectionId);
  
  // Detectar si es una URL protegida de Twilio
  const isTwilioUrl = attachmentUrl.includes('api.twilio.com') || attachmentUrl.includes('media.twiliocdn.com');

  // Detectar tipo de archivo por extensión, URL o messageType
  const getFileType = (url: string, type?: string) => {
    // Primero verificar si tenemos messageType explícito
    if (type) {
      const normalizedType = type.toLowerCase();
      if (normalizedType === 'sticker') return 'sticker';
      if (normalizedType === 'image' || normalizedType.startsWith('image/')) return 'image';
      if (normalizedType === 'video' || normalizedType.startsWith('video/')) return 'video';
      if (normalizedType === 'audio' || normalizedType === 'ptt' || normalizedType.startsWith('audio/')) return 'audio';
      if (normalizedType === 'document' || normalizedType === 'application/pdf') return 'pdf';
    }
    
    // Detectar URLs de Twilio (no tienen extensión visible)
    if (url.includes('api.twilio.com') || url.includes('media.twiliocdn.com')) {
      // Si tenemos messageType, ya lo manejamos arriba
      // Por defecto asumir imagen para URLs de Twilio sin tipo
      if (!type) return 'image';
    }
    
    // Detectar URLs de WAHA
    if (url.includes('/api/files/')) {
      if (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov')) return 'video';
      if (url.includes('.mp3') || url.includes('.wav') || url.includes('.m4a') || url.includes('.ogg')) return 'audio';
      if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif')) return 'image';
      if (url.includes('.pdf')) return 'pdf';
    }
    
    // Detección por extensión estándar
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) return 'image';
    if (url.match(/\.(mp4|webm|mov|avi|mkv)$/i)) return 'video';
    if (url.match(/\.(mp3|wav|ogg|oga|m4a|aac)$/i)) return 'audio';
    if (url.match(/\.(pdf)$/i)) return 'pdf';
    if (url.match(/\.(doc|docx)$/i)) return 'document';
    if (url.match(/\.(txt)$/i)) return 'text';
    return 'file';
  };

  const fileType = getFileType(attachmentUrl, messageType);
  const fileName = attachmentUrl.split('/').pop() || 'archivo';

  // Funciones para audio
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setIsLoading(true);
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setIsLoading(false);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const downloadFile = () => {
    const href = (isTwilioUrl || attachmentUrl.includes('/api/files/'))
      ? blobUrl
      : (blobUrl || attachmentUrl);
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mostrar loader mientras carga el archivo con autenticación
  if (isLoadingMedia) {
    return (
      <div className="mb-2 flex items-center justify-center p-4">
        <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" />
      </div>
    );
  }

  // Mostrar error si falló la carga de archivo protegido (Twilio o WAHA)
  const isWahaUrl = attachmentUrl.includes('/api/files/');
  if (mediaError && (isTwilioUrl || isWahaUrl)) {
    return (
      <div className={cn(
        "mb-2 flex items-center gap-3 p-3 rounded-lg",
        isOutgoing ? "bg-[#005c4b]/20" : "bg-[#202c33]"
      )}>
        <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium",
            isOutgoing ? "text-white" : "text-[#e9edef]"
          )}>
            Error al cargar archivo
          </p>
          <p className={cn(
            "text-xs",
            isOutgoing ? "text-white/70" : "text-[#8696a0]"
          )}>
            {mediaError}
          </p>
        </div>
      </div>
    );
  }

  // URL segura para abrir/descargar: para URLs protegidas (Twilio/WAHA) usar SOLO blobUrl
  // para evitar el popup "Not Authorized" del navegador
  const isProtectedUrl = isTwilioUrl || attachmentUrl.includes('/api/files/');
  const safeOpenUrl = isProtectedUrl ? blobUrl : (blobUrl || attachmentUrl);

  // Renderizado según tipo de archivo
  switch (fileType) {
    case 'sticker':
      return (
        <div className="mb-2 w-40 h-40 flex items-center justify-center">
          <img
            src={blobUrl || attachmentUrl}
            alt="Sticker"
            className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => safeOpenUrl && window.open(safeOpenUrl, '_blank')}
            loading="lazy"
          />
        </div>
      );

    case 'image':
      return (
        <div className="mb-2 max-w-sm">
          <img
            src={blobUrl || attachmentUrl}
            alt="Imagen adjunta"
            className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity w-full h-auto"
            onClick={() => safeOpenUrl && window.open(safeOpenUrl, '_blank')}
            loading="lazy"
          />
        </div>
      );

    case 'video':
      // Para URLs de Twilio, solo renderizar si tenemos blobUrl
      if (isTwilioUrl && !blobUrl) {
        return (
          <div className="mb-2 flex items-center justify-center p-4">
            <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" />
          </div>
        );
      }
      return (
        <div className="mb-2 max-w-sm">
          <video 
            src={blobUrl || attachmentUrl} 
            controls 
            className="rounded-lg w-full h-auto"
            preload="metadata"
          />
        </div>
      );

    case 'audio':
      return (
        <div className="mb-2">
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg min-w-[280px]",
            isOutgoing 
              ? "bg-[#005c4b]/20" 
              : "bg-[#202c33]"
          )}>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-10 w-10 rounded-full p-0",
                isOutgoing 
                  ? "hover:bg-white/10 text-white" 
                  : "hover:bg-[#2a3942] text-[#00a884]"
              )}
              onClick={togglePlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Music className={cn(
                  "h-4 w-4",
                  isOutgoing ? "text-white/70" : "text-[#8696a0]"
                )} />
                <span className={cn(
                  "text-sm font-medium truncate",
                  isOutgoing ? "text-white" : "text-[#e9edef]"
                )}>
                  Audio
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <div 
                  className={cn(
                    "flex-1 h-1.5 rounded-full cursor-pointer",
                    isOutgoing ? "bg-white/20" : "bg-[#2a3942]"
                  )}
                  onClick={handleSeek}
                >
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      isOutgoing ? "bg-white" : "bg-[#00a884]"
                    )}
                    style={{ 
                      width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' 
                    }}
                  />
                </div>
                <span className={cn(
                  "text-xs min-w-[35px]",
                  isOutgoing ? "text-white/70" : "text-[#8696a0]"
                )}>
                  {duration > 0 ? formatTime(currentTime) : '0:00'}
                </span>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                isOutgoing 
                  ? "hover:bg-white/10 text-white" 
                  : "hover:bg-[#2a3942] text-[#8696a0]"
              )}
              onClick={downloadFile}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Solo renderizar audio element si tenemos blobUrl para Twilio */}
          {(!isTwilioUrl || blobUrl) && (
            <audio
              ref={audioRef}
              src={blobUrl || attachmentUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onCanPlay={handleCanPlay}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            />
          )}
        </div>
      );

    case 'pdf':
      return (
        <div className="mb-2">
          <button
            type="button"
            onClick={downloadFile}
            disabled={!safeOpenUrl}
            className="block w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity",
              isOutgoing 
                ? "bg-[#005c4b]/20" 
                : "bg-[#202c33]"
            )}>
              <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  isOutgoing ? "text-white" : "text-[#e9edef]"
                )}>
                  {fileName}
                </p>
                <p className={cn(
                  "text-xs",
                  isOutgoing ? "text-white/70" : "text-[#8696a0]"
                )}>
                  Documento PDF
                </p>
              </div>
              <Download className={cn(
                "h-4 w-4 flex-shrink-0",
                isOutgoing ? "text-white/70" : "text-[#8696a0]"
              )} />
            </div>
          </button>
        </div>
      );

    case 'document':
      return (
        <div className="mb-2">
          <button
            type="button"
            onClick={downloadFile}
            disabled={!safeOpenUrl}
            className="block w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity",
              isOutgoing 
                ? "bg-[#005c4b]/20" 
                : "bg-[#202c33]"
            )}>
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  isOutgoing ? "text-white" : "text-[#e9edef]"
                )}>
                  {fileName}
                </p>
                <p className={cn(
                  "text-xs",
                  isOutgoing ? "text-white/70" : "text-[#8696a0]"
                )}>
                  Documento Word
                </p>
              </div>
              <Download className={cn(
                "h-4 w-4 flex-shrink-0",
                isOutgoing ? "text-white/70" : "text-[#8696a0]"
              )} />
            </div>
          </button>
        </div>
      );

    default:
      return (
        <div className="mb-2">
          <button
            type="button"
            onClick={downloadFile}
            disabled={!safeOpenUrl}
            className="block w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity",
              isOutgoing 
                ? "bg-[#005c4b]/20" 
                : "bg-[#202c33]"
            )}>
              <div className="h-10 w-10 rounded-lg bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  isOutgoing ? "text-white" : "text-[#e9edef]"
                )}>
                  {fileName}
                </p>
                <p className={cn(
                  "text-xs",
                  isOutgoing ? "text-white/70" : "text-[#8696a0]"
                )}>
                  Archivo adjunto
                </p>
              </div>
              <Download className={cn(
                "h-4 w-4 flex-shrink-0",
                isOutgoing ? "text-white/70" : "text-[#8696a0]"
              )} />
            </div>
          </button>
        </div>
      );
  }
};

export default AttachmentRenderer;