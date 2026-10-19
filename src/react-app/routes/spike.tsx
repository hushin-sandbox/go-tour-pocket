import { createFileRoute } from '@tanstack/react-router';
import { SpikePage } from '@/react-app/pages/spike';

export const Route = createFileRoute('/spike')({
  component: SpikePage,
});
