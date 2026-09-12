import { AppShell } from "@/components/recruiter/app-shell";
import { InterviewReplayView } from "@/components/intelligence/interview-replay";

export default async function InterviewReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><InterviewReplayView interviewId={id} /></AppShell>;
}
