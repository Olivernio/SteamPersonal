import { AuthGuard } from './components/AuthGuard';
import { CatalogManager } from './components/CatalogManager';

export default function App() {
  return (
    <AuthGuard>
      {() => <CatalogManager />}
    </AuthGuard>
  );
}
