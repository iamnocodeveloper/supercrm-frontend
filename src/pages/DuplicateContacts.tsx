import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Scan, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  primary_contact_id: string;
  duplicate_contact_id: string;
  match_reason: string;
  status: string;
  detected_at: string;
}

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  created_at: string;
}

export default function DuplicateContacts() {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['duplicate-candidates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contact_duplicate_candidates')
        .select('*')
        .eq('status', 'pending')
        .order('detected_at', { ascending: false });
      return (data || []) as Candidate[];
    },
  });

  const ids = candidates.flatMap(c => [c.primary_contact_id, c.duplicate_contact_id]);
  const { data: contacts = [] } = useQuery({
    queryKey: ['duplicate-contacts-detail', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('contacts').select('id, name, phone_number, email, created_at').in('id', ids);
      return (data || []) as Contact[];
    },
  });
  const byId = new Map(contacts.map(c => [c.id, c]));

  const triggerScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-duplicate-contacts', { body: {} });
      if (error) throw error;
      toast.success(`Escaneo completado: ${data?.candidates || 0} candidatos`);
      qc.invalidateQueries({ queryKey: ['duplicate-candidates'] });
    } catch (e: any) {
      toast.error(e.message || 'Error en el escaneo');
    } finally {
      setScanning(false);
    }
  };

  const merge = async (c: Candidate, keepPrimary: boolean) => {
    const primary = keepPrimary ? c.primary_contact_id : c.duplicate_contact_id;
    const dup = keepPrimary ? c.duplicate_contact_id : c.primary_contact_id;
    const { error } = await supabase.functions.invoke('merge-contacts', {
      body: { primary_contact_id: primary, duplicate_contact_id: dup, candidate_id: c.id },
    });
    if (error) return toast.error(error.message);
    toast.success('Contactos fusionados');
    qc.invalidateQueries({ queryKey: ['duplicate-candidates'] });
  };

  const ignore = async (id: string) => {
    await supabase.from('contact_duplicate_candidates').update({ status: 'ignored', resolved_at: new Date().toISOString() }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['duplicate-candidates'] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Contactos duplicados</h1>
          <p className="text-sm text-muted-foreground">Detectá y fusioná contactos repetidos en distintos canales</p>
        </div>
        <Button onClick={triggerScan} disabled={scanning}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Scan className="h-4 w-4 mr-2" />}
          Escanear ahora
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : candidates.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No hay duplicados pendientes. Ejecutá un escaneo para detectar.</Card>
      ) : (
        <div className="space-y-3">
          {candidates.map(c => {
            const a = byId.get(c.primary_contact_id);
            const b = byId.get(c.duplicate_contact_id);
            if (!a || !b) return null;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary">{c.match_reason === 'same_phone' ? '📱 Mismo teléfono' : '📧 Mismo email'}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(c.detected_at).toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[a, b].map((ct, i) => (
                    <div key={ct.id} className="border rounded-lg p-3">
                      <div className="font-medium">{ct.name || '(sin nombre)'}</div>
                      <div className="text-sm text-muted-foreground">{ct.phone_number}</div>
                      {ct.email && <div className="text-sm text-muted-foreground">{ct.email}</div>}
                      <div className="text-xs text-muted-foreground mt-1">Creado: {new Date(ct.created_at).toLocaleDateString()}</div>
                      <Button size="sm" className="mt-2 w-full" onClick={() => merge(c, i === 0)}>
                        <Check className="h-3 w-3 mr-1" /> Conservar este, fusionar el otro
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3">
                  <Button size="sm" variant="ghost" onClick={() => ignore(c.id)}>
                    <X className="h-3 w-3 mr-1" /> Ignorar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
