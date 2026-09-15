import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, MapPin, Globe, FileText, Calendar, Link as LinkIcon, Lock, Tag, X } from 'lucide-react';
import { webhookService } from '@/services/webhookService';
import { tagsServices, EtiquetaResponse } from '@/services/tagsServices';

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
  email: string | null;
  address: string | null;
  website: string | null;
  gender: string | null;
  birth_date: string | null;
  origin: string | null;
  is_blocked: boolean | null;
  notes: string | null;
}

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
}

export function ContactFormDialog({ open, onOpenChange, contact }: ContactFormDialogProps) {
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [etiquetas, setEtiquetas] = useState<EtiquetaResponse[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    address: '',
    website: '',
    notes: '',
    gender: '',
    birth_date: '',
    origin: '',
    is_blocked: false,
  });

  useEffect(() => {
    loadEtiquetas();
  }, []);

  const loadEtiquetas = async () => {
    const result = await tagsServices.getAllEtiquetas();
    if (result.success && result.data) {
      setEtiquetas(result.data);
    }
  };

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone_number: contact.phone_number || '',
        address: contact.address || '',
        website: contact.website || '',
        notes: contact.notes || '',
        gender: contact.gender || '',
        birth_date: contact.birth_date || '',
        origin: contact.origin || '',
        is_blocked: contact.is_blocked || false,
      });
      // Cargar tags del contacto si existe
      loadContactTags(contact.id);
    } else {
      resetForm();
    }
  }, [contact, open]);

  const loadContactTags = async (contactId: string) => {
    const { data } = await supabase
      .from('contacts')
      .select('tags')
      .eq('id', contactId)
      .single();
    
    if (data?.tags) {
      setSelectedTags(data.tags);
    } else {
      setSelectedTags([]);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      address: '',
      website: '',
      notes: '',
      gender: '',
      birth_date: '',
      origin: '',
      is_blocked: false,
    });
    setSelectedTags([]);
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim() || !formData.phone_number.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre y el teléfono son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const contactData = {
        user_id: effectiveUserId!,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim() || null,
        email: formData.email.trim() || null,
        phone_number: formData.phone_number.trim(),
        address: formData.address.trim() || null,
        website: formData.website.trim() || null,
        notes: formData.notes.trim() || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
        origin: formData.origin || null,
        is_blocked: formData.is_blocked,
        name: `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim(),
        tags: selectedTags.length > 0 ? selectedTags : null,
      };

      if (contact) {
        const { error } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', contact.id);

        if (error) throw error;

        toast({
          title: 'Contacto actualizado',
          description: 'El contacto se actualizó correctamente',
        });
      } else {
        const { data: newContact, error } = await supabase
          .from('contacts')
          .insert(contactData)
          .select()
          .single();

        if (error) throw error;

        // Enviar datos completos al webhook (asíncrono, no bloqueante)
        webhookService.sendFullContactCreated({
          id: newContact.id,
          first_name: newContact.first_name,
          last_name: newContact.last_name,
          name: newContact.name,
          phone_number: newContact.phone_number,
          email: newContact.email,
          address: newContact.address,
          website: newContact.website,
          notes: newContact.notes,
          gender: newContact.gender,
          birth_date: newContact.birth_date,
          origin: newContact.origin,
          is_blocked: newContact.is_blocked,
          user_id: newContact.user_id,
          created_at: newContact.created_at,
          updated_at: newContact.updated_at,
        }).catch(err => console.error('Error sending to webhook:', err));

        toast({
          title: 'Contacto creado',
          description: 'El contacto se creó correctamente',
        });
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el contacto',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contact ? 'Editar Contacto' : 'Nuevo Contacto'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Agregar un nuevo contacto a la base de datos
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">
              <User className="w-4 h-4 inline mr-2" />
              Nombre del contacto
            </Label>
            <Input
              id="first_name"
              placeholder="Nombre del contacto"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="last_name">
              <User className="w-4 h-4 inline mr-2" />
              Apellido del contacto
            </Label>
            <Input
              id="last_name"
              placeholder="Apellido del contacto"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              <Mail className="w-4 h-4 inline mr-2" />
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Correo electrónico"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">
              <Phone className="w-4 h-4 inline mr-2" />
              Número de teléfono
            </Label>
            <Input
              id="phone_number"
              placeholder="Número de teléfono"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">
              <MapPin className="w-4 h-4 inline mr-2" />
              Dirección
            </Label>
            <Input
              id="address"
              placeholder="Dirección"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">
              <Globe className="w-4 h-4 inline mr-2" />
              Sitio web
            </Label>
            <Input
              id="website"
              placeholder="Sitio web"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              <FileText className="w-4 h-4 inline mr-2" />
              Notas adicionales
            </Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">
              <User className="w-4 h-4 inline mr-2" />
              Seleccionar género
            </Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar género" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="femenino">Femenino</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date">
              <Calendar className="w-4 h-4 inline mr-2" />
              Fecha de nacimiento
            </Label>
            <Input
              id="birth_date"
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin">
              <LinkIcon className="w-4 h-4 inline mr-2" />
              Seleccionar origen
            </Label>
            <Select
              value={formData.origin}
              onValueChange={(value) => setFormData({ ...formData, origin: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar origen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Sitio web</SelectItem>
                <SelectItem value="referido">Referido</SelectItem>
                <SelectItem value="redes_sociales">Redes sociales</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Etiquetas */}
          <div className="space-y-2">
            <Label>
              <Tag className="w-4 h-4 inline mr-2" />
              Etiquetas
            </Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[60px]">
              {etiquetas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay etiquetas disponibles</p>
              ) : (
                etiquetas.map((etiqueta) => (
                  <Badge
                    key={etiqueta.id}
                    variant={selectedTags.includes(etiqueta.nombre) ? "default" : "outline"}
                    className="cursor-pointer transition-all"
                    style={{
                      backgroundColor: selectedTags.includes(etiqueta.nombre) ? etiqueta.color : 'transparent',
                      borderColor: etiqueta.color,
                      color: selectedTags.includes(etiqueta.nombre) ? 'white' : etiqueta.color,
                    }}
                    onClick={() => toggleTag(etiqueta.nombre)}
                  >
                    {etiqueta.nombre}
                    {selectedTags.includes(etiqueta.nombre) && (
                      <X className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <Label htmlFor="is_blocked" className="font-medium">
                  Bloquear contacto
                </Label>
                <p className="text-xs text-muted-foreground">
                  El contacto no podrá enviar mensajes
                </p>
              </div>
            </div>
            <Switch
              id="is_blocked"
              checked={formData.is_blocked}
              onCheckedChange={(checked) => setFormData({ ...formData, is_blocked: checked })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : contact ? 'Actualizar Contacto' : 'Crear Contacto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
