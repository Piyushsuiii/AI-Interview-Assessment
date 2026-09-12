import { AppShell } from "@/components/recruiter/app-shell";
import { ReportView } from "@/components/intelligence/report-view";

export default async function ReportPage({ params }: { params: Promise<{ interviewId: string }> }) {
  const { interviewId } = await params;
  return <AppShell><ReportView interviewId={interviewId} /></AppShell>;
}
