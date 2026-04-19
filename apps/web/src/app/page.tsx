import { ChatInterface } from '@/components/ChatInterface';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function HomePage() {
  return (
    <main className="h-screen">
      <ErrorBoundary>
        <ChatInterface />
      </ErrorBoundary>
    </main>
  );
}
