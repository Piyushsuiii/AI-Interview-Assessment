import type { Metadata } from "next";
import { JobsView } from "@/components/recruiter/jobs-view";

export const metadata: Metadata = { title: "Dashboard | AI Hiring" };
export default function DashboardPage() { return <JobsView dashboard />; }
