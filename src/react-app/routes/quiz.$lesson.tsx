import { createFileRoute } from '@tanstack/react-router';
import { QuizPage } from '@/react-app/pages/quiz';

export const Route = createFileRoute('/quiz/$lesson')({
  component: QuizPage,
});
