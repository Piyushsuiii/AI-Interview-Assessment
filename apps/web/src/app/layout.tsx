import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "AI Hiring Intelligence Platform — Interview Intelligence for the Modern Team",
  description:
    "Conduct adaptive AI interviews, evaluate real skills, and turn every candidate interaction into evidence-backed hiring intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceMono.variable} font-sans antialiased bg-[#111111] text-[#f0ede8]`}
      >
        {children}
      </body>
    </html>
  );
}
