"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: "easeOut" as const },
  }),
};

function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
  const reducedMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || reducedMotion) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.substring(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [inView, reducedMotion, text, speed]);

  return <span ref={ref}>{reducedMotion ? text : displayed}</span>;
}

function AnimatedScore({ score }: { score: number }) {
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const duration = 1200;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * score));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, reducedMotion, score]);

  return <span ref={ref}>{reducedMotion ? score : current}</span>;
}

export function InteractiveInterviewDemo() {
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-100px" });

  const scores = [
    { label: "System Design", value: 89, color: "#ff4d1c" },
    { label: "Scalability", value: 94, color: "#ff4d1c" },
    { label: "Database Knowledge", value: 87, color: "#ff4d1c" },
    { label: "Trade-off Reasoning", value: 91, color: "#ff4d1c" },
  ];

  return (
    <section
      ref={sectionRef}
      id="demo"
      className="bg-[#0e0e0e] border-t border-[#2e2e2e] py-28"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-[#ff4d1c]" />
              <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#ff4d1c]">
                Live Interview Engine
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold leading-tight text-[#f0ede8]">
              Every question.<br />Every signal.
            </h2>
          </div>
          <p className="text-[#9a9690] max-w-sm text-sm leading-relaxed lg:text-right">
            The AI conducts adaptive technical interviews, probing candidate answers in real-time — exactly like a senior engineer would.
          </p>
        </div>

        {/* Demo grid */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left — Chat panel */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="panel-dark border border-[#2e2e2e] p-6"
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#2e2e2e]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff4d1c]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e2e2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e2e2e]" />
              </div>
              <span className="mono-label text-[#9a9690] flex-1 text-center">
                Interview Session — Alex Chen, Senior Engineer
              </span>
            </div>

            {/* Messages */}
            <div className="space-y-6 min-h-[280px]">
              {/* AI Message */}
              <motion.div
                variants={fadeUp}
                initial={reducedMotion ? false : "hidden"}
                animate={inView ? "visible" : "hidden"}
                custom={1}
                className="flex gap-3"
              >
                <div className="w-6 h-6 bg-[#ff4d1c] flex items-center justify-center text-white shrink-0 mt-0.5">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <rect x="1" y="1" width="3" height="3" />
                    <rect x="6" y="1" width="3" height="3" />
                    <rect x="1" y="6" width="3" height="3" />
                    <rect x="6" y="6" width="3" height="3" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="mono-label text-[#9a9690] mb-1.5">AI Interviewer</div>
                  <div className="text-sm text-[#f0ede8] leading-relaxed bg-[#1a1a1a] border border-[#2e2e2e] p-3">
                    How would you design a highly scalable URL shortener? Walk me through your architecture decisions and trade-offs.
                  </div>
                </div>
              </motion.div>

              {/* Candidate Message */}
              <motion.div
                variants={fadeUp}
                initial={reducedMotion ? false : "hidden"}
                animate={inView ? "visible" : "hidden"}
                custom={3}
                className="flex gap-3 flex-row-reverse"
              >
                <div className="w-6 h-6 bg-[#2e2e2e] flex items-center justify-center text-[#f0ede8] shrink-0 mt-0.5 text-xs font-mono font-bold">
                  AC
                </div>
                <div className="flex-1">
                  <div className="mono-label text-[#9a9690] mb-1.5 text-right">Candidate</div>
                  <div className="text-sm text-[#f0ede8] leading-relaxed bg-[#1e1e1e] border border-[#ff4d1c]/20 p-3">
                    <TypewriterText
                      text="I'd start with a load balancer pointing to stateless API servers. For the database, a NoSQL store like DynamoDB for the high read-to-write ratio — add consistent hashing for sharding. Redis in front for caching hot URLs. The encoding can use base62 on an auto-increment sequence..."
                      speed={18}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right — Analysis panel */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            {/* Score panel */}
            <div className="panel-dark border border-[#2e2e2e] p-6 flex-1">
              <div className="flex items-center justify-between mb-6">
                <span className="mono-label text-[#9a9690]">Real-time Analysis</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#ff4d1c] rounded-full animate-pulse" />
                  <span className="mono-label text-[#ff4d1c]">Processing</span>
                </span>
              </div>
              <div className="space-y-5">
                {scores.map((s, i) => (
                  <motion.div
                    key={s.label}
                    variants={fadeUp}
                    initial={reducedMotion ? false : "hidden"}
                    animate={inView ? "visible" : "hidden"}
                    custom={i + 1}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-mono text-[#9a9690]">{s.label}</span>
                      <span className="text-sm font-mono font-bold text-[#ff4d1c]">
                        <AnimatedScore score={s.value} />
                      </span>
                    </div>
                    <div className="score-bar-track">
                      <motion.div
                        className="score-bar-fill"
                        initial={reducedMotion ? false : { width: 0 }}
                        animate={inView ? { width: `${s.value}%` } : { width: 0 }}
                        transition={{ delay: i * 0.1 + 0.5, duration: 1, ease: "easeOut" }}
                        style={{ background: s.color }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Evidence panel */}
            <div className="panel border border-[#ccc8c0] p-5">
              <div className="mono-label text-[#555] mb-3">↳ Evidence Extracted</div>
              <p className="text-xs text-[#333] leading-relaxed italic">
                &quot;Candidate correctly identified horizontal scaling via consistent hashing and Redis caching strategy. Trade-off discussion between SQL/NoSQL showed depth. Encoding approach via base62 is industry-standard.&quot;
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className="bg-[#ff4d1c] text-white text-xs font-mono px-2 py-0.5">STRONG HIRE</span>
                <span className="mono-label text-[#555]">Overall: 90 / 100</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
