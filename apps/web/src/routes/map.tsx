import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/map')({
  component: MapView,
});

function MapView() {
  // This route returns absolutely nothing, allowing the User to only see the WorldMap 
  // and HUD UI elements below it while interacting with the globe directly.
  return null;
}
