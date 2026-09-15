"use client";

import { useActionState } from "react";
import { createStaffAction, setStaffRoleAction } from "@/app/actions/console";
import { Field, Status, Submit } from "@/components/editor/ui";
import { AutoSubmitSelect } from "./forms";
import { Shield } from "@/components/icons";

export function CreateStaffForm() {
  const [state, action] = useActionState(createStaffAction, null);

  return (
    <form action={action} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم">
          <input name="name" className="field" required />
        </Field>
        <Field label="الدور">
          <select name="role" defaultValue="support" className="field">
            <option value="support">فريق الدعم</option>
            <option value="owner">مالك المنصة</option>
          </select>
        </Field>
        <Field label="البريد الإلكتروني">
          <input name="email" type="email" dir="ltr" className="field" required />
        </Field>
        <Field label="كلمة المرور" hint="12 حرفًا على الأقل لحسابات الفريق.">
          <input name="password" dir="ltr" minLength={12} className="field" required autoComplete="new-password" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Submit>
          <Shield className="h-4 w-4" />
          إنشاء الحساب
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
}: {
  userId: string;
  role: string;
  isSelf: boolean;
}) {
  const [state, action] = useActionState(setStaffRoleAction, null);

  if (isSelf) {
    return <span className="text-[11.5px] text-mist-600">حسابك الحالي</span>;
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <AutoSubmitSelect
        name="role"
        ariaLabel="دور الموظف"
        defaultValue={role}
        options={[
          { value: "owner", label: "مالك" },
          { value: "support", label: "دعم" },
          { value: "client", label: "عميل عادي" },
        ]}
      />
      <Status state={state} />
    </form>
  );
}
