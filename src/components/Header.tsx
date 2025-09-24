import { useState } from 'react';
import {
  Search,
  Plus,
  User,
  Menu,
  LogOut,
  Heart,
  ShoppingCart,
  CreditCard,
  MessageCircle,
  ShieldCheck,
  Gavel,
  ListChecks,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import GreenThumrLogo from './assets/ThumrCircleLogo.png';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { formatCurrency } from '../utils/currency';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { Separator } from './ui/separator';
import { useUnreadConversations } from '../hooks/useUnreadConversations';

interface HeaderProps {
  onSearch: (query: string) => void;
  onAddListing: () => void;
  onMenuToggle: () => void;
}

export function Header({ onSearch, onAddListing, onMenuToggle }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { isAuthenticated, logout, user, role } = useAuth();
  const { totals } = useCart();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { unreadCount } = useUnreadConversations();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const handleMessagesClick = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/messages' } } });
      return;
    }
    navigate('/messages');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleMobileNavigate = (path: string) => {
    closeMobileMenu();
    navigate(path);
  };

  const handleMobileMessages = () => {
    closeMobileMenu();
    handleMessagesClick();
  };

  const handleMobileAddListing = () => {
    closeMobileMenu();
    onAddListing();
  };

  const handleMobileFilters = () => {
    closeMobileMenu();
    onMenuToggle();
  };

  const handleMobileLogout = async () => {
    closeMobileMenu();
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout', error);
    }
    navigate('/');
  };

  const cartCount = totals.itemCount;
  const cartTotalLabel = cartCount > 0 ? formatCurrency(totals.total) : null;
  const cartBadgeContent = cartCount > 99 ? '99+' : String(cartCount);
  const cartButtonLabel = cartCount > 0 ? `Cart · ${cartTotalLabel}` : 'Cart';
  const messagesBadgeContent = unreadCount > 99 ? '99+' : String(unreadCount);


  const isAdmin = role === 'admin';

  return (
    <header className="sticky top-0 z-50 border-b border-green-100 bg-white/95 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center gap-4 px-3 sm:h-20 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full max-w-xs gap-0 p-0">
              <SheetHeader className="bg-green-50/80 p-6 text-left">
                <SheetTitle className="text-lg font-semibold text-green-900">
                  {isAuthenticated
                    ? `Hi, ${user?.username ?? 'friend'}!`
                    : 'Welcome to Thumr'}
                </SheetTitle>
                <SheetDescription className="text-sm text-green-700">
                  Quick shortcuts for browsing, selling, and managing your garden finds.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold text-green-800 hover:bg-green-100"
                    onClick={() => handleMobileNavigate('/')}
                  >
                    <Search className="h-5 w-5" />
                    Browse listings
                  </Button>
                  {isAuthenticated && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold text-green-800 hover:bg-green-100"
                      onClick={() => handleMobileNavigate('/profile')}
                    >
                      <User className="h-5 w-5" />
                      Profile overview
                    </Button>
                  )}
                  {isAuthenticated && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold text-green-800 hover:bg-green-100"
                      onClick={() => handleMobileNavigate('/profile#saved')}
                    >
                      <Heart className="h-5 w-5" />
                      Saved listings
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold text-green-800 hover:bg-green-100"
                    onClick={() => handleMobileNavigate('/cart')}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    Cart
                    {cartCount > 0 && (
                      <Badge className="ml-auto bg-green-600 px-2 py-0.5 text-xs text-white">
                        {cartBadgeContent}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold text-green-800 hover:bg-green-100"
                    onClick={handleMobileMessages}
                  >
                    <MessageCircle className="h-5 w-5" />
                    Messages
                    {isAuthenticated && unreadCount > 0 && (
                      <Badge className="ml-auto bg-green-600 px-2 py-0.5 text-xs text-white">
                        {messagesBadgeContent}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold text-green-800 hover:bg-green-100"
                    onClick={handleMobileFilters}
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                    Filters & sorting
                  </Button>
                </div>

                {role === 'seller' && (
                  <Button
                    className="w-full justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700"
                    onClick={handleMobileAddListing}
                  >
                    <Plus className="h-5 w-5" />
                    Sell a plant
                  </Button>
                )}

                {!isAuthenticated && (
                  <div className="space-y-2">
                    <Link to="/login">
                      <Button
                        className="w-full justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700"
                        onClick={closeMobileMenu}
                      >
                        Login
                      </Button>
                    </Link>
                    <Link to="/signup">
                      <Button
                        variant="outline"
                        className="w-full justify-center gap-2 rounded-xl border-green-200 px-4 py-3 text-base font-semibold text-green-700 hover:bg-green-50"
                        onClick={closeMobileMenu}
                      >
                        Create account
                      </Button>
                    </Link>
                  </div>
                )}

                {isAdmin && (
                  <div className="space-y-2 rounded-xl border border-green-100 bg-green-50/60 p-3">
                    <p className="text-sm font-semibold text-green-900">Admin shortcuts</p>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-lg px-4 py-2.5 text-base font-semibold text-green-800 hover:bg-green-100"
                      onClick={() => handleMobileNavigate('/admin/users')}
                    >
                      <ShieldCheck className="h-5 w-5" />
                      Users
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-lg px-4 py-2.5 text-base font-semibold text-green-800 hover:bg-green-100"
                      onClick={() => handleMobileNavigate('/admin/listings')}
                    >
                      <ListChecks className="h-5 w-5" />
                      Listings
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-lg px-4 py-2.5 text-base font-semibold text-green-800 hover:bg-green-100"
                      onClick={() => handleMobileNavigate('/admin/disputes')}
                    >
                      <Gavel className="h-5 w-5" />
                      Disputes
                    </Button>
                  </div>
                )}
              </div>
              {isAuthenticated && (
                <>
                  <Separator className="bg-green-100" />
                  <div className="p-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-xl px-4 py-3 text-base font-semibold text-red-600 hover:bg-red-50"
                      onClick={handleMobileLogout}
                    >
                      <LogOut className="h-5 w-5" />
                      Logout
                    </Button>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src={GreenThumrLogo} alt="GreenThumr Logo" className="h-12 w-12" />
            <div className="hidden sm:block">
              <h1 className="text-xl oxygen-bold text-green-800">Thumr</h1>
              <p className="text-xs text-green-600">Buy • Sell • Trade</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search plants, flowers, herbs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-green-50/50 border-green-200 focus:border-green-400 focus:ring-green-400"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            onClick={() => navigate('/cart')}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge
                variant="default"
                className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-[10px]"
              >
                {cartBadgeContent}
              </Badge>
            )}
            <span className="hidden lg:flex ml-2 text-sm font-medium text-green-700">
              {cartButtonLabel}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="relative"
            onClick={handleMessagesClick}
          >
            <MessageCircle className="h-5 w-5" />
            {isAuthenticated && unreadCount > 0 && (
              <Badge
                variant="default"
                className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-[10px]"
              >
                {messagesBadgeContent}
              </Badge>
            )}
            <span className="hidden lg:flex ml-2 text-sm font-medium text-green-700">
              Messages
            </span>
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex items-center gap-2 text-green-700 hover:text-green-900"
                onClick={() => navigate('/admin/users')}
              >
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => navigate('/admin/users')}
              >
                <ShieldCheck className="h-5 w-5" />
              </Button>
            </>
          )}

          {!isAuthenticated ? (
            // Show login/signup when not authenticated
            <>
              <Link to="/login">
                <Button
                  className="hidden sm:flex bg-green-600 hover:bg-green-700 text-white"
                >
                  Login
                </Button>
              </Link>

              <Link to="/signup">
                <Button
                  className="hidden sm:flex bg-green-600 hover:bg-green-700 text-white"
                >
                  Signup
                </Button>
              </Link>

              {/* Mobile login button */}
              <Link to="/login">
                <Button
                  className="sm:hidden bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  Login
                </Button>
              </Link>
            </>
          ) : (
            // Show user actions when authenticated
            <>
              {role === 'seller' && (
                <>
                  <Button
                    onClick={onAddListing}
                    className="hidden sm:flex bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Sell Plant
                  </Button>

                  <Button
                    onClick={onAddListing}
                    className="sm:hidden bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* User dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user?.username || 'My Account'}</span>
                      {role && (
                        <span className="text-xs capitalize text-gray-500">{role} account</span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/admin/users')}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Admin · Users
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin/listings')}>
                        <ListChecks className="mr-2 h-4 w-4" />
                        Admin · Listings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin/disputes')}>
                        <Gavel className="mr-2 h-4 w-4" />
                        Admin · Disputes
                      </DropdownMenuItem>
                    </>
                  )}
                  {role === 'seller' ? (
                    <DropdownMenuItem onClick={() => navigate('/profile#listings')}>
                      <Plus className="mr-2 h-4 w-4" />
                      My Listings
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => navigate('/profile#saved')}>
                      <Heart className="mr-2 h-4 w-4" />
                      Saved Listings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/cart')}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Cart
                    {cartCount > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">{cartCount}</span>
                    )}
                  </DropdownMenuItem>
                  {cartCount > 0 && (
                    <DropdownMenuItem onClick={() => navigate('/checkout')}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Checkout
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await logout();
                      navigate('/');
                    }}
                    className="text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}