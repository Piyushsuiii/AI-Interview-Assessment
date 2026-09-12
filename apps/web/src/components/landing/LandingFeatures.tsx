"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

const features = [
  {
    tag: "01",
    title: "Adaptive AI Interviews",
    desc: "The AI dynamically adjusts question complexity based on candidate performance. It probes, follows up, and challenges — exactly like a senior engineer on your team would.",
    meta: "Provider-flexible interview engine",
  },
  {
    tag: "02",
    title: "Coding Assessment Engine",
    desc: "Real multi-file coding challenges in Docker-isolated environments. The AI evaluates logic, code quality, edge cases, and problem-solving approach — not just output.",
    meta: "Practical coding environments",
  },
  {
    tag: "03",
    title: "Candidate Skill Intelligence",
    desc: "Every interview produces a multi-dimensional evidence-backed skill profile across Backend, System Design, Communication, and Leadership, with quoted proof from transcripts.",
    meta: "Evidence-backed scoring",
  },
  {
    tag: "04",
    title: "Integrity & Trust Signals",
    desc: "Tab-switch detection, copy-paste tracking, AI-driven probing to verify understanding, and behavioral consistency analysis across the entire session.",
    meta: "Cheat-resistant engine",
  },
  {
    tag: "05",
    title: "Recruiter AI Copilot",
    desc: "Summarizes technical depth into plain business language. Enables non-technical recruiters to confidently make engineering hires backed by hard evidence.",
    meta: "Built for non-technical teams",
  },
  {
    tag: "06",
    title: "Multi-Tenant Organizations",
    desc: "Strict data isolation between organizations from day one. Custom roles, assessment templates, and white-labeled candidate experiences per organization.",
    meta: "Enterprise-ready",
  },
];

export function LandingFeatures() {
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="intelligence" className="bg-blueprint-fine border-t border-[#2e2e2e] py-28" ref={ref}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-20 max-w-xl">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-[#ff4d1c]" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#ff4d1c]">
              Platform Capabilities
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-[#f0ede8] leading-tight">
            Built for the top <br />1% of engineering teams
          </h2>
        </div>

        {/* Feature grid — asymmetric layout */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#2e2e2e]">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="bg-[#111111] p-8 group hover:bg-[#161616] transition-colors"
            >
              <div className="font-mono text-xs text-[#ff4d1c] mb-5 tracking-widest">{f.tag}</div>
              <h3 className="text-base font-bold text-[#f0ede8] mb-3 leading-snug group-hover:text-white transition-colors">
                {f.title}
              </h3>
              <p className="text-xs text-[#9a9690] leading-relaxed mb-6">{f.desc}</p>
              <div className="pt-4 border-t border-[#2e2e2e]">
                <span className="font-mono text-xs text-[#555] italic">{f.meta}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
