import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { SystemStatusCards } from '@/components/audit/SystemStatusCards';
import { UserActivityChart } from '@/components/audit/UserActivityChart';
import { MessageResponderTracker } from '@/components/audit/MessageResponderTracker';
import { FileText, Activity, Users, MessageSquare, Shield } from 'lucide-react';

const AuditPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('logs');

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel de Auditoría</h1>
            <p className="text-muted-foreground">
              Monitoreo del sistema, logs de actividad y seguimiento de usuarios
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Estado</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Actividad</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Mensajes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-6">
            <AuditLogTable />
          </TabsContent>

          <TabsContent value="status" className="space-y-6">
            <SystemStatusCards />
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <UserActivityChart />
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <MessageResponderTracker />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AuditPanel;
