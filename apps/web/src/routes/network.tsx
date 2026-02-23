import { createFileRoute } from '@tanstack/react-router';
import { PanelLayout } from '@/shared/components/layout/PanelLayout';
import { RouteManager } from '@/features/network/components/RouteManager';

export const Route = createFileRoute('/network')({
  component: NetworkPage,
});

function NetworkPage() {
  return (
    <PanelLayout>
      <RouteManager />
    </PanelLayout>
  );
}
