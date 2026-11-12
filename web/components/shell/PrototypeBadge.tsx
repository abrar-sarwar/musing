export function PrototypeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border border-fb-divider bg-fb-input px-2 py-0.5 text-[10px] font-medium text-fb-muted sm:px-2.5 sm:py-1 sm:text-[11px] ${className}`}
    >
      hackathon prototype · mock data
    </span>
  );
}
