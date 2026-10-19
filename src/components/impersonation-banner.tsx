import { Eye } from "lucide-react";
import { stopImpersonationAction } from "@/app/actions/impersonate";

/** Vidna opozorilna vrstica, dokler superadmin gleda račun drugega uporabnika. */
export function ImpersonationBanner({ asName, superName }: { asName: string; superName: string }) {
  return (
    <div
      className="no-print fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#f0c36a] bg-[#fff3d6] px-4 py-2.5 text-[#7a4a00] shadow-lg lg:bottom-4"
      role="status"
    >
      <Eye className="h-4.5 w-4.5 shrink-0" strokeWidth={2.3} />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug font-medium">
        Gledate račun <strong>{asName}</strong> kot superadmin ({superName}). EMŠO in davčna številka sta skrita. Spremembe se zapišejo v račun tega uporabnika.
      </p>
      <form action={stopImpersonationAction}>
        <button className="btn btn-primary !px-3 !py-1.5 text-xs whitespace-nowrap">Končaj ogled</button>
      </form>
    </div>
  );
}
