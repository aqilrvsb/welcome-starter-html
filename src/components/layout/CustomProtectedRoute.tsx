import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Navigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomProtectedRouteProps {
  children: React.ReactNode;
}

export function CustomProtectedRoute({ children }: CustomProtectedRouteProps) {
  const { user, loading } = useCustomAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-96">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}