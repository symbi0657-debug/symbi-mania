"use client";
import { useEffect } from "react";

export function ReloadGuard() {
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "reload" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }, []);
  return null;
}
