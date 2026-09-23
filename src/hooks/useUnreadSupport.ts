'use client';

import { useState, useEffect, useCallback } from "react";

export function useUnreadSupport(initialCount: number = 0) {
  const [unreadCount, setUnreadCount] = useState<number>(initialCount);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/support/unread-count", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(typeof data.count === "number" ? data.count : 0);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    // Initial sync
    fetchUnread();

    // Poll every 15s when active tab
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchUnread();
      }
    }, 15000);

    const onFocus = () => fetchUnread();
    window.addEventListener("focus", onFocus);
    window.addEventListener("support_unread_changed", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("support_unread_changed", onFocus);
    };
  }, [fetchUnread]);

  return unreadCount;
}
