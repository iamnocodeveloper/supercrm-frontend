import React from 'react';
import UsageDashboard from '@/components/UsageDashboard';
import UsageLimitAlert from '@/components/UsageLimitAlert';

const UsagePlan = () => {
  return (
    <div className="space-y-6">
      {/* Alertas de límites críticos */}
      <div className="space-y-2">
        <UsageLimitAlert resourceType="whatsapp_connections_used" />
        <UsageLimitAlert resourceType="contacts_used" />
        <UsageLimitAlert resourceType="campaigns_this_month" />
        <UsageLimitAlert resourceType="bot_responses_this_month" />
        <UsageLimitAlert resourceType="storage_used_mb" />
      </div>

      {/* Dashboard de uso */}
      <UsageDashboard />
    </div>
  );
};

export default UsagePlan;