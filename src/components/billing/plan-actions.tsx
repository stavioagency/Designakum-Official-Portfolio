"use client";

import { useActionState } from "react";
import { cancelSubscriptionAction, startCheckoutAction } from "@/app/actions/billing";
import { Status, Submit } from "@/components/editor/ui";

export function CheckoutButton({
  plan,
  label,
  highlighted,
}: {
  plan: "monthly" | "yearly";
  label: string;
  highlighted: boolean;
}) {
  const [state, action] = useActionState(startCheckoutAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <Submit
        className={`btn w-full ${highlighted ? "btn-primary" : "btn-ghost"}`}
        pendingLabel="لحظة…"
      >
        {label}
      </Submit>
      <Status state={state} />
    </form>
  );
}

export function CancelSubscription({ atPeriodEnd }: { atPeriodEnd: boolean }) {
  const [state, action] = useActionState(cancelSubscriptionAction, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="immediately" value="0" />
      <Submit className="btn btn-ghost !px-3.5 !py-2 !text-[13px]" pendingLabel="لحظة…">
        {atPeriodEnd ? "التجديد متوقف" : "إيقاف التجديد التلقائي"}
      </Submit>
      <Status state={state} />
    </form>
  );
}
