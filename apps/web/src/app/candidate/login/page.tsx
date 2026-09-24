import { CandidateLoginForm } from "@/components/candidate/candidate-login-form";

export default function CandidateLoginPage() {
  return <main className="min-h-screen bg-[#171714] text-[#f5f1e9]"><div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_520px] lg:px-8">
    <div className="hidden lg:block"><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#e85b33]">Private candidate portal</p><h2 className="mt-6 max-w-lg text-6xl font-semibold leading-[0.95] tracking-[-0.06em]">One clear view of every application.</h2><div className="mt-12 grid max-w-lg grid-cols-3 gap-px bg-[#383832]"><div className="bg-[#171714] p-4 font-mono text-[9px] uppercase tracking-widest text-[#9f9b91]">Passwordless</div><div className="bg-[#171714] p-4 font-mono text-[9px] uppercase tracking-widest text-[#9f9b91]">Private</div><div className="bg-[#171714] p-4 font-mono text-[9px] uppercase tracking-widest text-[#9f9b91]">Candidate-owned</div></div></div>
    <CandidateLoginForm />
  </div></main>;
}
