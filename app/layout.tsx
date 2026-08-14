import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { CurrentUserProvider } from "@/components/current-user-provider";

export const metadata: Metadata = {
  title: "Ultronic Team Manager",
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
