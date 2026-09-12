import type { Metadata } from "next";
import { NotificationsView } from "@/components/recruiter/notifications-view";

export const metadata: Metadata = { title: "Notifications | AI Hiring" };
export default function NotificationsPage() { return <NotificationsView />; }
