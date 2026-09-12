import type { Metadata } from "next";
import { CandidateInvitationScreen } from "@/components/candidate/invitation-screen";

export const metadata: Metadata = {
  title: "Candidate interview",
  description: "Review and begin your private interview invitation.",
  robots: { index: false, follow: false },
};

export default function CandidateInterviewPage() {
  return <CandidateInvitationScreen />;
}
