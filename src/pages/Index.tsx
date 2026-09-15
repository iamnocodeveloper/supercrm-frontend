import { Dashboard } from '@/components/dashboard/Dashboard';
import UsageDashboard from '@/components/UsageDashboard';

const Index = () => {
  return (
    <div className="space-y-6">
      <Dashboard />
      <UsageDashboard />
    </div>
  );
};

export default Index;
