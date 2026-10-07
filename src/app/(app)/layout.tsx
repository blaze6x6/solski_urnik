import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getActiveSchoolYear } from "@/lib/data";
import { listNotifications } from "@/lib/notifications";
import { Shell } from "@/components/shell";
import { formatDateSI, todayISO } from "@/lib/time";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [year, notifications] = await Promise.all([
    getActiveSchoolYear(user.scope),
    listNotifications(user.id, user.scope),
  ]);
  const dateLabel = formatDateSI(todayISO());

  return (
    <Shell
      userName={user.name}
      userEmail={user.email}
      yearName={year?.name ?? null}
      dateLabel={dateLabel}
      notifications={notifications}
    >
      {children}
    </Shell>
  );
}
