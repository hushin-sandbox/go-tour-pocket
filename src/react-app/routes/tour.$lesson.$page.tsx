import { createFileRoute } from '@tanstack/react-router';
import { TourPage } from '@/react-app/pages/tour-page';

export const Route = createFileRoute('/tour/$lesson/$page')({
  component: TourPage,
});
