/** Where this deployment lives, for links and for anything shown to be copied. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  );
}

/** The host alone — focolare.app — for showing an address without the scheme. */
export function appHost(): string {
  return appBaseUrl().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
