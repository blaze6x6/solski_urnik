import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getImpersonator, getSessionUser } from "@/lib/auth";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { getActiveSchoolYear } from "@/lib/data";
import { listNotifications } from "@/lib/notifications";
import { allowedNotifKinds, childNavHrefs } from "@/lib/child-permissions";
import { Shell } from "@/components/shell";
import { formatDateSI, todayISO } from "@/lib/time";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [year, notifications, impersonator] = await Promise.all([
    getActiveSchoolYear(user.scope),
    listNotifications(user.id, user.scope, 50, user.perms ? allowedNotifKinds(user.perms) : undefined),
    getImpersonator(),
  ]);
  const dateLabel = formatDateSI(todayISO());

  return (
    <Shell
      userName={user.name}
      userEmail={user.email}
      yearName={year?.name ?? null}
      dateLabel={dateLabel}
      notifications={notifications}
      navHrefs={user.perms ? childNavHrefs(user.perms) : undefined}
    >
      {children}
      {impersonator ? <ImpersonationBanner asName={user.name} superName={impersonator.name} /> : null}
    </Shell>
  );
}
