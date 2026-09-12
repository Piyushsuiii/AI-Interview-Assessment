"use client";

import Link from "next/link";

export function Footer() {
  const links = {
    Product: ["Assessments", "AI Interviews", "Skill Intelligence", "Recruiter Copilot"],
    Company: ["About", "Blog", "Careers", "Contact"],
    Legal: ["Privacy Policy", "Terms of Service", "Security"],
  };

  return (
    <footer className="bg-[#0a0a0a] border-t border-[#2e2e2e] pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-[#ff4d1c] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" fill="white" opacity="0.9" />
                  <rect x="8" y="1" width="5" height="5" fill="white" opacity="0.5" />
                  <rect x="1" y="8" width="5" height="5" fill="white" opacity="0.5" />
                  <rect x="8" y="8" width="5" height="5" fill="white" opacity="0.9" />
                </svg>
              </div>
              <span className="font-mono text-sm font-bold tracking-widest uppercase text-[#f0ede8]">
                AI Hiring
              </span>
            </div>
            <p className="text-xs text-[#9a9690] leading-relaxed max-w-[200px]">
              Turn every candidate interaction into evidence-backed hiring intelligence.
            </p>
          </div>
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <div className="font-mono text-xs tracking-[0.15em] uppercase text-[#555] mb-5">
                {group}
              </div>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="text-xs text-[#9a9690] hover:text-[#f0ede8] transition-colors font-mono"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#2e2e2e] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-xs text-[#555]">
            © {new Date().getFullYear()} AI Hiring Intelligence Platform — All rights reserved
          </span>
          <div className="flex gap-6">
            {["Twitter", "LinkedIn", "GitHub"].map((s) => (
              <Link
                key={s}
                href="#"
                className="font-mono text-xs text-[#555] hover:text-[#f0ede8] transition-colors uppercase tracking-wider"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
