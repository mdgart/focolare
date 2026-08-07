import type { Metadata } from "next";
import Link from "next/link";
import { appHost } from "@/lib/app-url";

/**
 * What we hold, who sees it, and how to get rid of it.
 *
 * Written from what the code actually does rather than from a template — every
 * third party named here appears in the codebase, and the deletion section
 * describes the behaviour in `deleteAccountAction`, including the part people
 * find surprising. A policy that doesn't match the software is worse than none:
 * it is a promise nobody checked.
 *
 * Also a store requirement. Google Play needs a privacy policy URL for every
 * app, and a way to request account deletion that is reachable **without
 * installing the app** — which is why the deletion section is here, on a public
 * page, and not only behind a sign-in.
 */

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Focolare stores, who it is shared with, and how to delete it.",
};

/** Update when the substance changes, not for wording. */
const LAST_UPDATED = "7 August 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-ink-soft">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const host = appHost();

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Privacy</h1>
      <p className="mt-2 text-sm text-ink-muted">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-ink-soft">
        Focolare is a recipe app with a meal planner and a guided cook mode. This page describes
        what it stores, who else sees it, and how to remove it. It is written to match what the
        software actually does.
      </p>

      <Section title="What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Your account</strong> — name, email address, and a profile
            photo if you add one. A phone number only if you turn on text-message reminders.
          </li>
          <li>
            <strong className="text-ink">What you make</strong> — recipes, photos you upload, meal
            plans, your pantry staples, and shopping lists.
          </li>
          <li>
            <strong className="text-ink">Cooking activity</strong> — which recipes you have cooked,
            which step you reached, and timers you set, so cook mode can pick up where you left off.
          </li>
          <li>
            <strong className="text-ink">Choices you make</strong> — recipes you save, channels you
            follow, and notification preferences.
          </li>
        </ul>
        <p>
          There is no advertising, no tracking across other websites, and no analytics product
          watching what you do here.
        </p>
      </Section>

      <Section title="Who else sees it">
        <p>Only where the feature needs it, and only the part it needs:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">AI providers (OpenAI, Groq)</strong> — when you import a
            recipe from text, ask for ingredient substitutions, or convert between cups and grams,
            that text is sent to be processed. Your account details are not.
          </li>
          <li>
            <strong className="text-ink">Hosting and storage (Vercel)</strong> — runs the site and
            stores uploaded images.
          </li>
          <li>
            <strong className="text-ink">Email and text delivery</strong> — an email provider sends
            sign-in and reminder mail; Twilio sends texts, if you enable them.
          </li>
          <li>
            <strong className="text-ink">Pexels</strong> — only if you choose a stock photo, which
            sends your search terms.
          </li>
        </ul>
        <p>Nothing is sold, and nothing is shared for advertising.</p>
      </Section>

      <Section title="What other people see">
        <p>
          Recipes you publish are public, along with your channel name and photo. Private recipes,
          meal plans, pantry, shopping lists and cooking history are yours alone.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          You can delete your account at any time from{" "}
          <Link href="/account" className="font-medium text-terracotta-strong underline">
            your account page
          </Link>
          . It is immediate and cannot be undone.
        </p>
        <p>
          That removes your account, email, photo, phone number, meal plans, pantry, shopping lists,
          cooking history, saved recipes and follows, along with every reminder scheduled for you.
        </p>
        <p>
          <strong className="text-ink">One thing does not disappear.</strong> Recipes you have
          published stay online, because other people may have saved them or put them in a meal
          plan, and removing them would take something away from someone who did not ask for it.
          Your name, profile and address are removed from them entirely — they are shown under an
          anonymous channel with no link back to you. If you would rather they came down, delete
          those recipes first, then delete your account.
        </p>
        <p>
          If you cannot sign in, email{" "}
          <a href={`mailto:privacy@${host}`} className="font-medium text-terracotta-strong underline">
            privacy@{host}
          </a>{" "}
          from the address on the account and ask for it to be deleted.
        </p>
      </Section>

      <Section title="Keeping it">
        <p>
          Your data is kept while the account exists. Deleting the account removes it as described
          above. Backups are overwritten on a rolling basis and are not used to restore deleted
          accounts.
        </p>
      </Section>

      <Section title="Children">
        <p>Focolare is not intended for children under 13, and accounts are not knowingly created for them.</p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about any of this:{" "}
          <a href={`mailto:privacy@${host}`} className="font-medium text-terracotta-strong underline">
            privacy@{host}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
