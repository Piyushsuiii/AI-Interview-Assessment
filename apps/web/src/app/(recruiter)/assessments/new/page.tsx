import type { Metadata } from "next";
import { AssessmentForm } from "@/components/recruiter/assessment-form";

export const metadata: Metadata = { title: "New assessment | AI Hiring" };
export default function NewAssessmentPage() { return <AssessmentForm />; }
