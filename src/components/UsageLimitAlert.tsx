import React from 'react';

interface UsageLimitAlertProps {
  resourceType: string;
  showDetails?: boolean;
  className?: string;
}

export const UsageLimitAlert: React.FC<UsageLimitAlertProps> = () => {
  // LÍMITES DESACTIVADOS - No mostrar alertas
  return null;
};

export default UsageLimitAlert;