"use client";

import { useActionState } from "react";
import {
  deleteCustomerAction,
  endSubscriptionAction,
  extendSubscriptionAction,
  grantSubscriptionAction,
  reactivateSubscriptionAction,
  resetCustomerPasswordAction,
  setAccountStatusAction,
} from "@/app/actions/console";
import {
  restorePortfolioAction,
  suspendPortfolioAction,
} from "@/app/actions/moderation";
import { Field, Status, Submit } from "@/components/editor/ui";
import { ConfirmSubmit } from "./forms";
import { Ban, Check, Gift, Trash } from "@/components/icons";
import { fill, type Dictionary } from "@/lib/i18n";

export interface DialogChrome {
  cancel: string;
  pending: string;
  confirmParts: [string, string];
}

type Copy = Dictionary["console"]["customer"];

export function AccountStatusControl({
  userId,
  email,
  suspended,
  copy,
  dialog,
  pending,
}: {
  userId: string;
  email: string;
  suspended: boolean;
  copy: Copy;
  dialog: DialogChrome;
  pending: string;
}) {
  const [state, action] = useActionState(setAccountStatusAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />

      {!suspended && (
        <Field label={copy.suspendReason} hint={copy.suspendReasonHint}>
          <input name="reason" className="field" placeholder={copy.suspendReasonPlaceholder} />
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {suspended ? (
          <Submit className="btn btn-primary" pendingLabel={pending}>
            <Check className="h-4 w-4" />
            {copy.reactivate}
          </Submit>
        ) : (
          <ConfirmSubmit
            cancelLabel={dialog.cancel}
            pendingLabel={dialog.pending}
            confirmParts={dialog.confirmParts}
            label={copy.suspendAccount}
            icon={<Ban className="h-4 w-4" />}
            title={copy.suspendAccountTitle}
            body={fill(copy.suspendAccountBody, { email })}
            confirmLabel={copy.suspendAccount}
          />
        )}
        <Status state={state} />
      </div>
    </form>
  );
}

export function PortfolioSuspensionControl({
  portfolioId,
  slug,
  suspended,
  reason,
  copy,
  dialog,
  pending,
}: {
  portfolioId: string;
  slug: string;
  suspended: boolean;
  reason?: string;
  copy: Copy;
  dialog: DialogChrome;
  pending: string;
}) {
  const [suspendState, suspend] = useActionState(suspendPortfolioAction, null);
  const [restoreState, restore] = useActionState(restorePortfolioAction, null);

  if (suspended) {
    return (
      <form action={restore} className="space-y-3">
        <input type="hidden" name="portfolioId" value={portfolioId} />
        {reason && (
          <p className="panel px-3.5 py-2.5 text-[12.5px] leading-relaxed text-mist-400">
            {fill(copy.suspendedReason, { reason })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Submit className="btn btn-ghost" pendingLabel={pending}>
            {copy.republish}
          </Submit>
          <Status state={restoreState} />
        </div>
      </form>
    );
  }

  return (
    <form action={suspend} className="space-y-3">
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
        <Field label={copy.portfolioReason}>
          <input
            name="reason"
            className="field"
            placeholder={copy.portfolioReasonPlaceholder}
            required
            minLength={5}
          />
        </Field>
        <Field label={copy.duration} hint={copy.durationHint}>
          <input name="days" type="number" min={0} max={365} defaultValue={0} className="field" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmSubmit
            cancelLabel={dialog.cancel}
            pendingLabel={dialog.pending}
            confirmParts={dialog.confirmParts}
          label={copy.suspendPortfolio}
          title={copy.suspendPortfolioTitle}
          body={fill(copy.suspendPortfolioBody, { slug })}
          confirmLabel={copy.suspendPortfolio}
        />
        <Status state={suspendState} />
      </div>
    </form>
  );
}

export function SubscriptionControls({
  userId,
  hasSubscription,
  isActive,
  copy,
  dialog,
  plans,
}: {
  userId: string;
  hasSubscription: boolean;
  isActive: boolean;
  copy: Copy;
  dialog: DialogChrome;
  plans: { monthly: string; yearly: string };
}) {
  const [grantState, grant] = useActionState(grantSubscriptionAction, null);
  const [extendState, extend] = useActionState(extendSubscriptionAction, null);
  const [endState, end] = useActionState(endSubscriptionAction, null);
  const [reactivateState, reactivate] = useActionState(reactivateSubscriptionAction, null);

  return (
    <div className="space-y-5">
      <form action={grant} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={copy.plan}>
            <select name="plan" defaultValue="monthly" className="field">
              <option value="monthly">{plans.monthly}</option>
              <option value="yearly">{plans.yearly}</option>
            </select>
          </Field>
          <Field label={copy.grantDuration} hint={copy.grantDurationHint}>
            <input name="months" type="number" min={1} max={60} defaultValue={1} className="field" />
          </Field>
          <Field label={copy.kind}>
            <select name="comped" defaultValue="1" className="field">
              <option value="1">{copy.kindComped}</option>
              <option value="0">{copy.kindOffPlatform}</option>
            </select>
          </Field>
        </div>
        <Field label={copy.note} hint={copy.noteHint}>
          <input name="note" className="field" placeholder={copy.notePlaceholder} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Submit className="btn btn-primary">
            <Gift className="h-4 w-4" />
            {copy.grant}
          </Submit>
          <Status state={grantState} />
        </div>
      </form>

      {hasSubscription && (
        <div className="space-y-4 border-t border-white/8 pt-5">
          <form action={extend} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={userId} />
            <div className="w-28">
              <Field label={copy.extendMonths}>
                <input name="months" type="number" min={1} max={60} defaultValue={1} className="field" />
              </Field>
            </div>
            <Submit className="btn btn-ghost">{copy.extend}</Submit>
            <Status state={extendState} />
          </form>

          {isActive ? (
            <form action={end} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="immediately" value="1" />
              <ConfirmSubmit
            cancelLabel={dialog.cancel}
            pendingLabel={dialog.pending}
            confirmParts={dialog.confirmParts}
                label={copy.endNow}
                className="btn btn-danger !px-3.5 !py-2 !text-[13px]"
                title={copy.endNowTitle}
                body={copy.endNowBody}
                confirmLabel={copy.endNowConfirm}
              />
              <Status state={endState} />
            </form>
          ) : (
            <form action={reactivate} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="userId" value={userId} />
              <Submit className="btn btn-ghost">{copy.restoreLast}</Submit>
              <Status state={reactivateState} />
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function PasswordResetControl({ userId, copy }: { userId: string; copy: Copy }) {
  const [state, action] = useActionState(resetCustomerPasswordAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <Field label={copy.newPassword} hint={copy.newPasswordHint}>
        <input name="password" className="field" dir="ltr" minLength={8} required autoComplete="new-password" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-ghost">{copy.setPassword}</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function DeleteCustomerControl({
  userId,
  email,
  copy,
  dialog,
}: {
  userId: string;
  email: string;
  copy: Copy;
  dialog: DialogChrome;
}) {
  const [state, action] = useActionState(deleteCustomerAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="confirm" value={email} />
      <Field label={copy.deleteReason}>
        <input name="reason" className="field" placeholder={copy.deleteReasonPlaceholder} />
      </Field>
      <p className="text-[12px] leading-relaxed text-mist-500">
        {copy.deleteWarning}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmSubmit
            cancelLabel={dialog.cancel}
            pendingLabel={dialog.pending}
            confirmParts={dialog.confirmParts}
          label={copy.deleteAccount}
          icon={<Trash className="h-4 w-4" />}
          title={copy.deleteTitle}
          body={fill(copy.deleteBody, { email })}
          confirmLabel={copy.deleteConfirm}
          requireText={email}
        />
        <Status state={state} />
      </div>
    </form>
  );
}
