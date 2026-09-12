"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";

const FAQS = [
  {
    q: "How does AI evaluate subjective skills like communication?",
    a: "We use advanced NLP to analyze structure, clarity, conciseness, and technical precision. Scores are anchored by direct evidence — specific quoted phrases from the transcript.",
  },
  {
    q: "Is there a candidate-facing experience or just recruiter tools?",
    a: "Both. Candidates get a clean, accessible interview interface. Recruiters see a rich evidence-backed report. The two surfaces are completely separate.",
  },
  {
    q: "Can I use my own AI provider?",
    a: "The platform uses a centralized provider abstraction so interview and evaluation workflows are not tied to one model. Contact us to discuss your deployment requirements.",
  },
  {
    q: "How is candidate data handled?",
    a: "Each organization is strictly isolated at the data layer. Candidate PII can be anonymized for bias-free evaluation modes. All data is encrypted in transit and at rest.",
  },
];

const plans = [
  {
    name: "Growth",
    price: "$499",
    period: "/month",
    desc: "For startups scaling engineering hiring.",
    features: ["50 AI interviews/mo", "Basic coding sandbox", "Skill intelligence reports", "Email support"],
    cta: "Start Free Trial",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For organizations requiring high volume and custom AI.",
    features: ["Unlimited interviews", "Custom Docker environments", "Integrity signal suite", "Dedicated account manager"],
    cta: "Contact Sales",
    href: "#demo",
    highlight: true,
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className="border-b border-[#2e2e2e] group"
    >
      <summary className="flex justify-between items-center py-5 cursor-pointer list-none select-none hover:text-white transition-colors text-[#f0ede8]">
        <span className="text-sm font-medium pr-6">{q}</span>
        <span className="font-mono text-[#ff4d1c] text-lg shrink-0 group-open:rotate-45 transition-transform duration-200">
          +
        </span>
      </summary>
      <p className="text-sm text-[#9a9690] leading-relaxed pb-5">{a}</p>
    </details>
  );
}

export function LandingEssentials() {
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <>
      {/* ── Social proof ── */}
      <section className="border-t border-[#2e2e2e] py-16 bg-[#0e0e0e]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="font-mono text-xs tracking-[0.2em] uppercase text-[#555] text-center mb-10">
            Trusted by engineering-led teams
          </div>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-40">
            {["Acme Corp", "Globex", "Soylent Co", "Initech", "Umbrella"].map((c) => (
              <span key={c} className="font-mono text-sm tracking-widest uppercase text-[#f0ede8]">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-blueprint border-t border-[#2e2e2e] py-28" ref={ref}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 max-w-xl">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-[#ff4d1c]" />
              <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#ff4d1c]">Pricing</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-[#f0ede8] leading-tight">
              No surprise charges.<br />Just results.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={reducedMotion ? false : { opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15 }}
                className={`p-8 border ${plan.highlight ? "border-[#ff4d1c]/40 bg-[#1a0e0b]" : "border-[#2e2e2e] bg-[#111111]"}`}
              >
                {plan.highlight && (
                  <div className="font-mono text-xs text-[#ff4d1c] mb-4 tracking-widest">
                    ↑ MOST POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold text-[#f0ede8] mb-1">{plan.name}</h3>
                <p className="text-xs text-[#9a9690] mb-6">{plan.desc}</p>
                <div className="mb-8">
                  <span className="text-4xl font-bold font-mono text-[#f0ede8]">{plan.price}</span>
                  <span className="text-[#9a9690] font-mono text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-xs text-[#9a9690]">
                      <Check className="w-3.5 h-3.5 text-[#ff4d1c] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                   className={plan.highlight ? "btn-orange px-6 py-3 text-xs w-full" : "btn-ghost px-6 py-3 text-xs w-full text-center"}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-[#2e2e2e] py-28 bg-[#0e0e0e]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-[#ff4d1c]" />
                <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#ff4d1c]">FAQ</span>
              </div>
              <h2 className="text-4xl font-bold text-[#f0ede8] leading-tight">
                Common<br />questions.
              </h2>
            </div>
            <div>
              {FAQS.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="bg-[#ff4d1c] py-24">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
            <div className="font-mono text-xs tracking-[0.2em] uppercase text-white/60 mb-3">
              Ready to hire smarter?
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
              Start interviewing<br />with intelligence.
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <Link href="/signup" className="bg-white text-[#ff4d1c] font-mono font-bold uppercase tracking-widest text-xs px-8 py-4 text-center hover:bg-[#f0ede8] transition-colors">
              Get Early Access
            </Link>
            <Link href="#demo" className="border border-white/30 text-white font-mono text-xs uppercase tracking-widest px-8 py-4 text-center hover:border-white/70 transition-colors">
              See a Demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
