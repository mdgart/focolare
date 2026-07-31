import Image from "next/image";
import Link from "next/link";

export type CategoryTile = { name: string; href: string; image: string };

/** Circular photo tiles for browsing top-level categories, plus a "suggest" tile. */
export function CategoryTiles({ categories }: { categories: CategoryTile[] }) {
  return (
    <nav aria-label="Categories">
      <ul className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:justify-between sm:gap-4 sm:px-0 lg:justify-start lg:gap-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((cat) => (
          <li key={cat.href} className="shrink-0">
            <Link href={cat.href} className="group flex w-20 flex-col items-center gap-2.5 sm:w-24">
              <span className="relative block h-20 w-20 overflow-hidden rounded-full ring-1 ring-sand-strong transition duration-300 group-hover:ring-2 group-hover:ring-terracotta sm:h-24 sm:w-24">
                <Image
                  src={cat.image}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover transition duration-500 group-hover:scale-110"
                />
              </span>
              <span className="text-sm font-medium text-ink-soft transition group-hover:text-terracotta-strong">
                {cat.name}
              </span>
            </Link>
          </li>
        ))}
        <li className="shrink-0">
          <Link
            href="/taxonomy/suggest?from=/"
            className="group flex w-20 flex-col items-center gap-2.5 sm:w-24"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-sand-strong bg-surface text-ink-muted transition duration-300 group-hover:border-terracotta group-hover:text-terracotta sm:h-24 sm:w-24">
              <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden="true">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-sm font-medium text-ink-soft transition group-hover:text-terracotta-strong">
              Suggest
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
