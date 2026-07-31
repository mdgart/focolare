/** Editorial section header: small-caps eyebrow, serif title, optional right-aligned aside. */
export function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta">{eyebrow}</p>
        <h2 className="mt-1.5 text-2xl sm:text-[1.75rem]">{title}</h2>
      </div>
      {aside ? <div className="pb-1">{aside}</div> : null}
    </div>
  );
}
