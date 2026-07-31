import Image from "next/image";

const sizeClass = {
  xs: "h-8 w-8 text-xs",
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-2xl",
} as const;

export function CreatorAvatar(props: {
  title: string;
  imageUrl?: string | null;
  size?: keyof typeof sizeClass;
}) {
  const size = props.size ?? "md";
  const initial = props.title[0]?.toUpperCase() ?? "?";

  if (props.imageUrl) {
    return (
      <span className={`relative inline-block shrink-0 overflow-hidden rounded-full ${sizeClass[size]}`}>
        <Image
          src={props.imageUrl}
          alt=""
          fill
          className="object-cover"
          unoptimized={props.imageUrl.includes("/api/files")}
          sizes={size === "sm" ? "24px" : size === "md" ? "36px" : size === "lg" ? "48px" : "64px"}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-700 to-amber-800 font-bold text-white ${sizeClass[size]}`}
    >
      {initial}
    </span>
  );
}
