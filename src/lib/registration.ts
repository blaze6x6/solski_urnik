import { desc } from "drizzle-orm";
import { db } from "@/db";
import { registrationRequests, type RegistrationRequest } from "@/db/schema";

export type RegistrationRequestView = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: "pending" | "invited" | "rejected";
  createdAt: string;
};

export function toRequestView(r: RegistrationRequest): RegistrationRequestView {
  return {
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    status: r.status === "invited" || r.status === "rejected" ? r.status : "pending",
    createdAt: r.createdAt.toISOString(),
  };
}

/** Zadnjih 100 zahtev (najnovejše prve). */
export async function getRegistrationRequests(): Promise<RegistrationRequestView[]> {
  const rows = await db.select().from(registrationRequests).orderBy(desc(registrationRequests.id)).limit(100);
  return rows.map(toRequestView);
}
