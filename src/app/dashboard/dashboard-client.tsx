'use client';

import { Dashboard } from '@/components/dashboard';

type DashboardClientProps = {
  view?: 'dashboard' | 'chat';
};

export function DashboardClient({ view = 'dashboard' }: DashboardClientProps) {
  return <Dashboard view={view} />;
}