export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`no-print text-center text-[11px] font-medium text-ink-faint ${className}`}>
      Created by Matjaž Tekavec
    </p>
  );
}
