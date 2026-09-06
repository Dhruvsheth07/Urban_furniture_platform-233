import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, BookOpen, PieChart,
  Sparkles, Bell, Zap, Users, LogOut, Building2,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import SalesList from './pages/SalesList';
import PurchaseList from './pages/PurchaseList';
import InvoiceDetail from './pages/InvoiceDetail';
import CreateInvoice from './pages/CreateInvoice';
import ActionCenter from './pages/ActionCenter';
import ReportsHub from './pages/ReportsHub';
import Inventory from './pages/Inventory';
import Accounting from './pages/Accounting';
import Contacts from './pages/Contacts';
import Automation from './pages/Automation';
import CreateVendorBill from './pages/CreateVendorBill';
import TeamManagement from './pages/TeamManagement';
import Login from './pages/Login';

type NavItem = { to: string; label: string; icon: React.ReactNode };
type NavSection = { heading: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { to: '/sales', label: 'Sales & Invoices', icon: <ShoppingCart size={18} /> },
      { to: '/purchases', label: 'Purchases & Bills', icon: <Package size={18} /> },
      { to: '/inventory', label: 'Inventory', icon: <Boxes size={18} /> },
      { to: '/contacts', label: 'Contacts', icon: <Users size={18} /> },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { to: '/accounting', label: 'Accounting', icon: <BookOpen size={18} /> },
      { to: '/reports', label: 'Reports', icon: <PieChart size={18} /> },
    ],
  },
  {
    heading: 'Intelligence',
    items: [
      { to: '/actions', label: 'Action Center', icon: <Bell size={18} /> },
      { to: '/automation', label: 'Automation', icon: <Zap size={18} /> },
    ],
  },
];

const ADMIN_NAV: NavSection[] = [
  {
    heading: 'Settings',
    items: [
      { to: '/team', label: 'Team & Users', icon: <Users size={18} /> },
    ],
  },
];

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard', '/sales': 'Sales & Invoices',
  '/purchases': 'Purchases & Bills', '/inventory': 'Inventory', '/contacts': 'Contacts',
  '/accounting': 'Accounting', '/reports': 'Reports', '/actions': 'Action Center',
  '/automation': 'Automation', '/team': 'Team & Users',
};

function AppLayout({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const location = useLocation();
  const base = '/' + (location.pathname.split('/')[1] || '');
  const title = PAGE_TITLES[base] || PAGE_TITLES[location.pathname] || 'Urban Furniture';
  const initials = (user?.name || 'U').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white"><Building2 size={20} /></div>
          <div>
            <div className="text-white font-semibold leading-tight">Urban Furniture</div>
            <div className="text-[11px] text-slate-400">Business Operations</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scroll-thin">
          {[...NAV, ...(['ADMIN', 'OWNER'].includes(user?.roleKey) ? ADMIN_NAV : [])].map((section) => (
            <div key={section.heading}>
              <div className="px-3 mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{section.heading}</div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? 'bg-brand-600 text-white font-medium' : 'hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    {item.icon} {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{user?.name || 'User'}</div>
              <div className="text-[11px] text-slate-400 truncate">{user?.role || ''}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" />
            <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          </div>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
            className="text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <LogOut size={16} /> Logout
          </button>
        </header>
        <div className="flex-1 overflow-auto p-6 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/sales" element={<SalesList />} />
                  <Route path="/sales/new" element={<CreateInvoice />} />
                  <Route path="/sales/:id" element={<InvoiceDetail />} />
                  <Route path="/purchases" element={<PurchaseList />} />
                  <Route path="/purchases/new" element={<CreateVendorBill />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/accounting" element={<Accounting />} />
                  <Route path="/reports" element={<ReportsHub />} />
                  <Route path="/actions" element={<ActionCenter />} />
                  <Route path="/automation" element={<Automation />} />
                  <Route path="/team" element={<TeamManagement />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppLayout>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
