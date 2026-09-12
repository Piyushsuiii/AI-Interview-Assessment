"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Platform", href: "#demo" },
  { label: "Intelligence", href: "#intelligence" },
  { label: "Pricing", href: "#pricing" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <motion.header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#111111]/95 backdrop-blur-sm border-b border-[#2e2e2e]"
          : "bg-transparent"
      }`}
      initial={reducedMotion ? false : { y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3" aria-label="AI Hiring home">
          <div className="w-7 h-7 bg-[#ff4d1c] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" fill="white" opacity="0.9" />
              <rect x="9" y="2" width="5" height="5" fill="white" opacity="0.5" />
              <rect x="2" y="9" width="5" height="5" fill="white" opacity="0.5" />
              <rect x="9" y="9" width="5" height="5" fill="white" opacity="0.9" />
            </svg>
          </div>
          <span className="font-mono text-sm font-bold tracking-widest text-[#f0ede8] uppercase">
            AI Hiring
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="font-mono text-xs tracking-widest uppercase text-[#9a9690] hover:text-[#f0ede8] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="font-mono text-xs tracking-widest uppercase text-[#9a9690] hover:text-[#f0ede8] transition-colors hidden sm:block"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="btn-orange px-5 py-2.5 text-xs rounded-none"
          >
            Get Early Access
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center border border-[#3a3a3a] text-[#f0ede8] md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-navigation" className="border-t border-[#2e2e2e] bg-[#111111] px-6 py-5 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-7xl flex-col">
            {navLinks.map((item) => (
              <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} className="border-b border-[#242424] py-4 font-mono text-xs uppercase tracking-widest text-[#c2beb8]">
                {item.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setMenuOpen(false)} className="py-4 font-mono text-xs uppercase tracking-widest text-[#c2beb8] sm:hidden">
              Sign In
            </Link>
          </div>
        </nav>
      )}
    </motion.header>
  );
}
