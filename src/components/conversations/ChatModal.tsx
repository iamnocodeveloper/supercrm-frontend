import React, { useState, useEffect, useRef } from 'react';
import { X, Smartphone } from 'lucide-react';
import ChatArea from './ChatArea';
import { ContactInfoPanel } from './ContactInfoPanel';
import { Database } from '@/integrations/supabase/types';
import { useWhatsAppConnections } from '@/hooks/useWhatsAppConnections';
import { useTwilioConnections } from '@/hooks/useTwilioConnections';

type Conversation = Database['public']['Tables']['conversations']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation | null;
    messages: Message[];
    onSendMessage: (messageText: string, attachment?: File) => Promise<void>;
    isSending: boolean;
    onWhatsAppSessionChange?: (sessionName: string | null, sessionPhoneNumber?: string) => void;
}

export default function ChatModal({
    isOpen,
    onClose,
    conversation,
    messages,
    onSendMessage,
    isSending,
    onWhatsAppSessionChange
}: ChatModalProps) {
    const [selectedWhatsAppSession, setSelectedWhatsAppSession] = useState<string | null>(null);
    const [selectedTwilioConnection, setSelectedTwilioConnection] = useState<string | null>(null);
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const { activeConnections, isSessionActiveByPhone, getSessionNameByPhone } = useWhatsAppConnections();
    const { connections: twilioConnections, isConnectionActive } = useTwilioConnections();
    
    // Ref para rastrear la conversación ya inicializada
    const initializedConversationIdRef = useRef<string | null>(null);

    // Auto-seleccionar sesión SOLO cuando cambia la conversación (no en cada cambio de activeConnections)
    useEffect(() => {
        if (conversation && conversation.channel_type === 'whatsapp') {
            // Solo inicializar si es una conversación diferente
            if (initializedConversationIdRef.current !== conversation.id) {
                initializedConversationIdRef.current = conversation.id;
                
                let session: string | null = null;
                
                // Preferir la sesión exacta que recibió el mensaje (session_name),
                // ya que varias sesiones pueden compartir el mismo número
                const exactSession = (conversation as any).session_name as string | null | undefined;
                if (exactSession) {
                    session = exactSession;
                } else if (conversation.whatsapp_number) {
                    session = getSessionNameByPhone(conversation.whatsapp_number) || conversation.whatsapp_number;
                } else if (activeConnections.length > 0) {
                    session = activeConnections[0].name;
                }
                
                setSelectedWhatsAppSession(session);
                onWhatsAppSessionChange?.(session);
            }
        }
    }, [conversation?.id, activeConnections, isSessionActiveByPhone, getSessionNameByPhone, onWhatsAppSessionChange]);

    // Auto-seleccionar conexión Twilio cuando cambia la conversación
    useEffect(() => {
        if (conversation && conversation.channel_type === 'twilio') {
            // Solo inicializar si es una conversación diferente
            if (initializedConversationIdRef.current !== conversation.id) {
                initializedConversationIdRef.current = conversation.id;
                
                let connectionId: string | null = null;
                
                // Prioridad 1: Conexión original de la conversación si está activa
                if (conversation.twilio_connection_id && isConnectionActive(conversation.twilio_connection_id)) {
                    connectionId = conversation.twilio_connection_id;
                } 
                // Prioridad 2: Primera conexión activa (fallback)
                else if (twilioConnections.length > 0) {
                    const activeConn = twilioConnections.find(c => c.status === 'active');
                    connectionId = activeConn?.id || null;
                }
                
                setSelectedTwilioConnection(connectionId);
            }
        }
    }, [conversation?.id, twilioConnections, isConnectionActive]);
    
    // Resetear el ref cuando se cierra el modal
    useEffect(() => {
        if (!isOpen) {
            initializedConversationIdRef.current = null;
        }
    }, [isOpen]);

    // Forzar re-inicialización al cambiar de conversación (id nuevo o distinto)
    useEffect(() => {
        if (conversation?.id) {
            if (initializedConversationIdRef.current !== conversation.id) {
                initializedConversationIdRef.current = null;
            }
        }
    }, [conversation?.id]);
    
    // Notificar al padre cuando cambia la sesión manualmente
    const handleSessionChange = (session: string | null, phoneNumber?: string) => {
        setSelectedWhatsAppSession(session);
        onWhatsAppSessionChange?.(session, phoneNumber);
    };

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !conversation) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0d1418] rounded-lg w-full max-w-7xl h-[90vh] flex flex-col border border-[#2a3942] relative shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942]">
                    {/* Left side - Contact info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer transition-colors"
                            title="Cerrar (Esc)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-semibold flex-shrink-0">
                            {(conversation.contact_name || conversation.pushname || 'C')[0].toUpperCase()}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-foreground truncate">
                                {conversation.contact_name || conversation.pushname || conversation.phone_number}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">
                                {conversation.status === 'active' ? 'En línea' : 'Desconectado'}
                            </p>
                            {conversation.channel_type === 'whatsapp' && conversation.whatsapp_number && (
                                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                    <Smartphone className="h-3 w-3" />
                                    <span className="opacity-70">{conversation.phone_number}</span>
                                    <span className="opacity-50">·</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        {activeConnections.find(c => c.phone_number === conversation.whatsapp_number)?.name || conversation.whatsapp_number}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right side - Action icons */}
                    <div className="flex items-center gap-4">
                        <button
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Email"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </button>
                        
                        <button
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Calendario"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </button>
                        
                        <button
                            onClick={() => setShowInfoPanel(!showInfoPanel)}
                            className={`transition-colors ${showInfoPanel ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Información del contacto"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Chat content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Main chat area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <ChatArea
                            conversation={conversation}
                            messages={messages}
                            onSendMessage={onSendMessage}
                            isSending={isSending}
                            onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
                            whatsappConnections={activeConnections}
                            selectedSession={selectedWhatsAppSession}
                            onSessionChange={handleSessionChange}
                            twilioConnections={twilioConnections}
                            selectedTwilioConnection={selectedTwilioConnection}
                            onTwilioConnectionChange={setSelectedTwilioConnection}
                            originalSessionStatus={
                                conversation?.channel_type === 'whatsapp'
                                    ? isSessionActiveByPhone(conversation.whatsapp_number)
                                        ? 'active'
                                        : 'disconnected'
                                    : conversation?.channel_type === 'twilio'
                                      ? isConnectionActive(conversation.twilio_connection_id)
                                        ? 'active'
                                        : 'disconnected'
                                      : 'active'
                            }
                        />
                    </div>

                    {/* Contact info panel - toggleable */}
                    {showInfoPanel && (
                        <div className="w-96 border-l border-[#2a3942] flex-shrink-0 bg-[#0d1418]">
                            <ContactInfoPanel
                                conversationId={conversation.id}
                                contactName={conversation.contact_name || conversation.pushname || 'Contacto'}
                                phoneNumber={conversation.phone_number}
                                whatsappNumber={conversation.whatsapp_number}
                                channelType={conversation.channel_type}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
