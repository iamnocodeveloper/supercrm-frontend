import { Button } from '@/components/ui/button';
import { Shield, UserCog, Users, User } from 'lucide-react';

interface RoleCardProps {
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  icon: 'superadmin' | 'admin' | 'cashier' | 'user';
  onEditPermissions: () => void;
}

const iconMap = {
  superadmin: Shield,
  admin: UserCog,
  cashier: Users,
  user: User
};

export default function RoleCard({
  title,
  description,
  badge,
  badgeColor,
  icon,
  onEditPermissions
}: RoleCardProps) {
  const Icon = iconMap[icon];

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <span 
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: badgeColor, color: 'white' }}
        >
          {badge}
        </span>
      </div>
      
      <Button
        onClick={onEditPermissions}
        variant="outline"
        className="w-full"
      >
        Editar Permisos
      </Button>
    </div>
  );
}
