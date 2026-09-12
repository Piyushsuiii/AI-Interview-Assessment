"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const CoreScene = dynamic(() => import("./CandidateIntelligenceScene"), {
  ssr: false,
});

const STAGES = [
  {
    label: "Candidate",
    title: "Start with the whole candidate.",
    copy: "A candidate enters as more than a resume: their experience, context, and role expectations establish the first evidence layer.",
    detail: "Profile + role context",
  },
  {
    label: "Interview",
    title: "Let the interview adapt.",
    copy: "Questions respond to the depth and direction of each answer, creating a focused conversation instead of a fixed questionnaire.",
    detail: "Adaptive follow-ups",
  },
  {
    label: "Signals",
    title: "Capture signals, not keywords.",
    copy: "Reasoning, communication, implementation choices, and trade-offs become discrete signals tied to moments in the interview.",
    detail: "Transcript-linked evidence",
  },
  {
    label: "Skills",
    title: "Map evidence to skills.",
    copy: "Related signals resolve into a multi-dimensional skill profile, preserving both strengths and areas that need review.",
    detail: "Structured skill profile",
  },
  {
    label: "Graph",
    title: "See how the evidence connects.",
    copy: "The intelligence graph connects answers, signals, and competencies so reviewers can trace every conclusion back to its source.",
    detail: "Explainable relationships",
  },
  {
    label: "Evaluation",
    title: "Evaluate against the role.",
    copy: "Evidence is weighed against the role rubric, making the assessment consistent while keeping human review in the loop.",
    detail: "Role-calibrated rubric",
  },
  {
    label: "Recommendation",
    title: "Make a defensible decision.",
    copy: "Recruiters receive a concise recommendation with supporting evidence, confidence, and clear points for final review.",
    detail: "Recommendation + rationale",
  },
] as const;

function CoreFallback({ activeStage }: { activeStage: number }) {
  return (
    <div className="core-fallback" aria-hidden="true">
      <div className="core-fallback__orbit" />
      <div className="core-fallback__orbit core-fallback__orbit--inner" />
      <div className="core-fallback__center">
        <span>{String(activeStage + 1).padStart(2, "0")}</span>
      </div>
      {STAGES.map((stage, index) => (
        <div
          key={stage.label}
          className={`core-fallback__node core-fallback__node--${index + 1} ${index <= activeStage ? "is-active" : ""}`}
        >
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  );
}

export function CandidateIntelligenceCore() {
  const sectionRef = useRef<HTMLElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [canRender3D, setCanRender3D] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const activeStage = Math.min(STAGES.length - 1, Math.round(progress * (STAGES.length - 1)));

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const checkFrame = requestAnimationFrame(() => {
      try {
        const canvas = document.createElement("canvas");
        setCanRender3D(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
      } catch {
        setCanRender3D(false);
      }
    });
    return () => cancelAnimationFrame(checkFrame);
  }, [reducedMotion]);

  useEffect(() => {
    const visual = visualRef.current;
    if (!visual || reducedMotion) return;
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      rootMargin: "50% 0px",
    });
    observer.observe(visual);
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    const update = () => {
      frameRef.current = null;
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      setProgress(Math.min(1, Math.max(0, -rect.top / distance)));
    };
    const requestUpdate = () => {
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} id="intelligence" className="core-narrative bg-blueprint-fine" aria-labelledby="core-heading">
      <div ref={visualRef} className="core-narrative__visual">
        <div className="absolute inset-x-6 top-20 z-10 flex items-center justify-between border-b border-white/10 pb-3 lg:inset-x-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#ff4d1c]">Candidate Intelligence Core</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#777]">Stage {activeStage + 1} / 7</span>
        </div>
        {canRender3D && nearViewport && !reducedMotion ? (
          <CoreScene progress={progress} />
        ) : (
          <CoreFallback activeStage={reducedMotion ? STAGES.length - 1 : activeStage} />
        )}
        <div className="core-narrative__rail" aria-hidden="true">
          {STAGES.map((stage, index) => (
            <span key={stage.label} className={index <= activeStage ? "is-active" : ""} />
          ))}
        </div>
      </div>

      <div className="core-narrative__content relative z-20 mx-auto max-w-7xl px-6">
        <h2 id="core-heading" className="sr-only">How the Candidate Intelligence Core works</h2>
        <ol className="list-none">
          {STAGES.map((stage, index) => (
            <li key={stage.label} className={`core-narrative__stage ${index % 2 ? "lg:ml-auto" : ""}`}>
              <article className="core-narrative__copy" aria-current={activeStage === index ? "step" : undefined}>
                <div className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#ff4d1c]">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span className="h-px w-8 bg-[#ff4d1c]/60" />
                  <span>{stage.label}</span>
                </div>
                <h3 className="mb-4 text-3xl font-bold leading-tight text-[#f0ede8] sm:text-4xl">{stage.title}</h3>
                <p className="max-w-md text-sm leading-7 text-[#9a9690]">{stage.copy}</p>
                <div className="mt-7 border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[#666]">{stage.detail}</div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
