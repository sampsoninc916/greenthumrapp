import { useState } from 'react';
import { Search, Plus, User, Menu, LogOut, Heart, ShoppingCart, CreditCard } from 'lucide-react';
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  const cartCount = totals.itemCount;
  const cartTotalLabel = cartCount > 0 ? formatCurrency(totals.total) : null;
  const cartBadgeContent = cartCount > 99 ? '99+' : String(cartCount);
  const cartButtonLabel = cartCount > 0 ? `Cart · ${cartTotalLabel}` : 'Cart';


  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-green-100">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={onMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
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