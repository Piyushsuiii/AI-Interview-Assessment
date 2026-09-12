import type { Metadata } from "next";
import { JobsView } from "@/components/recruiter/jobs-view";

export const metadata: Metadata = { title: "Jobs | AI Hiring" };
export default function JobsPage() { return <JobsView />; }
