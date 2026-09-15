"use client";

import { useActionState } from "react";
import { createStaffAction, setStaffRoleAction } from "@/app/actions/console";
import { Field, Status, Submit } from "@/components/editor/ui";
import { AutoSubmitSelect } from "./forms";
import { Shield } from "@/components/icons";
import type { Dictionary } from "@/lib/i18n";

type Copy = Dictionary["console"]["staff"];

export function CreateStaffForm({ copy }: { copy: Copy }) {
  const [state, action] = useActionState(createStaffAction, null);

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.name}>
          <input name="name" className="field" required />
        </Field>
        <Field label={copy.role}>
          <select name="role" defaultValue="support" className="field">
            <option value="support">{copy.roleSupport}</option>
            <option value="owner">{copy.roleOwner}</option>
          </select>
        </Field>
        <Field label={copy.email}>
          <input name="email" type="email" dir="ltr" className="field" required />
        </Field>
        <Field label={copy.password} hint={copy.passwordHint}>
          <input name="password" dir="ltr" minLength={12} className="field" required autoComplete="new-password" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>
          <Shield className="h-4 w-4" />
          {copy.create}
        </Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function StaffRoleControl({
  userId,
  role,
  isSelf,
  copy,
}: {
  userId: string;
  role: string;
  isSelf: boolean;
  copy: Copy;
}) {
  const [state, action] = useActionState(setStaffRoleAction, null);

  if (isSelf) {
    return <span className="text-[11.5px] text-mist-600">{copy.you}</span>;
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <AutoSubmitSelect
        name="role"
        ariaLabel={copy.memberRole}
        defaultValue={role}
        options={[
          { value: "owner", label: copy.shortOwner },
          { value: "support", label: copy.shortSupport },
          { value: "client", label: copy.shortClient },
        ]}
      />
      <Status state={state} />
    </form>
  );
}
