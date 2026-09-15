'use client';

import { useState } from 'react';
import RoleCard from './RoleCard';
import EditPermissionsDialog from './EditPermissionsDialog';

type RoleType = 'admin' | 'cashier';

export default function RolesPermisosTab() {
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const roles = [
    {
      type: 'admin' as RoleType,
      title: 'Administrador',
      description: 'Dueño de la empresa, acceso completo a su cuenta',
      badge: 'admin',
      badgeColor: '#2563eb',
      icon: 'admin' as const
    },
    {
      type: 'cashier' as RoleType,
      title: 'Cajero',
      description: 'Usuario operativo con permisos configurables',
      badge: 'cashier',
      badgeColor: '#16a34a',
      icon: 'cashier' as const
    }
  ];

  const handleEditPermissions = (roleType: RoleType) => {
    setSelectedRole(roleType);
    setDialogOpen(true);
  };

  const getRoleName = (roleType: RoleType) => {
    return roles.find(r => r.type === roleType)?.title || '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Roles y Permisos</h2>
        <p className="text-muted-foreground mt-1">Configura los permisos para cada rol</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map(role => (
          <RoleCard
            key={role.type}
            title={role.title}
            description={role.description}
            badge={role.badge}
            badgeColor={role.badgeColor}
            icon={role.icon}
            onEditPermissions={() => handleEditPermissions(role.type)}
          />
        ))}
      </div>

      {selectedRole && (
        <EditPermissionsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          roleType={selectedRole}
          roleName={getRoleName(selectedRole)}
        />
      )}
    </div>
  );
}
