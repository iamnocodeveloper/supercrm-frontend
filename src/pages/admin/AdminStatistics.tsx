import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminStatistics = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Estadísticas del Sistema
          </h1>
          <p className="text-gray-600 mt-2">Panel de administración temporalmente deshabilitado</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Panel en Mantenimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta sección está siendo actualizada para mejorar la compatibilidad con la base de datos.
            Por favor, contacta al administrador del sistema si necesitas acceso a estas funcionalidades.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStatistics;