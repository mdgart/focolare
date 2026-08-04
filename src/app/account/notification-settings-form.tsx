"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateCookNotificationPrefsAction } from "@/actions/account";
import { formField } from "@/lib/form-styles";

type Props = {
  initialPhone: string | null;
  initialNotifyEmail: boolean;
  initialNotifySms: boolean;
  initialNotifyShopping?: boolean;
  smtpConfigured: boolean;
  twilioConfigured: boolean;
  /** SMS delivery is a paid-plan channel; free accounts see it locked. */
  smsEntitled: boolean;
};

export function NotificationSettingsForm(props: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(props.initialPhone ?? "");
  const [notifyEmail, setNotifyEmail] = useState(props.initialNotifyEmail);
  const [notifySms, setNotifySms] = useState(props.initialNotifySms);
  const [notifyShopping, setNotifyShopping] = useState(props.initialNotifyShopping ?? false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await updateCookNotificationPrefsAction({
      phoneE164: phone.trim() || null,
      notifyCookTimerEmail: notifyEmail,
      notifyCookTimerSms: notifySms,
      notifyShoppingReminder: notifyShopping,
    });
    setPending(false);
    if ("error" in res) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Cook timer alerts</h2>
        <p className="mt-1 text-sm text-neutral-600">
          When a step timer ends, we can notify you by web push (browser), email, or SMS. Enable the channels you want
          below; email and SMS only send if the server is configured (SMTP / Twilio).
        </p>
      </div>

      <div className="border-t border-neutral-200 pt-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={notifyShopping}
            onChange={(e) => setNotifyShopping(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-neutral-300 text-amber-700"
          />
          <span>
            <span className="font-medium text-neutral-900">Shopping reminder</span>
            <span className="block text-sm text-neutral-600">
              The evening before a planned day, a note listing what you still need to buy for it.
              Only for days that have recipes and something left to buy — web push only for now.
            </span>
          </span>
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={notifyEmail}
          onChange={(e) => setNotifyEmail(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-neutral-300 text-amber-700"
        />
        <span>
          <span className="font-medium text-neutral-900">Email</span>
          <span className="block text-xs text-neutral-500">
            Uses your account email. SMTP must be set on the server ({props.smtpConfigured ? "configured" : "not configured"}).
          </span>
        </span>
      </label>

      <label
        className={`flex items-start gap-3 ${props.smsEntitled ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
      >
        <input
          type="checkbox"
          checked={notifySms && props.smsEntitled}
          disabled={!props.smsEntitled}
          onChange={(e) => setNotifySms(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-sand-strong accent-terracotta"
        />
        <span>
          <span className="flex items-center gap-2 font-medium text-ink">
            SMS
            {!props.smsEntitled ? (
              <span className="rounded-full bg-terracotta-tint px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-terracotta-strong">
                Pro
              </span>
            ) : null}
          </span>
          <span className="block text-xs text-ink-muted">
            {props.smsEntitled
              ? `Text messages to your mobile. Twilio env vars required (${props.twilioConfigured ? "configured" : "not configured"}).`
              : "Text alerts reach you when your phone is silent or the app is closed — available on the paid plan."}
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="phone-e164" className="text-sm font-medium text-neutral-800">
          Mobile (E.164)
        </label>
        <input
          id="phone-e164"
          type="tel"
          placeholder="+14155552671"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={`mt-1 ${formField}`}
        />
        <p className="mt-1 text-xs text-neutral-500">Include country code with +. Used only if SMS alerts are on.</p>
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary text-sm disabled:opacity-50">
        {pending ? "Saving…" : "Save notification preferences"}
      </button>
    </form>
  );
}
