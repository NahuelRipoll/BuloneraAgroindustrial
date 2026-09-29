"use client";

import { useEffect } from "react";

export function AdminAuthRedirect() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;

    const hash = window.location.hash;
    const search = window.location.search;
    const isAdminAuthLink = /(?:^|[&#?])type=(invite|recovery)(?:&|$)/.test(`${search}${hash}`);

    if (isAdminAuthLink) window.location.replace(`/admin${search}${hash}`);
  }, []);

  return null;
}
