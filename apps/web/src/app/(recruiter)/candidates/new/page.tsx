import type { Metadata } from "next";
import { CandidateForm } from "@/components/recruiter/candidate-form";

export const metadata: Metadata = { title: "New candidate | AI Hiring" };
export default function NewCandidatePage() { return <CandidateForm />; }
