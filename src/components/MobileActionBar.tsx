import { Home, MessageCircle, PlusCircle, ShoppingCart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useUnreadConversations } from '../hooks/useUnreadConversations';
import { useIsMobile } from '../hooks/useIsMobile';
import { Badge } from './ui/badge';

interface MobileActionBarProps {
  onAddListing?: () => void;
}

export function MobileActionBar({ onAddListing }: MobileActionBarProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role } = useAuth();
  const { totals } = useCart();
  const { unreadCount } = useUnreadConversations();

  if (!isMobile) {
    return null;
  }

  const cartCount = totals.itemCount;
  const cartBadgeContent = cartCount > 99 ? '99+' : String(cartCount);
  const messagesBadgeContent = unreadCount > 99 ? '99+' : String(unreadCount);

  const isSeller = role === 'seller';

  const isBrowseActive =
    location.pathname === '/' || location.pathname.startsWith('/plants');
  const isCartActive =
    location.pathname.startsWith('/cart') || location.pathname.startsWith('/checkout');
  const isMessagesActive = location.pathname.startsWith('/messages');
  const isSellActive = isSeller && location.hash.includes('listings');

  const baseButtonClasses =
    'flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors';
  const activeClasses = 'bg-green-100 text-green-900';
  const inactiveClasses = 'text-green-700 hover:bg-green-50';
  const sellClasses = isSellActive ? 'bg-green-700 text-white' : 'bg-green-600 text-white hover:bg-green-700';

  const handleBrowse = () => {
    navigate('/');
  };

  const handleSell = () => {
    if (isSeller) {
      if (onAddListing) {
        onAddListing();
        return;
      }
      navigate('/profile#listings');
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/', action: 'add-listing' } } });
      return;
    }

    navigate('/profile');
  };

  const handleCart = () => {
    navigate('/cart');
  };

  const handleMessages = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/messages' } } });
      return;
    }
    navigate('/messages');
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-green-100 bg-white/95 pb-4 pt-3 shadow-[0_-8px_24px_rgba(22,101,52,0.08)] backdrop-blur-md md:hidden">
      <div className="mx-auto grid w-full max-w-xl grid-cols-4 gap-3 px-4">
        <button
          type="button"
          className={`${baseButtonClasses} ${isBrowseActive ? activeClasses : inactiveClasses}`}
          onClick={handleBrowse}
        >
          <Home className="h-5 w-5" />
          <span>Browse</span>
        </button>
        <button
          type="button"
          className={`${baseButtonClasses} ${sellClasses}`}
          onClick={handleSell}
        >
          <PlusCircle className="h-5 w-5" />
          <span>Sell</span>
        </button>
        <button
          type="button"
          className={`${baseButtonClasses} ${isCartActive ? activeClasses : inactiveClasses}`}
          onClick={handleCart}
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge className="absolute -right-2 -top-1 min-w-[1.25rem] rounded-full bg-green-600 px-1 py-0 text-[10px] text-white">
                {cartBadgeContent}
              </Badge>
            )}
          </div>
          <span>Cart</span>
        </button>
        <button
          type="button"
          className={`${baseButtonClasses} ${isMessagesActive ? activeClasses : inactiveClasses}`}
          onClick={handleMessages}
        >
          <div className="relative">
            <MessageCircle className="h-5 w-5" />
            {isAuthenticated && unreadCount > 0 && (
              <Badge className="absolute -right-2 -top-1 min-w-[1.25rem] rounded-full bg-green-600 px-1 py-0 text-[10px] text-white">
                {messagesBadgeContent}
              </Badge>
            )}
          </div>
          <span>Messages</span>
        </button>
      </div>
    </nav>
  );
}
