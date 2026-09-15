import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { MessageTriggerList } from './MessageTriggerList';
import type { Tables } from '@/integrations/supabase/types';

type LeadColumn = Tables<'lead_columns'>;

interface MessageTriggersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  column: LeadColumn | null;
}

export const MessageTriggersDialog: React.FC<MessageTriggersDialogProps> = ({
  isOpen,
  onClose,
  column,
}) => {
  if (!column) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: column.color }}
            />
            Disparadores de Mensaje - {column.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <MessageTriggerList 
            columnId={column.id} 
            columnName={column.name}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};