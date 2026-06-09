import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinRelay",
  description: "Fintech webhook reliability and analytics platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <div className="min-h-screen lg:flex">
          {/* <Sidebar /> */}
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10 lg:py-10">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
