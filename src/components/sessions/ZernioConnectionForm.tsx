// =====================================================================
// ZernioConnectionForm — Conectar números a la WhatsApp API oficial
// vía Zernio, con soporte MULTI-CUENTA (varias API keys).
//
// Flujo:
//   1) Agregar una o más cuentas Zernio (label + API key).
//   2) Registrar el webhook de cada cuenta (botón "Webhook").
//   3) Conectar un número (Embedded Signup o credenciales Meta).
//
// Al volver de Zernio, esta pantalla detecta el redirect y completa.
// =====================================================================

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, RefreshCw, Trash2, Webhook, ShieldCheck, QrCode } from 'lucide-react';
import { zernioService, ZernioAccountSafe, readZernioRedirect } from '@/services/zernioService';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';

interface Props {
  onClose: () => void;
}

const PENDING_KEY = 'zernio_pending_connection';

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (['ok', 'connected'].includes(status)) return 'default';
  if (['invalid', 'error', 'limited'].includes(status)) return 'destructive';
  return 'secondary';
};

const ZernioConnectionForm: React.FC<Props> = ({ onClose }) => {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ZernioAccountSafe[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();

  // Alta de cuenta
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');

  // Conexión de número
  const [selectedAccount, setSelectedAccount] = useState('');
  const [connName, setConnName] = useState('');
  const [mode, setMode] = useState<'signup' | 'credentials'>('signup');
  const [creds, setCreds] = useState({ accessToken: '', wabaId: '', phoneNumberId: '', pin: '' });

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 150);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await zernioService.listAccounts();
      setAccounts(res.accounts ?? []);
      if (!selectedAccount && res.accounts?.length) setSelectedAccount(res.accounts[0].id);
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  // Callback de Zernio al volver del Embedded Signup
  useEffect(() => {
    const r = readZernioRedirect();
    if (!r.connected && !r.error) return;

    const pending = localStorage.getItem(PENDING_KEY);
    const run = async () => {
      try {
        if (r.error) {
          toast({ title: 'Conexión cancelada', description: r.error, variant: 'destructive' });
          return;
        }
        if (!pending) return;

        if (r.step === 'select_phone_number' && r.tempToken) {
          const list = await zernioService.listNumbers(pending, r.tempToken);
          const nums = (list.phoneNumbers ?? []) as any[];
          if (nums.length > 0) {
            const chosen = nums[0];
            await zernioService.selectNumber({
              connectionId: pending,
              phoneNumberId: chosen.id,
              wabaId: chosen.wabaId,
              tempToken: r.tempToken,
            });
            toast({ title: 'Número conectado', description: chosen.display_phone_number });
          }
          localStorage.removeItem(PENDING_KEY);
          load();
          return;
        }

        if (r.accountId) {
          await zernioService.completeConnect({
            connectionId: pending,
            externalAccountId: r.accountId,
            phoneNumber: r.username ?? undefined,
          });
          toast({ title: 'Número conectado', description: 'WhatsApp API oficial activa' });
        }
        localStorage.removeItem(PENDING_KEY);
        load();
      } catch (e) {
        toast({ title: 'Error completando conexión', description: (e as Error).message, variant: 'destructive' });
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddAccount = async () => {
    if (!newLabel.trim() || !newKey.trim()) return;
    setBusy('add-account');
    try {
      await zernioService.createAccount({ label: newLabel.trim(), api_key: newKey.trim() });
      setNewLabel('');
      setNewKey('');
      toast({ title: 'Cuenta agregada' });
      load();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async (id: string) => {
    setBusy(`test-${id}`);
    try {
      const res = await zernioService.testAccount(id);
      toast({
        title: res.success ? 'Cuenta OK' : 'Cuenta con problemas',
        description: res.account?.status,
        variant: res.success ? 'default' : 'destructive',
      });
      load();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleWebhook = async (id: string) => {
    setBusy(`hook-${id}`);
    try {
      const res = await zernioService.ensureWebhook(id);
      toast({ title: 'Webhook registrado', description: res.url });
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta cuenta Zernio?')) return;
    setBusy(`del-${id}`);
    try {
      await zernioService.deleteAccount(id);
      toast({ title: 'Cuenta eliminada' });
      load();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleConnect = async () => {
    if (!selectedAccount) return;
    setBusy('connect');
    try {
      const redirectUrl = `${window.location.origin}/configuracion`;

      if (mode === 'signup') {
        const res = await zernioService.startConnect({
          zernio_account_id: selectedAccount,
          name: connName || `zernio-${Date.now().toString(36).slice(-6)}`,
          redirectUrl,
          onboarding: 'api',
        });
        localStorage.setItem(PENDING_KEY, res.connectionId);
        window.location.href = res.authUrl;
        return;
      }

      const res: any = await zernioService.credentialsConnect({
        zernio_account_id: selectedAccount,
        name: connName || `zernio-${Date.now().toString(36).slice(-6)}`,
        accessToken: creds.accessToken.trim(),
        wabaId: creds.wabaId.trim(),
        phoneNumberId: creds.phoneNumberId.trim(),
        ...(creds.pin.trim() ? { pin: creds.pin.trim() } : {}),
      });
      toast({
        title: 'Número conectado',
        description: res?.warning ? `Aviso: ${res.warning}` : 'WhatsApp API oficial activa',
        variant: res?.warning ? 'destructive' : 'default',
      });
      setCreds({ accessToken: '', wabaId: '', phoneNumberId: '', pin: '' });
      load();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>WhatsApp API oficial (Zernio)</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ---------- Cuentas Zernio ---------- */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Cuentas Zernio (multi-cuenta)</h3>
              <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Si una cuenta se limita o agota, agregá otra con su API key y conectá ahí los números.
            </p>

            {accounts.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">Todavía no hay cuentas.</p>
            )}

            {accounts.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-[140px]">
                    <div className="font-medium">{a.label}</div>
                    <div className="text-xs text-muted-foreground">
                      prioridad {a.priority} · {a.is_active ? 'activa' : 'inactiva'}
                    </div>
                  </div>
                  <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleTest(a.id)} disabled={busy === `test-${a.id}`}>
                      {busy === `test-${a.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleWebhook(a.id)} disabled={busy === `hook-${a.id}`}>
                      {busy === `hook-${a.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(a.id)} disabled={busy === `del-${a.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div>
                <Label>Nombre</Label>
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Zernio principal" />
              </div>
              <div>
                <Label>API key</Label>
                <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="zk_..." type="password" />
              </div>
              <Button onClick={handleAddAccount} disabled={busy === 'add-account' || !newLabel || !newKey}>
                {busy === 'add-account' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Agregar
              </Button>
            </div>
          </section>

          <Separator />

          {/* ---------- Conectar número ---------- */}
          <section className="space-y-3">
            <h3 className="font-semibold">Conectar un número</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Cuenta Zernio</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {accounts.filter((a) => a.is_active).map((a) => (
                    <option key={a.id} value={a.id}>{a.label} ({a.status})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Nombre de la conexión</Label>
                <Input value={connName} onChange={(e) => setConnName(e.target.value)} placeholder="WhatsApp ventas" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant={mode === 'signup' ? 'default' : 'outline'} size="sm" onClick={() => setMode('signup')}>
                <QrCode className="h-4 w-4 mr-2" /> Embedded Signup
              </Button>
              <Button variant={mode === 'credentials' ? 'default' : 'outline'} size="sm" onClick={() => setMode('credentials')}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Credenciales Meta
              </Button>
            </div>

            {mode === 'credentials' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>System User access token</Label>
                  <Input value={creds.accessToken} onChange={(e) => setCreds({ ...creds, accessToken: e.target.value })} type="password" />
                </div>
                <div>
                  <Label>WABA ID</Label>
                  <Input value={creds.wabaId} onChange={(e) => setCreds({ ...creds, wabaId: e.target.value })} />
                </div>
                <div>
                  <Label>Phone Number ID</Label>
                  <Input value={creds.phoneNumberId} onChange={(e) => setCreds({ ...creds, phoneNumberId: e.target.value })} />
                </div>
                <div>
                  <Label>PIN 2 pasos (opcional)</Label>
                  <Input value={creds.pin} onChange={(e) => setCreds({ ...creds, pin: e.target.value })} />
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={!selectedAccount || busy === 'connect' || (mode === 'credentials' && (!creds.accessToken || !creds.wabaId || !creds.phoneNumberId))}
            >
              {busy === 'connect' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {mode === 'signup' ? 'Conectar con Embedded Signup' : 'Conectar con credenciales'}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ZernioConnectionForm;
