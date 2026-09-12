import type { Metadata } from "next";
import { JobForm } from "@/components/recruiter/job-form";

export const metadata: Metadata = { title: "New job | AI Hiring" };
export default function NewJobPage() { return <JobForm />; }
