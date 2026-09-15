import React, { useState, useEffect } from 'react';
import { User, Calendar, MapPin, Users, Filter, FileText, DollarSign, ChevronDown, ChevronUp, Plus, Edit2, Coins, TrendingUp, TrendingDown, UserPlus, Key, RefreshCw, Bot, BotOff, Eye, EyeOff, Tag, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { contactDetailsService, ContactDetail, ContactSale } from '@/services/contactDetailsService';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { casinoApiService } from '@/services/casinoApiService';
import { proxiedFetch } from '@/services/internalProxy';
import { supabase } from '@/integrations/supabase/client';
import { useBotBlock } from '@/hooks/useBotBlock';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { embudoServices, EmbudoResponse } from '@/services/embudoServices';
import { useProfile } from '@/hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { tagsServices, EtiquetaResponse } from '@/services/tagsServices';
import { Badge } from '@/components/ui/badge';
import { AssignedAgentSection } from './AssignedAgentSection';
import { WhatsAppGroupQuickCreate } from '@/components/whatsapp/WhatsAppGroupQuickCreate';

interface ContactInfoPanelProps {
  conversationId?: string;
  contactName: string;
  phoneNumber: string;
  whatsappNumber?: string | null;
  hideFunnel?: boolean;
  darkMode?: boolean;
  channelType?: string | null;
}

export const ContactInfoPanel: React.FC<ContactInfoPanelProps> = ({
  conversationId = '',
  contactName,
  phoneNumber,
  whatsappNumber,
  hideFunnel = false,
  darkMode = false,
  channelType,
}) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isBlocked, isLoading: isBotToggling, toggleBotBlock } = useBotBlock(phoneNumber, contactName);
  const { isCajero } = useProfile();
  const { getSessionNameByPhone } = useWhatsAppConnections();
  
  // Función para enmascarar números de teléfono
  const maskPhoneNumber = (phone: string) => {
    if (!phone) return '';
    return '****' + phone.slice(-4);
  };
  
  const [contactDetails, setContactDetails] = useState<ContactDetail | null>(null);
  const [sales, setSales] = useState<ContactSale[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [embudos, setEmbudos] = useState<EmbudoResponse[]>([]);
  const [currentEmbudo, setCurrentEmbudo] = useState<EmbudoResponse | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    info: true,
    bot: true,
    personal: true,
    agent: true,
    funnel: true,
    notes: true,
    sales: true,
    casino: true,
    tags: true,
  });

  // Tags state
  const [etiquetas, setEtiquetas] = useState<EtiquetaResponse[]>([]);
  const [contactTags, setContactTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Casino states
  const [casinoPlayer, setCasinoPlayer] = useState<any>(null);
  const [casinoBalance, setCasinoBalance] = useState<number | null>(null);
  const [casinoLoading, setCasinoLoading] = useState(false);
  const [casinoTransaction, setCasinoTransaction] = useState({
    amount: '',
    type: 'deposit' as 'deposit' | 'withdraw',
  });
  const [casinoPassword, setCasinoPassword] = useState({
    username: '',
    password: 'Capibet1234',
  });
  const [showCasinoPassword, setShowCasinoPassword] = useState(true);
  const [createPlayerResponse, setCreatePlayerResponse] = useState<any | null>(null);
  const [createPlayerResponseRaw, setCreatePlayerResponseRaw] = useState<string | null>(null);
  const [createDepositResponse, setCreateDepositResponse] = useState<any | null>(null);
  const [createDepositResponseRaw, setCreateDepositResponseRaw] = useState<string | null>(null);
  const [createWithdrawResponse, setCreateWithdrawResponse] = useState<any | null>(null);
  const [createWithdrawResponseRaw, setCreateWithdrawResponseRaw] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    gender: '',
    origin: '',
    birth_date: '',
    agent_id: '',
    funnel_stage: '',
    notes: '',
    phone_number: '',
  });

  const [newSale, setNewSale] = useState({
    amount: '',
    description: '',
  });

  useEffect(() => {
    loadContactDetails();
    loadEmbudos();
    loadEtiquetas();
    loadContactTags();
  }, [conversationId]);

  const loadEtiquetas = async () => {
    const result = await tagsServices.getAllEtiquetas();
    if (result.success && result.data) {
      setEtiquetas(result.data);
    }
  };

  const loadContactTags = async () => {
    // Buscar contacto por número de teléfono
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    const { data: contact } = await supabase
      .from('contacts')
      .select('tags')
      .eq('phone_number', cleanPhone)
      .maybeSingle();
    
    if (!contact) {
      // Intentar con el número original
      const { data: contact2 } = await supabase
        .from('contacts')
        .select('tags')
        .eq('phone_number', phoneNumber)
        .maybeSingle();
      
      if (contact2?.tags) {
        setContactTags(contact2.tags);
      } else {
        setContactTags([]);
      }
    } else if (contact.tags) {
      setContactTags(contact.tags);
    } else {
      setContactTags([]);
    }
  };

  const toggleContactTag = async (tagName: string) => {
    setTagsLoading(true);
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const newTags = contactTags.includes(tagName)
        ? contactTags.filter(t => t !== tagName)
        : [...contactTags, tagName];
      
      // Buscar contacto por número
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', cleanPhone)
        .maybeSingle();
      
      if (!contact) {
        const { data: contact2 } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone_number', phoneNumber)
          .maybeSingle();
        contact = contact2;
      }
      
      if (contact) {
        await supabase
          .from('contacts')
          .update({ tags: newTags.length > 0 ? newTags : null })
          .eq('id', contact.id);
      }

      // Sincronizar con leads - buscar lead por teléfono
      let { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();
      
      if (!lead) {
        const { data: lead2 } = await supabase
          .from('leads')
          .select('id')
          .eq('phone', phoneNumber)
          .maybeSingle();
        lead = lead2;
      }
      
      if (lead) {
        await supabase
          .from('leads')
          .update({ tags: newTags.length > 0 ? newTags : null })
          .eq('id', lead.id);
      }
      
      setContactTags(newTags);
      toast({
        title: 'Etiquetas actualizadas',
        description: `Se ${contactTags.includes(tagName) ? 'quitó' : 'agregó'} la etiqueta "${tagName}"`,
      });

      // Invalidar queries para refrescar la UI
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (error) {
      console.error('Error updating tags:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron actualizar las etiquetas',
        variant: 'destructive',
      });
    } finally {
      setTagsLoading(false);
    }
  };

  const loadEmbudos = async () => {
    try {
      // Cargar workspaces del usuario
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: workspacesData } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', user.id)
        .order('position');

      if (workspacesData && workspacesData.length > 0) {
        // Cargar embudos de todos los workspaces
        const allEmbudos: EmbudoResponse[] = [];
        for (const workspace of workspacesData) {
          const response = await embudoServices.getEmbudosByEspacio(workspace.id);
          if (response.success && response.data) {
            allEmbudos.push(...response.data);
          }
        }
        setEmbudos(allEmbudos);

        // Cargar embudo actual de la conversación
        const { data: convData } = await supabase
          .from('conversations')
          .select('lead_id')
          .eq('id', conversationId)
          .single();

        if (convData?.lead_id) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('column_id')
            .eq('id', convData.lead_id)
            .single();

          if (leadData?.column_id) {
            const { data: columnData } = await supabase
              .from('lead_columns')
              .select('workspace_id')
              .eq('id', leadData.column_id)
              .single();

            if (columnData?.workspace_id) {
              const response = await embudoServices.getEmbudosByEspacio(columnData.workspace_id);
              if (response.success && response.data && response.data.length > 0) {
                setCurrentEmbudo(response.data[0]);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading embudos:', error);
    }
  };

  const loadContactDetails = async () => {
    const details = await contactDetailsService.getByConversation(conversationId);
    if (details) {
      setContactDetails(details);
      setFormData({
        gender: details.gender || '',
        origin: details.origin || '',
        birth_date: details.birth_date || '',
        agent_id: details.agent_id || '',
        funnel_stage: details.funnel_stage || '',
        notes: details.notes || '',
        phone_number: phoneNumber || '',
      });
      
      const salesData = await contactDetailsService.getSales(details.id);
      setSales(salesData);
    }
  };

  const handleSave = async () => {
    if (!effectiveUserId) return;

    try {
      // Actualizar detalles del contacto
      await contactDetailsService.upsert(
        {
          gender: formData.gender as any || null,
          origin: formData.origin || null,
          birth_date: formData.birth_date || null,
          agent_id: formData.agent_id || null,
          funnel_stage: formData.funnel_stage || null,
          notes: formData.notes || null,
        },
        conversationId,
        effectiveUserId
      );

      // Actualizar número de teléfono en la conversación si cambió
      if (formData.phone_number && formData.phone_number !== phoneNumber) {
        const { error: conversationError } = await supabase
          .from('conversations')
          .update({ phone_number: formData.phone_number })
          .eq('id', conversationId);

        if (conversationError) throw conversationError;
      }

      toast({
        title: 'Guardado exitoso',
        description: 'La información del contacto se ha actualizado.',
      });

      setIsEditing(false);
      loadContactDetails();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la información.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSale = async () => {
    if (!effectiveUserId || !contactDetails) return;

    try {
      await contactDetailsService.createSale({
        contact_detail_id: contactDetails.id,
        user_id: effectiveUserId,
        amount: parseFloat(newSale.amount) || 0,
        description: newSale.description || null,
        sale_date: new Date().toISOString(),
        status: 'completed',
      });

      toast({
        title: 'Venta registrada',
        description: 'La venta se ha registrado exitosamente.',
      });

      setNewSale({ amount: '', description: '' });
      loadContactDetails();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar la venta.',
        variant: 'destructive',
      });
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.amount.toString()), 0);

  // Casino functions
  const loadCasinoBalance = async (username: string) => {
    setCasinoLoading(true);
    try {
      const response = await casinoApiService.getAgentInfo(username);
      if (response.success && response.result) {
        setCasinoPlayer(response.result);
        setCasinoBalance(response.result.balance);
        toast({
          title: 'Balance actualizado',
          description: `Balance actual: $${response.result.balance}`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo obtener el balance del casino.',
        variant: 'destructive',
      });
    } finally {
      setCasinoLoading(false);
    }
  };

  const handleCasinoDeposit = async () => {
    if (!casinoPassword.username || !casinoTransaction.amount) {
      toast({
        title: 'Error',
        description: 'Complete todos los campos requeridos.',
        variant: 'destructive',
      });
      return;
    }

    setCasinoLoading(true);
    try {
      const apiResponse = await proxiedFetch('cargar-saldo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: casinoPassword.username,
          amount: parseFloat(casinoTransaction.amount),
        }),
      });

      const contentType = apiResponse.headers.get('content-type') || '';
      let parsed: any = null;
      let rawText: string | null = null;
      if (contentType.includes('application/json')) {
        try {
          parsed = await apiResponse.json();
          rawText = JSON.stringify(parsed);
        } catch {
          parsed = null;
          rawText = null;
        }
      } else {
        try {
          rawText = await apiResponse.text();
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = null;
          }
        } catch {
          rawText = null;
        }
      }

      setCreateDepositResponse(parsed ?? { status: apiResponse.status, ok: apiResponse.ok });
      setCreateDepositResponseRaw(rawText);

      if (apiResponse.ok) {
        toast({
          title: 'Webhook ejecutado',
          description: 'La respuesta se muestra en el modal.',
        });
        setCasinoTransaction({ ...casinoTransaction, amount: '' });
      } else {
        toast({
          title: 'Error del webhook',
          description: `Estado ${apiResponse.status}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo ejecutar el webhook de depósito.',
        variant: 'destructive',
      });
    } finally {
      setCasinoLoading(false);
    }
  };

  const handleCasinoWithdraw = async () => {
    if (!casinoPassword.username || !casinoTransaction.amount) {
      toast({
        title: 'Error',
        description: 'Complete todos los campos requeridos.',
        variant: 'destructive',
      });
      return;
    }

    setCasinoLoading(true);
    try {
      const apiResponse = await proxiedFetch('retirar-saldo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: casinoPassword.username,
          amount: parseFloat(casinoTransaction.amount),
        }),
      });

      const contentType = apiResponse.headers.get('content-type') || '';
      let parsed: any = null;
      let rawText: string | null = null;
      if (contentType.includes('application/json')) {
        try {
          parsed = await apiResponse.json();
          rawText = JSON.stringify(parsed);
        } catch {
          parsed = null;
          rawText = null;
        }
      } else {
        try {
          rawText = await apiResponse.text();
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = null;
          }
        } catch {
          rawText = null;
        }
      }

      setCreateWithdrawResponse(parsed ?? { status: apiResponse.status, ok: apiResponse.ok });
      setCreateWithdrawResponseRaw(rawText);

      if (apiResponse.ok) {
        toast({
          title: 'Webhook ejecutado',
          description: 'La respuesta se muestra en el modal.',
        });
        setCasinoTransaction({ ...casinoTransaction, amount: '' });
      } else {
        toast({
          title: 'Error del webhook',
          description: `Estado ${apiResponse.status}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo ejecutar el webhook de retiro.',
        variant: 'destructive',
      });
    } finally {
      setCasinoLoading(false);
    }
  };

  const updateContactName = async (newName: string) => {
    try {
      // 1. Actualizar contact_name en la conversación
      const { error: convError } = await supabase
        .from('conversations')
        .update({ 
          contact_name: newName,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (convError) {
        console.error('Error updating conversation contact_name:', convError);
        throw convError;
      }
      
      console.log('Conversation contact_name updated to:', newName);

      // 2. Buscar contacto por número de teléfono (múltiples estrategias)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Estrategia 1: Búsqueda exacta con phoneNumber original
      let { data: contacts, error: searchError } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', phoneNumber)
        .limit(1);
      
      // Estrategia 2: Búsqueda por número limpio
      if ((!contacts || contacts.length === 0) && cleanPhone) {
        const result = await supabase
          .from('contacts')
          .select('id')
          .eq('phone_number', cleanPhone)
          .limit(1);
        contacts = result.data;
        searchError = result.error;
      }
      
      // Estrategia 3: Búsqueda por últimos 10 dígitos (más flexible)
      if ((!contacts || contacts.length === 0) && cleanPhone.length >= 10) {
        const last10 = cleanPhone.slice(-10);
        const result = await supabase
          .from('contacts')
          .select('id')
          .like('phone_number', `%${last10}%`)
          .limit(1);
        contacts = result.data;
        searchError = result.error;
      }
      
      if (!searchError && contacts && contacts.length > 0) {
        const { error: contactError } = await supabase
          .from('contacts')
          .update({ 
            first_name: newName,
            name: newName,
            updated_at: new Date().toISOString()
          })
          .eq('id', contacts[0].id);
        
        if (contactError) {
          console.error('Error updating contact name:', contactError);
        } else {
          // Contact name updated successfully
        }
      } else {
        // No matching contact found
      }
    } catch (error) {
      console.error('Error in updateContactName:', error);
    }
  };

  const sendCasinoUserWebhook = async (username: string, password: string) => {
    try {
      const webhookUrl = 'usuarios-casino';
      
      const response = await proxiedFetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'casino_user_created',
          timestamp: new Date().toISOString(),
          username,
          password,
          phoneNumber,
          whatsappNumber: whatsappNumber || null,
          originalContactName: contactName,
          conversationId,
        }),
      });
      
      if (!response.ok) {
        console.error('Webhook response not OK:', response.status);
      }
      
      console.log('Casino user webhook sent successfully');
    } catch (error) {
      console.error('Error sending casino user webhook:', error);
      // No bloqueante - no afecta el flujo principal
    }
  };

  const handleCreateCasinoPlayer = async () => {
    if (!casinoPassword.username || !casinoPassword.password) {
      toast({
        title: 'Error',
        description: 'Complete username y contraseña.',
        variant: 'destructive',
      });
      return;
    }

    setCasinoLoading(true);
    try {
      const apiResponse = await proxiedFetch('crear-usuario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: casinoPassword.username,
          password: casinoPassword.password,
          contactName,
          phoneNumber,
        }),
      });

      const contentType = apiResponse.headers.get('content-type') || '';
      let parsed: any = null;
      let rawText: string | null = null;
      if (contentType.includes('application/json')) {
        try {
          parsed = await apiResponse.json();
          rawText = JSON.stringify(parsed);
        } catch {
          parsed = null;
          rawText = null;
        }
      } else {
        try {
          rawText = await apiResponse.text();
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = null;
          }
        } catch {
          rawText = null;
        }
      }

      setCreatePlayerResponse(parsed ?? { status: apiResponse.status, ok: apiResponse.ok });
      setCreatePlayerResponseRaw(rawText);

      if (apiResponse.ok) {
        toast({
          title: 'Webhook ejecutado',
          description: 'La respuesta se muestra en el modal.',
        });
        
        // Actualizar el nombre del contacto con el username del casino
        await updateContactName(casinoPassword.username);
        
        // Enviar al webhook de usuarios casino
        await sendCasinoUserWebhook(casinoPassword.username, casinoPassword.password);
        
        toast({
          title: 'Contacto actualizado',
          description: `Nombre actualizado a: ${casinoPassword.username}`,
        });
        
        // Invalidar queries para refrescar la UI
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      } else {
        toast({
          title: 'Error del webhook',
          description: `Estado ${apiResponse.status}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo ejecutar el webhook.',
        variant: 'destructive',
      });
    } finally {
      setCasinoLoading(false);
    }
  };

  // Clases condicionales según darkMode
  const containerClass = darkMode
    ? "h-full w-full min-w-0 border-l border-[#2a3942] bg-[#0d1418] text-white overflow-y-auto"
    : "h-full w-full min-w-0 border-l border-border bg-background overflow-y-auto";
  const sectionBgClass = darkMode ? "bg-[#182229] border-[#2a3942]" : "bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]";
  const textPrimaryClass = darkMode ? "text-white" : "text-foreground";
  const textMutedClass = darkMode ? "text-gray-400" : "text-muted-foreground dark:text-gray-400";
  const inputClass = darkMode
    ? "bg-[#2a3942] border-[#2a3942] text-white placeholder:text-gray-500"
    : "bg-background border-border text-foreground";

  return (
    <div className={containerClass}>
      <div className="p-4 space-y-4">
        {/* Header con botón de editar */}
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${textPrimaryClass}`}>Información</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className={`${textMutedClass} hover:${textPrimaryClass}`}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>

        {/* AGENTE ASIGNADO */}
        <AssignedAgentSection conversationId={conversationId} />

        {channelType === 'whatsapp' && (
          <WhatsAppGroupQuickCreate phoneNumber={phoneNumber} contactName={contactName} whatsappNumber={whatsappNumber} conversationId={conversationId} />
        )}

        {/* ETIQUETAS */}
        <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
          <button
            onClick={() => toggleSection('tags')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm text-foreground dark:text-white">ETIQUETAS</h3>
              {contactTags.length > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {contactTags.length}
                </span>
              )}
            </div>
            {expandedSections.tags ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
          </button>

          {expandedSections.tags && (
            <div className="mt-3 space-y-3">
              {/* Etiquetas asignadas */}
              {contactTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {contactTags.map((tag) => {
                    const etiqueta = etiquetas.find(e => e.nombre === tag);
                    return (
                      <Badge
                        key={tag}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: etiqueta?.color || 'hsl(var(--primary))',
                          color: 'white',
                        }}
                        onClick={() => toggleContactTag(tag)}
                      >
                        {tag}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              )}
              
              {/* Agregar etiquetas */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground dark:text-gray-400">Agregar etiqueta:</Label>
                <div className="flex flex-wrap gap-2">
                  {etiquetas
                    .filter(e => !contactTags.includes(e.nombre))
                    .map((etiqueta) => (
                      <Badge
                        key={etiqueta.id}
                        variant="outline"
                        className="cursor-pointer transition-all hover:opacity-80"
                        style={{
                          borderColor: etiqueta.color,
                          color: etiqueta.color,
                        }}
                        onClick={() => toggleContactTag(etiqueta.nombre)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {etiqueta.nombre}
                      </Badge>
                    ))}
                </div>
                {etiquetas.length === 0 && (
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    No hay etiquetas disponibles. Créalas en Configuración &gt; Etiquetas.
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* CASINO */}
        <Card className="p-3 bg-card border-success">
          <button
            onClick={() => toggleSection('casino')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <Coins className="h-4 w-4 text-success" />
              <h3 className="font-medium text-sm text-success">CASINO / BALANCE</h3>
            </div>
            {expandedSections.casino ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
          </button>

          {expandedSections.casino && (
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Usuario del Casino</Label>
                <Input
                  value={casinoPassword.username}
                  onChange={(e) => setCasinoPassword({ ...casinoPassword, username: e.target.value })}
                  placeholder="Ingrese username..."
                  className="h-8"
                />
              </div>

              {casinoBalance !== null && (
                <div className="text-center p-4 bg-success/10 border border-success rounded-lg">
                  <Coins className="h-8 w-8 mx-auto mb-2 text-success" />
                  <p className="text-2xl font-bold text-success">${casinoBalance.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">Balance actual</p>
                  {casinoPlayer && (
                    <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                      {casinoPlayer.userName} - {casinoPlayer.rolename}
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={() => casinoPassword.username && loadCasinoBalance(casinoPassword.username)}
                disabled={!casinoPassword.username || casinoLoading}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${casinoLoading ? 'animate-spin' : ''}`} />
                Consultar Balance
              </Button>

              <Separator />

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear Jugador
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Jugador</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={casinoPassword.username}
                        onChange={(e) => setCasinoPassword({ ...casinoPassword, username: e.target.value })}
                        placeholder="Username del jugador"
                      />
                    </div>
                    <div>
                      <Label>Contraseña</Label>
                      <div className="relative">
                        <Input
                          type={showCasinoPassword ? 'text' : 'password'}
                          value={casinoPassword.password}
                          onChange={(e) => setCasinoPassword({ ...casinoPassword, password: e.target.value })}
                          placeholder="Contraseña"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCasinoPassword(!showCasinoPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-gray-400 hover:text-foreground"
                          aria-label={showCasinoPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showCasinoPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  <Button
                    onClick={handleCreateCasinoPlayer}
                    disabled={casinoLoading}
                    className="w-full"
                  >
                    {casinoLoading ? 'Creando...' : 'Crear Jugador'}
                  </Button>
                  {(createPlayerResponse || createPlayerResponseRaw) && (
                    <div className="p-3 bg-muted rounded border mt-2 space-y-2">
                      <Label>Respuesta del Webhook</Label>
                      {createPlayerResponse && (
                        <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(createPlayerResponse, null, 2)}
                        </pre>
                      )}
                      {createPlayerResponseRaw && (
                        <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                          {createPlayerResponseRaw}
                        </pre>
                      )}
                    </div>
                  )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-success hover:bg-success/90"
                    disabled={!casinoPassword.username}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Depositar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Realizar Depósito</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Usuario</Label>
                      <Input
                        value={casinoPassword.username}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div>
                      <Label>Monto a Depositar</Label>
                      <Input
                        type="number"
                        value={casinoTransaction.amount}
                        onChange={(e) => setCasinoTransaction({ ...casinoTransaction, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      onClick={handleCasinoDeposit}
                      disabled={casinoLoading || !casinoTransaction.amount}
                      className="w-full bg-success hover:bg-success/90"
                    >
                      {casinoLoading ? 'Procesando...' : 'Confirmar Depósito'}
                    </Button>
                    {(createDepositResponse || createDepositResponseRaw) && (
                      <div className="p-3 bg-muted rounded border mt-2 space-y-2">
                        <Label>Respuesta del Webhook</Label>
                        {createDepositResponse && (
                          <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(createDepositResponse, null, 2)}
                          </pre>
                        )}
                        {createDepositResponseRaw && (
                          <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                            {createDepositResponseRaw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={!casinoPassword.username}
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    Retirar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Realizar Retiro</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Usuario</Label>
                      <Input
                        value={casinoPassword.username}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div>
                      <Label>Monto a Retirar</Label>
                      <Input
                        type="number"
                        value={casinoTransaction.amount}
                        onChange={(e) => setCasinoTransaction({ ...casinoTransaction, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      onClick={handleCasinoWithdraw}
                      disabled={casinoLoading || !casinoTransaction.amount}
                      variant="destructive"
                      className="w-full"
                    >
                      {casinoLoading ? 'Procesando...' : 'Confirmar Retiro'}
                    </Button>
                    {(createWithdrawResponse || createWithdrawResponseRaw) && (
                      <div className="p-3 bg-muted rounded border mt-2 space-y-2">
                        <Label>Respuesta del Webhook</Label>
                        {createWithdrawResponse && (
                          <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(createWithdrawResponse, null, 2)}
                          </pre>
                        )}
                        {createWithdrawResponseRaw && (
                          <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                            {createWithdrawResponseRaw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <p className="text-xs text-muted-foreground dark:text-gray-400 text-center">
                Gestiona depósitos y retiros del casino
              </p>
            </div>
          )}
        </Card>

        {/* VENTAS */}
        <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
          <button
            onClick={() => toggleSection('sales')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-success" />
              <h3 className="font-medium text-sm text-foreground dark:text-white">VENTAS</h3>
            </div>
            {expandedSections.sales ? <ChevronUp className="h-4 w-4 text-[#8696a0]" /> : <ChevronDown className="h-4 w-4 text-[#8696a0]" />}
          </button>

          {expandedSections.sales && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground dark:text-gray-400">{sales.length} ventas registradas</p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7">
                      <Plus className="h-3 w-3 mr-1" />
                      Nueva
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Venta</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label>Monto</Label>
                        <Input
                          type="number"
                          value={newSale.amount}
                          onChange={(e) => setNewSale({ ...newSale, amount: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>Descripción</Label>
                        <Textarea
                          value={newSale.description}
                          onChange={(e) => setNewSale({ ...newSale, description: e.target.value })}
                          placeholder="Detalles de la venta..."
                        />
                      </div>
                      <Button onClick={handleCreateSale} className="w-full">
                        Registrar Venta
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="text-center p-4 bg-muted rounded-lg">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-2xl font-bold">${totalSales.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground dark:text-gray-400">Total en ventas</p>
              </div>

              {sales.length === 0 && (
                <p className="text-xs text-center text-muted-foreground dark:text-gray-400 py-4">
                  No hay ventas registradas
                </p>
              )}

              {sales.map((sale) => (
                <div key={sale.id} className="p-2 bg-muted/50 rounded text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">${parseFloat(sale.amount.toString()).toFixed(2)}</p>
                      {sale.description && (
                        <p className="text-xs text-muted-foreground dark:text-gray-400">{sale.description}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      {format(new Date(sale.sale_date), 'dd/MM/yy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* INFORMACIÓN */}
        <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
          <button
            onClick={() => toggleSection('info')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-success" />
              <h3 className="font-medium text-sm text-foreground dark:text-white">INFORMACIÓN</h3>
            </div>
            {expandedSections.info ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
          </button>

          {expandedSections.info && (
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                <div className="w-full">
                  <p className="text-xs text-muted-foreground dark:text-gray-400">Nombre</p>
                  <p className="font-medium text-foreground">{contactName}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                  <p className="text-xs text-muted-foreground dark:text-gray-400">Teléfono</p>
                </div>
                {isEditing && !isCajero ? (
                  <Input
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="Ej: 593983859723"
                    className="h-8 ml-6"
                  />
                ) : (
                  <div className="ml-6">
                    <p className="font-medium">
                      {isCajero 
                        ? maskPhoneNumber(formData.phone_number || phoneNumber)
                        : (formData.phone_number || phoneNumber)}
                    </p>
                    {channelType === 'whatsapp' && whatsappNumber && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Smartphone className="h-3 w-3" />
                        <span>Sesión:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {getSessionNameByPhone(whatsappNumber) || whatsappNumber}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* CONTROL DE BOT */}
        <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
          <button
            onClick={() => toggleSection('bot')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              {isBlocked ? (
                <BotOff className="h-4 w-4 text-destructive" />
              ) : (
                <Bot className="h-4 w-4 text-green-500" />
              )}
              <h3 className="font-medium text-sm text-foreground dark:text-white">CONTROL DE BOT</h3>
            </div>
            {expandedSections.bot ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
          </button>

          {expandedSections.bot && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">
                    Estado: {isBlocked ? 'Desactivado' : 'Activo'}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                    {isBlocked 
                      ? 'El bot no responderá a este contacto' 
                      : 'El bot puede responder automáticamente'}
                  </p>
                </div>
              </div>
              <Button
                onClick={toggleBotBlock}
                disabled={isBotToggling}
                variant={isBlocked ? 'default' : 'destructive'}
                className="w-full"
                size="sm"
              >
                {isBotToggling ? (
                  'Procesando...'
                ) : isBlocked ? (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    Activar Bot
                  </>
                ) : (
                  <>
                    <BotOff className="h-4 w-4 mr-2" />
                    Desactivar Bot
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        {/* DATOS PERSONALES */}
        <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
          <button
            onClick={() => toggleSection('personal')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-success" />
              <h3 className="font-medium text-sm text-foreground dark:text-white">DATOS PERSONALES</h3>
            </div>
            {expandedSections.personal ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
          </button>

          {expandedSections.personal && (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs">Género</Label>
                {isEditing ? (
                  <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm mt-1">{formData.gender || 'No especificado'}</p>
                )}
              </div>

              <div>
                <Label className="text-xs">Origen</Label>
                {isEditing ? (
                  <Input
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    placeholder="Describe el origen..."
                    className="h-8"
                  />
                ) : (
                  <p className="text-sm mt-1">{formData.origin || 'No especificado'}</p>
                )}
              </div>

              <div>
                <Label className="text-xs">Fecha de Nacimiento</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="h-8"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {formData.birth_date ? format(new Date(formData.birth_date), 'dd/MM/yyyy') : 'No especificado'}
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* AGENTE */}
        <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
          <button
            onClick={() => toggleSection('agent')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-success" />
              <h3 className="font-medium text-sm text-foreground dark:text-white">AGENTE</h3>
            </div>
            {expandedSections.agent ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
          </button>

          {expandedSections.agent && (
            <div className="mt-3">
              {isEditing ? (
                <Input
                  value={formData.agent_id}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                  placeholder="Seleccionar agente..."
                  className="h-8"
                />
              ) : (
                <p className="text-sm">{formData.agent_id || 'Sin agente asignado'}</p>
              )}
            </div>
          )}
        </Card>

        {/* EMBUDO - Solo mostrar si hideFunnel es false */}
        {!hideFunnel && (
          <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
            <button
              onClick={() => toggleSection('funnel')}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-success" />
                <h3 className="font-medium text-sm text-foreground dark:text-white">EMBUDO</h3>
              </div>
              {expandedSections.funnel ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
            </button>

            {expandedSections.funnel && (
              <div className="mt-3">
                <p className="text-sm text-foreground">
                  {currentEmbudo ? currentEmbudo.name : formData.funnel_stage || 'PRIMER CONTACTO'}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* NOTAS */}
        <Card className="p-3 bg-card border-border dark:bg-[#182229] dark:border-[#2a3942]">
          <button
            onClick={() => toggleSection('notes')}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-success" />
              <h3 className="font-medium text-sm text-foreground dark:text-white">NOTAS</h3>
            </div>
            {expandedSections.notes ? <ChevronUp className="h-4 w-4 text-muted-foreground dark:text-gray-400" /> : <ChevronDown className="h-4 w-4 text-muted-foreground dark:text-gray-400" />}
          </button>

          {expandedSections.notes && (
            <div className="mt-3">
              {isEditing ? (
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Añade notas sobre este contacto..."
                  className="min-h-20"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{formData.notes || 'Sin notas'}</p>
              )}
            </div>
          )}
        </Card>

        {isEditing && (
          <Button onClick={handleSave} className="w-full">
            Guardar Cambios
          </Button>
        )}
      </div>
    </div>
  );
};
