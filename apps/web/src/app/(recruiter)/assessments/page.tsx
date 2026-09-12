import type { Metadata } from "next";
import { AssessmentsView } from "@/components/recruiter/assessments-view";

export const metadata: Metadata = { title: "Assessments | AI Hiring" };
export default function AssessmentsPage() { return <AssessmentsView />; }
