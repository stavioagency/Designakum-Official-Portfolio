"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { checkPaypalAction } from "@/app/actions/console";
import { Check, AlertTriangle, CreditCard } from "@/components/icons";

/**
 * Asks PayPal whether the keys work, without anybody having to buy anything.
 *
 * The failure this exists for reads identically whichever way round it is: a
 * live secret with a sandbox client id and a sandbox secret with a live client
 * id both come back as a 401 from a customer's checkout, hours after the
 * mistake was made, in front of somebody trying to pay.
 */
function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-ghost !py-2 !text-[13px]" disabled={pending}>
      <CreditCard className="h-4 w-4" />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function PaypalCheck({
  copy,
}: {
  copy: { test: string; testing: string; ok: string; rejected: string; unreachable: string; missing: string };
}) {
  const [state, action] = useActionState(checkPaypalAction, null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={action}>
        <Submit label={copy.test} pending={copy.testing} />
      </form>

      {state && (
        <p
          className={`flex items-center gap-2 text-[13px] ${
            state.ok ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {state.ok ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {state.message}
        </p>
      )}
    </div>
  );
}
