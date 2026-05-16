import { useAuth } from '@/context/AuthContext';
import AppRouter from '@/routes/AppRouter';
import LoginPage from '@/pages/auth/LoginPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <AppRouter />;
}
