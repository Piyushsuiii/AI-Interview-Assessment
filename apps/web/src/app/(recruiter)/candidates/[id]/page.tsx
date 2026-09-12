import { CandidateDetail } from "@/components/recruiter/candidate-detail";

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CandidateDetail id={id} />;
}
