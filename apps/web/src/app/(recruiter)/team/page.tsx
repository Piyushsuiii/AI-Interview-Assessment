import type { Metadata } from "next";
import { TeamView } from "@/components/recruiter/team-view";
export const metadata: Metadata = { title: "Team | AI Hiring" };
export default function TeamPage() { return <TeamView />; }
