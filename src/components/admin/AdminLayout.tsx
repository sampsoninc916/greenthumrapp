import { type ComponentType, type ReactNode, useMemo } from 'react';
import { Header } from '../Header';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { Link } from 'react-router-dom';
import { Gavel, ListChecks, ShieldCheck, Users } from 'lucide-react';

type AdminSection = 'users' | 'listings' | 'disputes';

interface AdminLayoutProps {
  active: AdminSection;
  title: string;
  description: string;
  onSearch?: (query: string) => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'users', label: 'Users', href: '/admin/users', icon: Users },
  { id: 'listings', label: 'Listings', href: '/admin/listings', icon: ListChecks },
  { id: 'disputes', label: 'Disputes', href: '/admin/disputes', icon: Gavel },
];

export const AdminLayout = ({ active, title, description, onSearch, children }: AdminLayoutProps) => {
  const handleSearch = useMemo(() => {
    if (!onSearch) {
      return undefined;
    }
    return (query: string) => {
      onSearch(query.trim());
    };
  }, [onSearch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-slate-50">
      <Header onSearch={handleSearch ?? (() => {})} onAddListing={() => {}} onMenuToggle={() => {}} />
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-green-700">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Admin Console</span>
                </div>
                <h1 className="text-2xl font-semibold text-green-900 md:text-3xl">{title}</h1>
                <p className="text-sm text-muted-foreground md:text-base">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="text-green-700 hover:text-green-900" asChild>
                  <Link to="/">Return to marketplace</Link>
                </Button>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === active;
                return (
                  <Button
                    key={item.id}
                    asChild
                    size="sm"
                    variant={isActive ? 'default' : 'ghost'}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-4',
                      isActive
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'text-green-700 hover:bg-green-100 hover:text-green-900',
                    )}
                  >
                    <Link to={item.href}>
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </section>
          <section className="space-y-6">{children}</section>
        </div>
      </main>
    </div>
  );
};

