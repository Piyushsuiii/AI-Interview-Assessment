import type { Metadata } from "next";
import { CandidatesView } from "@/components/recruiter/candidates-view";

export const metadata: Metadata = { title: "Candidates | AI Hiring" };
export default function CandidatesPage() { return <CandidatesView />; }
