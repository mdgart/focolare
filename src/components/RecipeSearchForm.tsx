export function RecipeSearchForm({
  action = "/discover",
  defaultQuery = "",
  hiddenFields,
}: {
  action?: string;
  defaultQuery?: string;
  hiddenFields?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" className="relative min-w-0">
      <div className="flex min-w-0 items-center gap-2 rounded-full border border-sand-strong bg-surface py-1.5 pl-4 pr-1.5 shadow-sm transition focus-within:border-terracotta focus-within:ring-2 focus-within:ring-terracotta/20 sm:pl-5">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-5 w-5 shrink-0 text-ink-muted"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="5.75" />
          <path d="M13.5 13.5L17 17" strokeLinecap="round" />
        </svg>
        <input
          name="q"
          defaultValue={defaultQuery}
          placeholder="Search recipes…"
          className="min-w-0 flex-1 bg-transparent py-2 text-[0.95rem] text-ink outline-none placeholder:text-ink-muted focus-visible:outline-none"
        />
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}
        <button
          type="submit"
          className="btn btn-primary shrink-0 !px-5 !py-2 text-sm sm:!px-6 sm:!py-2.5"
        >
          Search
        </button>
      </div>
    </form>
  );
}
