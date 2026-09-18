import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) return <p className="centered">Loading...</p>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
