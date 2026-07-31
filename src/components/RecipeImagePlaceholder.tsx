/** Editorial placeholder for recipes without a cover photo: line-art pot on warm linen. */
export function RecipeImagePlaceholder({
  className = "aspect-[4/3] rounded-2xl",
}: {
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#f7efe0] via-[#f3e7d2] to-[#ecdcc3] ring-1 ring-black/5 ${className}`}
    >
      <svg
        viewBox="0 0 96 96"
        fill="none"
        stroke="#c2a077"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-24 w-24 sm:h-28 sm:w-28"
        aria-hidden="true"
      >
        {/* steam */}
        <path d="M36 24c-3-5 3-8 0-13" />
        <path d="M48 22c-3.5-6 3.5-9 0-15" />
        <path d="M60 24c-3-5 3-8 0-13" />
        {/* lid */}
        <path d="M26 44c4-10 40-10 44 0" />
        <path d="M22 44h52" />
        {/* handles */}
        <path d="M20 52c-6 1-6 8 1 8" />
        <path d="M76 52c6 1 6 8-1 8" />
        {/* body */}
        <path d="M26 44c-2 20 2 32 22 32s24-12 22-32" />
      </svg>
    </div>
  );
}
