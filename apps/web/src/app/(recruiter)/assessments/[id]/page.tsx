import { AssessmentDetail } from "@/components/recruiter/assessment-detail";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssessmentDetail id={id} />;
}
