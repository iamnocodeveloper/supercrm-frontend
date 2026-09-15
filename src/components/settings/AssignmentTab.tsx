import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAssignmentSettings, AssignStrategy } from '@/hooks/useAssignmentSettings';
import { useAccountUsers } from '@/hooks/useAccountUsers';
import { useAccountPresence } from '@/hooks/useAccountPresence';
import { Loader2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500/15 text-green-600 border-green-500/30',
  away: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  busy: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  offline: 'bg-muted text-muted-foreground border-border',
};
const STATUS_LABELS: Record<string, string> = {
  online: 'En línea',
  away: 'Ausente',
  busy: 'Ocupado',
  offline: 'Desconectado',
};

const AssignmentTab: React.FC = () => {
  const { settings, isLoading, update, isUpdating } = useAssignmentSettings();
  const { getCashiers } = useAccountUsers();
  const { rows, computeStatus, getRow } = useAccountPresence();
  const cashiers = getCashiers();

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Auto-asignación de conversaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Activar auto-asignación</Label>
              <p className="text-sm text-muted-foreground">
                Asigna conversaciones nuevas automáticamente a cajeros conectados.
              </p>
            </div>
            <Switch
              checked={settings.auto_assign_enabled}
              disabled={isUpdating}
              onCheckedChange={(v) => update({ auto_assign_enabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base">Estrategia de asignación</Label>
            <RadioGroup
              value={settings.assign_strategy}
              onValueChange={(v) => update({ assign_strategy: v as AssignStrategy })}
              disabled={isUpdating || !settings.auto_assign_enabled}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted/30">
                <RadioGroupItem value="round_robin" id="rr" />
                <Label htmlFor="rr" className="cursor-pointer flex-1">
                  <div className="font-medium">Round-robin</div>
                  <div className="text-xs text-muted-foreground">Rotación equitativa entre cajeros conectados.</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted/30">
                <RadioGroupItem value="least_load" id="ll" />
                <Label htmlFor="ll" className="cursor-pointer flex-1">
                  <div className="font-medium">Menor carga</div>
                  <div className="text-xs text-muted-foreground">Asigna al cajero con menos conversaciones activas.</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted/30">
                <RadioGroupItem value="manual" id="mn" />
                <Label htmlFor="mn" className="cursor-pointer flex-1">
                  <div className="font-medium">Manual</div>
                  <div className="text-xs text-muted-foreground">Sin auto-asignación; el admin asigna desde el chat.</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label className="text-base">Cajeros ven las conversaciones sin asignar</Label>
              <p className="text-sm text-muted-foreground">
                Si está desactivado, cada cajero solo ve sus conversaciones asignadas.
              </p>
            </div>
            <Switch
              checked={settings.include_unassigned_for_all}
              disabled={isUpdating}
              onCheckedChange={(v) => update({ include_unassigned_for_all: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Cajeros de la cuenta ({cashiers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cashiers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay cajeros registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashiers.map((c) => {
                  const row = getRow(c.id);
                  const status = row ? computeStatus(row) : 'offline';
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">
                          {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[status]}>
                          {STATUS_LABELS[status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row?.last_seen_at
                          ? formatDistanceToNow(new Date(row.last_seen_at), { addSuffix: true, locale: es })
                          : 'Nunca'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignmentTab;
