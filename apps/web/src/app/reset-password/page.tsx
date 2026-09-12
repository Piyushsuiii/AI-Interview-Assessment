import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountActionPage } from "@/components/recruiter/account-action-page";

export const metadata: Metadata = { title: "Reset password | AI Hiring" };
export default function ResetPasswordPage() {
  return <Suspense><AccountActionPage mode="reset-password" /></Suspense>;
}
