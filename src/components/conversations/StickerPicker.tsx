import React, { useEffect, useState, useRef } from 'react';
import { Sticker, Upload, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import {
  listSavedStickers,
  saveStickerToLibrary,
  removeSavedSticker,
  incrementStickerUsage,
  STICKER_ACCEPT,
  SavedSticker
} from '@/services/stickerService';

interface StickerPickerProps {
  disabled?: boolean;
  isSending?: boolean;
  onSelect: (sticker: { url: string; name: string; mimeType: string }) => Promise<void> | void;
}

const StickerPicker: React.FC<StickerPickerProps> = ({ disabled, isSending, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [stickers, setStickers] = useState<SavedSticker[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();

  const load = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    setStickers(await listSavedStickers(effectiveUserId));
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, effectiveUserId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file || !user?.id || !effectiveUserId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'El sticker debe pesar menos de 5MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const res = await saveStickerToLibrary(file, user.id, effectiveUserId);
    setUploading(false);

    if (!res.success || !res.sticker) {
      toast({ title: 'No se pudo guardar el sticker', description: res.error, variant: 'destructive' });
      return;
    }
    setStickers(prev => [res.sticker!, ...prev]);
    toast({ title: 'Sticker guardado', description: 'Ya puedes usarlo en cualquier conversación' });
  };

  const handleDelete = async (sticker: SavedSticker) => {
    const ok = await removeSavedSticker(sticker);
    if (!ok) {
      toast({ title: 'No se pudo eliminar el sticker', variant: 'destructive' });
      return;
    }
    setStickers(prev => prev.filter(s => s.id !== sticker.id));
  };

  const handleSelect = async (sticker: SavedSticker) => {
    setOpen(false);
    await onSelect({
      url: sticker.file_url,
      name: sticker.name || 'sticker.webp',
      mimeType: sticker.mime_type || 'image/webp'
    });
    incrementStickerUsage(sticker);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} title="Stickers">
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sticker className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Stickers guardados</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
            Subir
          </Button>
        </div>

        <input
          type="file"
          ref={inputRef}
          onChange={handleUpload}
          accept={STICKER_ACCEPT}
          className="hidden"
        />

        <ScrollArea className="h-56">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : stickers.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-10 px-4">
              Aún no tienes stickers. Sube una imagen (webp, png, gif o jpg) y quedará guardada para usarla en todas las conversaciones.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 pr-2">
              {stickers.map(sticker => (
                <div key={sticker.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleSelect(sticker)}
                    className="w-full aspect-square rounded-md border border-border bg-muted/40 hover:bg-muted transition-colors overflow-hidden"
                    title={sticker.name || 'Sticker'}
                  >
                    <img
                      src={sticker.file_url}
                      alt={sticker.name || 'Sticker'}
                      loading="lazy"
                      className="w-full h-full object-contain p-1"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sticker)}
                    className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-destructive text-destructive-foreground"
                    title="Eliminar sticker"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default StickerPicker;
