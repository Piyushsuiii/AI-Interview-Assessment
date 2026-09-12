import type { Metadata } from "next";
import { InterviewsView } from "@/components/recruiter/interviews-view";
export const metadata: Metadata = { title: "Interview queue | AI Hiring" };
export default function InterviewsPage() { return <InterviewsView />; }
