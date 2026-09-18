import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        TaskFlow
      </Link>
      {user && (
        <div className="nav-right">
          <span className="nav-user">{user.name}</span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
