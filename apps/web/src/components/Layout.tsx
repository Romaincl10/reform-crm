import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Users, Briefcase, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const links = [
    { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
    { to: '/crm', label: 'CRM — Prospects', icon: Briefcase },
    { to: '/clients', label: 'Clients', icon: Users },
    { to: '/prestations', label: 'Prestations', icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-reform-bg">
      <aside className="w-64 border-r border-reform-border bg-white flex flex-col">
        <div className="px-6 py-7">
          <div className="font-display text-3xl tracking-tight">REFORM</div>
          <div className="text-xs text-reform-gray mt-1 uppercase tracking-widest">CRM interne</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
                  isActive
                    ? 'bg-reform-violet text-white'
                    : 'text-reform-ink hover:bg-reform-mauve'
                )
              }
            >
              <l.icon size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-reform-border">
          <div className="text-sm font-medium text-reform-ink truncate">{user?.fullName}</div>
          <div className="text-xs text-reform-gray truncate">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="mt-3 flex items-center gap-2 text-xs text-reform-gray hover:text-reform-violet transition"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
