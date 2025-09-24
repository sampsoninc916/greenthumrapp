import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { messagesService } from '../services/messages';

export function useUnreadConversations(pollInterval: number = 60000) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const fetchUnreadCount = async () => {
      if (!isAuthenticated) {
        if (isMounted) {
          setUnreadCount(0);
        }
        return;
      }

      try {
        const count = await messagesService.getUnreadCount();
        if (isMounted) {
          setUnreadCount(count);
        }
      } catch (error) {
        console.error('Failed to load unread conversations', error);
      }
    };

    fetchUnreadCount();

    if (isAuthenticated) {
      interval = window.setInterval(fetchUnreadCount, pollInterval);
    }

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isAuthenticated, pollInterval]);

  return { unreadCount };
}
