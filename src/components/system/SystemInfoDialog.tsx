import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { APP_BUILD_DATE, APP_CHANNELS, APP_NAME, APP_TECH, APP_VERSION } from '@/lib/appInfo';
import { Info } from 'lucide-react';

interface SystemInfoDialogProps {
  children: React.ReactNode;
}

export const SystemInfoDialog: React.FC<SystemInfoDialogProps> = ({ children }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Acerca de {APP_NAME}
          </DialogTitle>
          <DialogDescription>
            Plataforma multi-tenant de gestión de conversaciones y ventas por WhatsApp con agente de IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">Versión</p>
              <p className="font-medium">{APP_VERSION}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha de build</p>
              <p className="font-medium">{APP_BUILD_DATE}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-muted-foreground">Canales de mensajería</p>
            <div className="flex flex-wrap gap-1.5">
              {APP_CHANNELS.map((channel) => (
                <Badge key={channel} variant="secondary">
                  {channel}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-muted-foreground">Tecnologías</p>
            <div className="flex flex-wrap gap-1.5">
              {APP_TECH.map((tech) => (
                <Badge key={tech} variant="outline">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
