import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface TelegramConnectionFormProps {
  onClose: () => void;
}

const TelegramConnectionForm = ({ onClose }: TelegramConnectionFormProps) => {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span className="text-2xl">✈️</span>
            <span>Conectar Telegram</span>
          </DialogTitle>
        </DialogHeader>
        <div className="py-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-telegram-blue/10 mb-2">
            <Send className="h-8 w-8" style={{ color: 'hsl(var(--telegram-blue))' }} />
          </div>
          <h4 className="text-lg font-semibold">Próximamente</h4>
          <p className="text-muted-foreground max-w-md mx-auto">
            La funcionalidad de conexión para Telegram personal estará disponible pronto.
          </p>
          <div className="pt-4">
            <Button onClick={handleClose}>
              Entendido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TelegramConnectionForm;
