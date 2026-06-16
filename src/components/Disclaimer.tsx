export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        <strong>Informational only</strong> — eligibility and award details
        change; always verify with the school or scholarship provider before
        relying on this.
      </p>
    );
  }

  return (
    <div
      role="note"
      aria-label="Important disclaimer"
      className="w-full bg-amber-50 border-y border-amber-200"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-start gap-3">
        <svg
          className="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
          aria-hidden="true"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm text-amber-800">
          <strong>Informational only</strong> — eligibility and award details
          change; always verify with the school or scholarship provider before
          relying on this information.
        </p>
      </div>
    </div>
  );
}
