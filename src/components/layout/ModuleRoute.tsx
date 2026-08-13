import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useModuleSettings } from '@/hooks/useModuleSettings';
import { moduleForPath } from '@/lib/modules';

/**
 * Blocks direct URL access to pages whose module has been turned off
 * company-wide in Settings.
 */
export const ModuleRoute = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { isModuleEnabled, loading } = useModuleSettings();
  const mod = moduleForPath(location.pathname);

  if (loading) return null;
  if (mod && !isModuleEnabled(mod.key)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default ModuleRoute;
