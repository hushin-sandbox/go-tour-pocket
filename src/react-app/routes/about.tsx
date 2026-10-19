import { createFileRoute } from '@tanstack/react-router';
import { AboutPage } from '@/react-app/pages/about';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});
