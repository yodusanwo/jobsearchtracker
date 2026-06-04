import type { Metadata } from "next";
import "./globals.css";
import { StorageInstaller } from "./storage-installer";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "Ledger — a quiet space for your search",
  description: "Personal job search workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <StorageInstaller />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
