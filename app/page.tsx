import { listUpcomingItems } from "@/lib/db";
import ScheduleApp from "@/components/ScheduleApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await listUpcomingItems();
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_TO_EMAIL);
  return <ScheduleApp initialItems={items} emailConfigured={emailConfigured} />;
}
