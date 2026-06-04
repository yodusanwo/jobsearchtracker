// app/storage-installer.tsx
"use client";

import { useEffect } from "react";
import { installStorageGlobal } from "@/lib/storage";

export function StorageInstaller() {
  useEffect(() => {
    installStorageGlobal();
  }, []);
  return null;
}
