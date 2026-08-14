import type { Metadata } from "next";
import "./globals.css";
import "./command-center-theme.css";
import { AppShell } from "@/components/app-shell";
import { CurrentUserProvider } from "@/components/current-user-provider";

export const metadata: Metadata = {
  title: "Ultronic Team Command Center",
  description: "FTC team project, task, capacity, and workflow management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CurrentUserProvider>
          <AppShell>{children}</AppShell>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
