"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.7, ease: "easeOut" as const },
  }),
};

export function HeroSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="relative min-h-screen bg-blueprint flex flex-col pt-16 overflow-hidden">
      {/* Top-left corner crosshair */}
      <div className="absolute top-24 left-6 opacity-30 hidden lg:block pointer-events-none">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <line x1="16" y1="0" x2="16" y2="32" stroke="#f0ede8" strokeWidth="0.5" />
          <line x1="0" y1="16" x2="32" y2="16" stroke="#f0ede8" strokeWidth="0.5" />
          <circle cx="16" cy="16" r="4" stroke="#f0ede8" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      {/* Bottom-right corner crosshair */}
      <div className="absolute bottom-24 right-6 opacity-20 hidden lg:block pointer-events-none">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <line x1="12" y1="0" x2="12" y2="24" stroke="#f0ede8" strokeWidth="0.5" />
          <line x1="0" y1="12" x2="24" y2="12" stroke="#f0ede8" strokeWidth="0.5" />
        </svg>
      </div>

      {/* Main hero content */}
      <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-start lg:items-center gap-16 flex-1 py-24">

        {/* LEFT — Text Block */}
        <div className="flex-1 max-w-2xl">
          {/* Tag */}
          <motion.div
            variants={fadeUp}
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            custom={0}
            className="inline-flex items-center gap-2 mb-8"
          >
            <span className="w-2 h-2 bg-[#ff4d1c] inline-block" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#ff4d1c]">
              AI Interview Intelligence
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            custom={1}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-[#f0ede8] mb-8"
          >
            The Hiring
            <br />
            <span className="text-[#ff4d1c]">Intelligence</span>
            <br />
            Engine
          </motion.h1>

          {/* Sub */}
          <motion.p
            variants={fadeUp}
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            custom={2}
            className="text-base text-[#9a9690] max-w-md leading-relaxed mb-10"
          >
            Conduct adaptive AI interviews, evaluate real skills, and turn every candidate
            interaction into evidence-backed hiring intelligence.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            custom={3}
            className="flex flex-col sm:flex-row items-start gap-4"
          >
            <Link href="/signup" className="btn-orange px-8 py-3.5 text-sm flex items-center gap-2 group">
              Start Hiring Smarter
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#demo" className="btn-ghost px-8 py-3.5 text-sm">
              Watch Product Demo
            </Link>
          </motion.div>

          {/* Metrics row */}
          <motion.div
            variants={fadeUp}
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            custom={4}
            className="flex items-center gap-8 mt-14 pt-8 border-t border-[#2e2e2e]"
          >
            {[
              { value: "94", label: "Avg. Signal Score" },
              { value: "3x", label: "Faster Hiring" },
              { value: "99%", label: "Candidate Accuracy" },
            ].map((m) => (
              <div key={m.label}>
                <div className="text-3xl font-bold text-[#f0ede8] font-mono">{m.value}</div>
                <div className="text-xs text-[#9a9690] mt-1 font-mono tracking-wider uppercase">{m.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — 3D Engine + Panel overlays */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="flex-1 relative h-[520px] lg:h-[680px] w-full"
        >
          {/* Static preview keeps the hero light; the WebGL narrative loads below on approach. */}
          <div className="core-fallback">
            <div className="core-fallback__orbit" />
            <div className="core-fallback__orbit core-fallback__orbit--inner" />
            <div className="core-fallback__center"><span>AI</span></div>
            {["Candidate", "Interview", "Signals", "Skills", "Graph", "Evaluation", "Decision"].map((label, index) => (
              <div key={label} className={`core-fallback__node core-fallback__node--${index + 1} is-active`}>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Score overlay card — top left */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="absolute top-12 left-0 panel rounded-none p-4 w-52 shadow-[4px_4px_0_#000]"
          >
            <div className="mono-label text-[#555] mb-3">Skill Assessment</div>
            {[
              { label: "Backend Eng.", score: 94 },
              { label: "System Design", score: 89 },
              { label: "Problem Solving", score: 91 },
              { label: "Communication", score: 86 },
            ].map((s) => (
              <div key={s.label} className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-[#555] font-mono">{s.label}</span>
                  <span className="text-xs font-bold text-[#ff4d1c] font-mono">{s.score}</span>
                </div>
                <div className="score-bar-track" style={{ background: "#e0ddd6" }}>
                  <div
                    className="score-bar-fill"
                    style={{ width: `${s.score}%`, background: "#ff4d1c" }}
                  />
                </div>
              </div>
            ))}
          </motion.div>

          {/* Annotation arrow — positioned near the score card */}
          <div className="absolute top-8 left-56 hidden lg:block pointer-events-none">
            <svg width="80" height="50" viewBox="0 0 80 50" fill="none" style={{ overflow: "visible" }}>
              <path d="M10 40 Q30 10 65 15" stroke="#ff4d1c" strokeWidth="1.5" fill="none" opacity="0.6" strokeDasharray="3 2" />
              <polygon points="65,10 70,18 60,17" fill="#ff4d1c" opacity="0.6" />
            </svg>
            <div className="annotation absolute top-0 left-2">candidate signal</div>
          </div>

          {/* Interview status card — bottom right */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="absolute bottom-12 right-0 panel-dark rounded-none p-4 w-52 border border-[#2e2e2e]"
          >
            <div className="mono-label mb-3 text-[#9a9690]">Live Interview</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 bg-[#ff4d1c] rounded-full animate-pulse" />
              <span className="text-xs font-mono text-[#ff4d1c]">Recording</span>
            </div>
            <div className="text-xs font-mono text-[#9a9690] italic">
              &quot;How would you design a highly scalable URL shortener?&quot;
            </div>
            <div className="mt-3 font-mono text-xs text-[#f0ede8]">
              AI Analysis: <span className="text-[#ff4d1c]">Pending...</span>
            </div>
          </motion.div>

          {/* Annotation for interview card */}
          <div className="absolute bottom-6 right-52 hidden lg:block pointer-events-none">
            <div className="annotation">active session</div>
          </div>
        </motion.div>
      </div>

      {/* Bottom scroll indicator */}
      <div className="flex items-center justify-center pb-8 gap-3 opacity-30">
        <div className="w-px h-8 bg-[#f0ede8]" />
        <span className="font-mono text-xs tracking-widest uppercase text-[#f0ede8]">Scroll</span>
        <div className="w-px h-8 bg-[#f0ede8]" />
      </div>
    </section>
  );
}
