import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, MessageSquare, Paperclip } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface QuickReply {
  id: string;
  title: string;
  hotkey: string | null;
  message: string;
  attachment_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

const QuickReplies = () => {
  const { effectiveUserId } = useEffectiveUserId();
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    hotkey: '',
    message: '',
    attachment_urls: [] as string[]
  });

  useEffect(() => {
    if (effectiveUserId) {
      loadQuickReplies();
    }
  }, [effectiveUserId]);

  const loadQuickReplies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuickReplies(data || []);
    } catch (error) {
      console.error('Error loading quick replies:', error);
      toast({
        title: "Error",
        description: "Error al cargar las respuestas rápidas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Error",
        description: "El título y el mensaje son obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('quick_replies')
        .insert({
          user_id: effectiveUserId,
          title: formData.title,
          hotkey: formData.hotkey || null,
          message: formData.message,
          attachment_urls: formData.attachment_urls.length > 0 ? formData.attachment_urls : null
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Respuesta rápida creada correctamente"
      });

      setShowDialog(false);
      resetForm();
      loadQuickReplies();
    } catch (error) {
      console.error('Error creating quick reply:', error);
      toast({
        title: "Error",
        description: "Error al crear la respuesta rápida",
        variant: "destructive"
      });
    }
  };

  const handleUpdate = async () => {
    if (!editingReply || !formData.title.trim() || !formData.message.trim()) {
      toast({
        title: "Error",
        description: "El título y el mensaje son obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('quick_replies')
        .update({
          title: formData.title,
          hotkey: formData.hotkey || null,
          message: formData.message,
          attachment_urls: formData.attachment_urls.length > 0 ? formData.attachment_urls : null
        })
        .eq('id', editingReply.id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Respuesta rápida actualizada correctamente"
      });

      setShowDialog(false);
      resetForm();
      loadQuickReplies();
    } catch (error) {
      console.error('Error updating quick reply:', error);
      toast({
        title: "Error",
        description: "Error al actualizar la respuesta rápida",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_replies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Respuesta rápida eliminada correctamente"
      });

      loadQuickReplies();
    } catch (error) {
      console.error('Error deleting quick reply:', error);
      toast({
        title: "Error",
        description: "Error al eliminar la respuesta rápida",
        variant: "destructive"
      });
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingReply(null);
    setShowDialog(true);
  };

  const openEditDialog = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormData({
      title: reply.title,
      hotkey: reply.hotkey || '',
      message: reply.message,
      attachment_urls: reply.attachment_urls || []
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      hotkey: '',
      message: '',
      attachment_urls: []
    });
    setEditingReply(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando respuestas rápidas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Respuestas Rápidas</h2>
        </div>
        <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Respuesta
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Crea respuestas predefinidas para agilizar tus conversaciones
      </p>

      {quickReplies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              No hay respuestas rápidas creadas aún
            </p>
            <Button onClick={openCreateDialog} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Crear primera respuesta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickReplies.map((reply) => (
            <Card key={reply.id} className="hover:border-primary transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{reply.title}</h3>
                    {reply.hotkey && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded mt-1 inline-block">
                        {reply.hotkey}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(reply)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(reply.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 mt-2">
                  {reply.message}
                </p>
                {reply.attachment_urls && reply.attachment_urls.length > 0 && (
                  <div className="flex items-center space-x-1 mt-2 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span>{reply.attachment_urls.length} archivo(s)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingReply ? 'Editar Respuesta Rápida' : 'Nueva Respuesta Rápida'}
            </DialogTitle>
            <DialogDescription>
              {editingReply 
                ? 'Modifica los campos de la respuesta rápida'
                : 'Completa los campos para crear una nueva respuesta rápida'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Saludo inicial, Despedida, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotkey">Hotkey</Label>
              <Input
                id="hotkey"
                value={formData.hotkey}
                onChange={(e) => setFormData({ ...formData, hotkey: e.target.value })}
                placeholder="Ej: /"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attachments">Adjuntar Archivos</Label>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    toast({
                      title: "Función en desarrollo",
                      description: "La subida de archivos estará disponible próximamente"
                    });
                  }}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Seleccionar archivos
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">
                Mensaje <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Escribe el mensaje que quieres enviar..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={editingReply ? handleUpdate : handleCreate}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {editingReply ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickReplies;