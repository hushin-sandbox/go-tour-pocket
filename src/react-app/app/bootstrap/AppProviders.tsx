import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { usePersistentStorage } from './usePersistentStorage';
import { router } from './router';

const queryClient = new QueryClient();

export function AppProviders() {
  usePersistentStorage();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
