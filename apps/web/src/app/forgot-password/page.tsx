import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountActionPage } from "@/components/recruiter/account-action-page";

export const metadata: Metadata = { title: "Forgot password | AI Hiring" };
export default function ForgotPasswordPage() {
  return <Suspense><AccountActionPage mode="forgot-password" /></Suspense>;
}
