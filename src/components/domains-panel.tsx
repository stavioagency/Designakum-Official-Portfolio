"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { DomainState } from "@/app/actions/domains";
import type { Dictionary } from "@/lib/i18n";
import type { Domain } from "@/lib/domains";
import { isApex, subdomainLabel } from "@/lib/dns-records";
import { Check, Globe, Trash, AlertTriangle, Clock } from "@/components/icons";

const STATUS = {
  active: { key: "statusActive", Icon: Check, tone: "text-emerald-300 bg-emerald-400/12" },
  pending: { key: "statusPending", Icon: Clock, tone: "text-amber-300 bg-amber-400/12" },
  failed: { key: "statusFailed", Icon: AlertTriangle, tone: "text-rose-300 bg-rose-500/12" },
} as const;

function Submit({ label, pending: pendingLabel, className = "btn btn-ghost" }: {
  label: string;
  pending: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function Notice({ state }: { state: DomainState }) {
  if (!state?.error && !state?.ok) return null;
  const good = Boolean(state.ok);
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-[13px] ${
        good
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-rose-500/30 bg-rose-500/10 text-rose-200"
      }`}
    >
      {state.ok ?? state.error}
    </p>
  );
}

export function DomainsPanel({
  domains,
  copy,
  target,
  addresses,
  txtRecord,
  paid,
  actions,
}: {
  domains: Domain[];
  copy: Dictionary["domains"];
  /** What the customer points their CNAME at. */
  target: string;
  /** The platform's own A records, for a customer pointing a root domain here. */
  addresses: string[];
  txtRecord: string;
  paid: boolean;
  actions: {
    add: (prev: DomainState, fd: FormData) => Promise<DomainState>;
    check: (prev: DomainState, fd: FormData) => Promise<DomainState>;
    remove: (prev: DomainState, fd: FormData) => Promise<DomainState>;
  };
}) {
  const [addState, addAction] = useActionState(actions.add, null);
  const [rowState, rowAction] = useActionState(actions.check, null);
  const [removeState, removeActionState] = useActionState(actions.remove, null);

  return (
    <div className="space-y-6">
      {!paid && (
        <p className="panel flex items-start gap-3 px-4 py-3 text-[13px] text-mist-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          {copy.needsPlan}
        </p>
      )}

      <form action={addAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="hostname">{copy.add}</label>
          <input
            id="hostname"
            name="hostname"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            className="field"
            placeholder={copy.placeholder}
            disabled={!paid}
            required
          />
        </div>
        <Submit label={copy.add} pending={copy.checking} className="btn btn-primary" />
      </form>
      <p className="-mt-3 text-[11.5px] text-mist-500">{copy.hint}</p>

      <Notice state={addState} />
      <Notice state={rowState} />
      <Notice state={removeState} />

      {domains.length === 0 ? (
        <p className="text-[13.5px] text-mist-500">{copy.empty}</p>
      ) : (
        <ul className="space-y-4">
          {domains.map((domain) => {
            const status = STATUS[domain.status] ?? STATUS.pending;
            return (
              <li key={domain.id} className="card-tight border border-white/8 bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 font-semibold" dir="ltr">
                    <Globe className="h-4 w-4 text-mist-500" />
                    {domain.hostname}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${status.tone}`}
                  >
                    <status.Icon className="h-3.5 w-3.5" />
                    {copy[status.key]}
                  </span>
                </div>

                {domain.status !== "active" && (
                  <>
                    <p className="mt-4 text-[12.5px] text-mist-400">{copy.records}</p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[430px] text-left text-[12px]" dir="ltr">
                        <thead className="text-mist-500">
                          <tr>
                            <th className="pb-1.5 pr-3 font-medium">{copy.type}</th>
                            <th className="pb-1.5 pr-3 font-medium">{copy.name}</th>
                            <th className="pb-1.5 font-medium">{copy.value}</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono text-mist-300">
                          {/*
                            A root domain gets an A record and a subdomain gets
                            a CNAME, and the difference is not a preference. The
                            zone apex has to carry its own SOA and NS records,
                            and a CNAME cannot sit beside anything, so a
                            registrar refuses to create "CNAME @" at all. This
                            panel used to ask for exactly that, which meant
                            nobody with a root domain could follow it.
                          */}
                          {isApex(domain.hostname) ? (
                            addresses.length > 0 ? (
                              addresses.map((address) => (
                                <tr key={address}>
                                  <td className="pr-3">A</td>
                                  <td className="pr-3">@</td>
                                  <td className="break-all">{address}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td className="pr-3">A</td>
                                <td className="pr-3">@</td>
                                <td className="break-all text-mist-500">{copy.addressUnknown}</td>
                              </tr>
                            )
                          ) : (
                            <tr>
                              <td className="pr-3">CNAME</td>
                              <td className="pr-3">{subdomainLabel(domain.hostname)}</td>
                              <td className="break-all">{target}</td>
                            </tr>
                          )}
                          <tr>
                            <td className="pr-3">TXT</td>
                            <td className="pr-3">{txtRecord}</td>
                            <td className="break-all">{domain.verify_token}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[11.5px] text-mist-500">{copy.propagation}</p>
                  </>
                )}

                {domain.status === "active" && (
                  <p className="mt-3 text-[12px] text-mist-500">{copy.tls}</p>
                )}

                {domain.last_error && domain.status === "failed" && (
                  <p className="mt-3 text-[12px] text-rose-300">{domain.last_error}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2.5">
                  {domain.status !== "active" && (
                    <form action={rowAction}>
                      <input type="hidden" name="id" value={domain.id} />
                      <Submit label={copy.check} pending={copy.checking} />
                    </form>
                  )}
                  <form
                    action={removeActionState}
                    onSubmit={(event) => {
                      if (!confirm(copy.removeConfirm)) event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={domain.id} />
                    <button type="submit" className="btn btn-danger">
                      <Trash className="h-4 w-4" />
                      {copy.remove}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
