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

export function AccountStatusControl({
  userId,
  email,
  suspended,
}: {
  userId: string;
  email: string;
  suspended: boolean;
}) {
  const [state, action] = useActionState(setAccountStatusAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />

      {!suspended && (
        <Field label="سبب الإيقاف" hint="يُحفظ في سجل التدقيق.">
          <input name="reason" className="field" placeholder="مخالفة قواعد النشر…" />
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {suspended ? (
          <Submit className="btn btn-primary" pendingLabel="لحظة…">
            <Check className="h-4 w-4" />
            إعادة تفعيل الحساب
          </Submit>
        ) : (
          <ConfirmSubmit
            label="إيقاف الحساب"
            icon={<Ban className="h-4 w-4" />}
            title="إيقاف هذا الحساب؟"
            body={`سيفقد ${email} إمكانية الدخول فورًا وتُنهى جلساته النشطة. يبقى المحتوى والبيانات كما هي، ويمكنك إعادة التفعيل لاحقًا.`}
            confirmLabel="إيقاف الحساب"
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
}: {
  portfolioId: string;
  slug: string;
  suspended: boolean;
  reason?: string;
}) {
  const [suspendState, suspend] = useActionState(suspendPortfolioAction, null);
  const [restoreState, restore] = useActionState(restorePortfolioAction, null);

  if (suspended) {
    return (
      <form action={restore} className="space-y-3">
        <input type="hidden" name="portfolioId" value={portfolioId} />
        {reason && (
          <p className="panel px-3.5 py-2.5 text-[12.5px] leading-relaxed text-mist-400">
            سبب الإيقاف: {reason}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Submit className="btn btn-ghost" pendingLabel="لحظة…">
            إعادة نشر المعرض
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
        <Field label="سبب الإيقاف">
          <input name="reason" className="field" placeholder="محتوى مخالف…" required minLength={5} />
        </Field>
        <Field label="المدة" hint="0 = دائم">
          <input name="days" type="number" min={0} max={365} defaultValue={0} className="field" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmSubmit
          label="إيقاف المعرض"
          title="إيقاف هذا المعرض عن العامة؟"
          body={`سيصبح /p/${slug} غير متاح للزوار. يحتفظ العميل بكل أعماله وصوره وإعداداته، ويمكنك إعادة النشر في أي وقت.`}
          confirmLabel="إيقاف المعرض"
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
}: {
  userId: string;
  hasSubscription: boolean;
  isActive: boolean;
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
          <Field label="الباقة">
            <select name="plan" defaultValue="monthly" className="field">
              <option value="monthly">شهرية</option>
              <option value="yearly">سنوية</option>
            </select>
          </Field>
          <Field label="المدة" hint="بالأشهر للباقة الشهرية، بالسنوات للسنوية.">
            <input name="months" type="number" min={1} max={60} defaultValue={1} className="field" />
          </Field>
          <Field label="النوع">
            <select name="comped" defaultValue="1" className="field">
              <option value="1">مجاني ممنوح</option>
              <option value="0">مدفوع خارج المنصة</option>
            </select>
          </Field>
        </div>
        <Field label="ملاحظة" hint="تظهر في سجل التدقيق مع اسمك.">
          <input name="note" className="field" placeholder="فاتورة محوّلة بنكيًا / اتفاق شراكة…" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Submit className="btn btn-primary">
            <Gift className="h-4 w-4" />
            تفعيل الاشتراك
          </Submit>
          <Status state={grantState} />
        </div>
      </form>

      {hasSubscription && (
        <div className="space-y-4 border-t border-white/8 pt-5">
          <form action={extend} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={userId} />
            <div className="w-28">
              <Field label="تمديد بالأشهر">
                <input name="months" type="number" min={1} max={60} defaultValue={1} className="field" />
              </Field>
            </div>
            <Submit className="btn btn-ghost">تمديد</Submit>
            <Status state={extendState} />
          </form>

          {isActive ? (
            <form action={end} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="immediately" value="1" />
              <ConfirmSubmit
                label="إنهاء الاشتراك الآن"
                className="btn btn-danger !px-3.5 !py-2 !text-[13px]"
                title="إنهاء الاشتراك فورًا؟"
                body="سيعود الحساب إلى حدود الخطة المجانية مباشرة، وتظهر شارة ديزاينكم في صفحته."
                confirmLabel="إنهاء الاشتراك"
              />
              <Status state={endState} />
            </form>
          ) : (
            <form action={reactivate} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="userId" value={userId} />
              <Submit className="btn btn-ghost">إعادة تفعيل آخر اشتراك</Submit>
              <Status state={reactivateState} />
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function PasswordResetControl({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetCustomerPasswordAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <Field label="كلمة مرور جديدة" hint="ستُنهى كل جلسات العميل النشطة فورًا.">
        <input name="password" className="field" dir="ltr" minLength={8} required autoComplete="new-password" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Submit className="btn btn-ghost">تعيين كلمة المرور</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}

export function DeleteCustomerControl({ userId, email }: { userId: string; email: string }) {
  const [state, action] = useActionState(deleteCustomerAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="confirm" value={email} />
      <Field label="سبب الحذف">
        <input name="reason" className="field" placeholder="طلب العميل حذف بياناته…" />
      </Field>
      <p className="text-[12px] leading-relaxed text-mist-500">
        يحذف الحساب والمعرض وكل الأعمال والصور والتذاكر والبلاغات المرتبطة به. لا يمكن التراجع.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmSubmit
          label="حذف الحساب نهائيًا"
          icon={<Trash className="h-4 w-4" />}
          title="حذف هذا الحساب نهائيًا؟"
          body={`سيُمحى ${email} وكل ما يتعلق به من المنصة. هذا الإجراء لا يمكن التراجع عنه.`}
          confirmLabel="حذف نهائي"
          requireText={email}
        />
        <Status state={state} />
      </div>
    </form>
  );
}
