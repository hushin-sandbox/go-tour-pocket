import { createFileRoute } from '@tanstack/react-router';
import { LicensesScreen } from '@/react-app/pages/licenses';

export const Route = createFileRoute('/licenses')({
  component: LicensesScreen,
});
