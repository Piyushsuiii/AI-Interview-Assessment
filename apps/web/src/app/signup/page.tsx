import type { Metadata } from "next";
import { AuthPage } from "@/components/recruiter/auth-page";

export const metadata: Metadata = { title: "Create account | AI Hiring" };
export default function SignupPage() { return <AuthPage mode="signup" />; }
