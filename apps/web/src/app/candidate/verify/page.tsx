import { Suspense } from "react";
import { CandidateVerify } from "@/components/candidate/candidate-verify";

export default function CandidateVerifyPage() { return <main className="grid min-h-screen place-items-center bg-[#171714] p-5"><div className="w-full max-w-lg"><Suspense fallback={<div className="bg-[#f3efe7] p-10 text-[#171714]">Preparing secure sign in...</div>}><CandidateVerify /></Suspense></div></main>; }
