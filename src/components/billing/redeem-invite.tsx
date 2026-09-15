"use client";

import { useActionState } from "react";
import { redeemInvitationAction } from "@/app/actions/invitations";
import { Status, Submit } from "@/components/editor/ui";
import { Gift } from "@/components/icons";

export function RedeemInvite({ copy }: { copy: { redeem: string; redeeming: string } }) {
  const [state, action] = useActionState(redeemInvitationAction, null);

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="code"
          className="field !w-auto min-w-[180px] flex-1 tracking-wider"
          dir="ltr"
          placeholder="ABCDE-FGHIJ"
          required
          autoComplete="off"
        />
        <Submit className="btn btn-ghost" pendingLabel={copy.redeeming}>
          <Gift className="h-4 w-4" />
          {copy.redeem}
        </Submit>
      </div>
      <Status state={state} />
    </form>
  );
}
