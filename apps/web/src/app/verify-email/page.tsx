import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountActionPage } from "@/components/recruiter/account-action-page";

export const metadata: Metadata = { title: "Verify email | AI Hiring" };
export default function VerifyEmailPage() {
  return <Suspense><AccountActionPage mode="verify-email" /></Suspense>;
}
