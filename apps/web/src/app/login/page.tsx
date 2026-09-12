import type { Metadata } from "next";
import { AuthPage } from "@/components/recruiter/auth-page";

export const metadata: Metadata = { title: "Sign in | AI Hiring" };
export default function LoginPage() { return <AuthPage mode="login" />; }
