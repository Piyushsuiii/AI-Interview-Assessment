import type { Metadata } from "next";
import { BillingView } from "@/components/recruiter/billing-view";

export const metadata: Metadata = { title: "Billing | AI Hiring" };
export default function BillingPage() { return <BillingView />; }
