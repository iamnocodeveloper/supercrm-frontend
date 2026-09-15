import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import GlobalSearchProvider from "@/components/search/GlobalSearchProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/LoadingSpinner";

// Lazy loaded pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const WhatsAppConnections = lazy(() => import("./pages/WhatsAppConnections"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const CreateAIAgent = lazy(() => import("./pages/CreateAIAgent"));
const ContactLists = lazy(() => import("./pages/ContactLists"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactsNew = lazy(() => import("./pages/ContactsNew"));
const MassCampaigns = lazy(() => import("./pages/MassCampaigns"));
const CreateMassCampaign = lazy(() => import("./pages/CreateMassCampaign"));
const Settings = lazy(() => import("./pages/Settings"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadsWebChat = lazy(() => import("./pages/LeadsWebChat"));
const Conversations = lazy(() => import("./pages/Conversations"));
const CreateConversation = lazy(() => import("./pages/CreateConversation"));
const InternalChat = lazy(() => import("./pages/InternalChat"));
const LandingChat = lazy(() => import("./pages/LandingChat"));
const Sales = lazy(() => import("./pages/Sales"));
const Calendar = lazy(() => import("./pages/Calendar"));
const PaymentPlans = lazy(() => import("./pages/PaymentPlans"));
const UsagePlan = lazy(() => import("./pages/UsagePlan"));
const NotFound = lazy(() => import("./pages/NotFound"));
// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminStatistics = lazy(() => import("./pages/admin/AdminStatistics"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminConversations = lazy(() => import("./pages/admin/AdminConversations"));
const AuditPanel = lazy(() => import("./pages/admin/AuditPanel"));
const Reports = lazy(() => import("./pages/Reports"));
const ConversationAnalysis = lazy(() => import("./pages/ConversationAnalysis"));
const DuplicateContacts = lazy(() => import("./pages/DuplicateContacts"));
const PlayerChats = lazy(() => import("./pages/PlayerChats"));
const WhatsAppGroups = lazy(() => import("./pages/WhatsAppGroups"));
const WhatsAppStatuses = lazy(() => import("./pages/WhatsAppStatuses"));
const MassEmail = lazy(() => import("./pages/MassEmail"));
const TrucoArgSupport = lazy(() => import("./pages/TrucoArgSupport"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - data considered fresh
      gcTime: 1000 * 60 * 10, // 10 minutes - keep in cache (formerly cacheTime)
      refetchOnWindowFocus: false, // Prevent refetch on tab switch
      retry: 1, // Only retry once on failure
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <GlobalSearchProvider />
            <Suspense fallback={<LoadingSpinner message="Cargando..." />}>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/conexiones" element={
                <ProtectedRoute>
                  <WhatsAppConnections />
                </ProtectedRoute>
              } />
              <Route path="/asistente-ia" element={
                <ProtectedRoute>
                  <AIAgents />
                </ProtectedRoute>
              } />
              <Route path="/crear-agente" element={
                <ProtectedRoute>
                  <CreateAIAgent />
                </ProtectedRoute>
              } />
              <Route path="/listas-contactos" element={
                <ProtectedRoute>
                  <ContactLists />
                </ProtectedRoute>
              } />
              <Route path="/contactos/:listId" element={
                <ProtectedRoute>
                  <Contacts />
                </ProtectedRoute>
              } />
              <Route path="/contactos" element={
                <ProtectedRoute>
                  <ContactsNew />
                </ProtectedRoute>
              } />
              <Route path="/contactos-duplicados" element={
                <ProtectedRoute>
                  <DuplicateContacts />
                </ProtectedRoute>
              } />
              <Route path="/campanas-masivas" element={
                <ProtectedRoute>
                  <MassCampaigns />
                </ProtectedRoute>
              } />
              <Route path="/crear-campana-masiva" element={
                <ProtectedRoute>
                  <CreateMassCampaign />
                </ProtectedRoute>
              } />
              <Route path="/crear-campana-masiva/:id" element={
                <ProtectedRoute>
                  <CreateMassCampaign />
                </ProtectedRoute>
              } />
              <Route path="/configuracion" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/leads" element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              } />
              <Route path="/leads-webchat" element={
                <ProtectedRoute>
                  <LeadsWebChat />
                </ProtectedRoute>
              } />
              <Route path="/conversaciones" element={
                <ProtectedRoute>
                  <Conversations />
                </ProtectedRoute>
              } />
              <Route path="/crear-conversacion" element={
                <ProtectedRoute>
                  <CreateConversation />
                </ProtectedRoute>
              } />
              <Route path="/calendario" element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              } />
              <Route path="/chat-interno" element={
                <ProtectedRoute>
                  <InternalChat />
                </ProtectedRoute>
              } />
              <Route path="/chat-landing" element={
                <ProtectedRoute>
                  <LandingChat />
                </ProtectedRoute>
              } />
              <Route path="/ventas" element={
                <ProtectedRoute>
                  <Sales />
                </ProtectedRoute>
              } />
              <Route path="/planes-pago" element={
                <ProtectedRoute>
                  <PaymentPlans />
                </ProtectedRoute>
              } />
              <Route path="/uso-plan" element={
                <ProtectedRoute>
                  <UsagePlan />
                </ProtectedRoute>
              } />
              <Route path="/reportes" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/analisis-conversaciones" element={
                <ProtectedRoute>
                  <ConversationAnalysis />
                </ProtectedRoute>
              } />
              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/usuarios" element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminUsers />
                </ProtectedRoute>
              } />
              <Route path="/admin/estadisticas" element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminStatistics />
                </ProtectedRoute>
              } />
              <Route path="/admin/mensajes" element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminMessages />
                </ProtectedRoute>
              } />
              <Route path="/admin/conversaciones" element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminConversations />
                </ProtectedRoute>
              } />
              <Route path="/admin/auditoria" element={
                <ProtectedRoute requireSuperAdmin>
                  <AuditPanel />
                </ProtectedRoute>
              } />
              <Route path="/chat-jugadores" element={
                <ProtectedRoute>
                  <PlayerChats />
                </ProtectedRoute>
              } />
              <Route path="/grupos-whatsapp" element={
                <ProtectedRoute>
                  <WhatsAppGroups />
                </ProtectedRoute>
              } />
              <Route path="/estados-whatsapp" element={
                <ProtectedRoute>
                  <WhatsAppStatuses />
                </ProtectedRoute>
              } />
              <Route path="/email-masivo" element={
                <ProtectedRoute>
                  <MassEmail />
                </ProtectedRoute>
              } />
              <Route path="/soporte-trucoarg" element={
                <ProtectedRoute>
                  <TrucoArgSupport />
                </ProtectedRoute>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
