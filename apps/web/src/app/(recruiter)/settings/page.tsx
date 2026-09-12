import type { Metadata } from "next";
import { SettingsView } from "@/components/recruiter/settings-view";
export const metadata: Metadata = { title: "Settings | AI Hiring" };
export default function SettingsPage() { return <SettingsView />; }
