"use client";

import { useActionState, useMemo, useState } from "react";
import { submitEnquiryAction, type EnquiryState } from "@/lib/services/actions";
import { calculateEmi } from "@/lib/services/emi";
import { formatPkr, formatPkrExact } from "@/lib/format";

/** Illustrative. Real rates come from the bank, and the copy says so. */
const DEFAULT_RATE = 21;

export function FinanceCalculator({
  cities,
}: {
  cities: { id: number; name: string }[];
}) {
  const [price, setPrice] = useState(4_800_000);
  const [downPct, setDownPct] = useState(30);
  const [months, setMonths] = useState(60);
  const [rate, setRate] = useState(DEFAULT_RATE);

  const [state, action, pending] = useActionState<EnquiryState, FormData>(
    submitEnquiryAction,
    {},
  );

  const down = Math.round((price * downPct) / 100);
  const principal = Math.max(0, price - down);
  const emi = useMemo(
    () => calculateEmi(principal, rate, months),
    [principal, rate, months],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Slider
            label="Car price"
            value={price}
            display={formatPkr(price)}
            min={300_000}
            max={30_000_000}
            step={50_000}
            onChange={setPrice}
          />
          <Slider
            label="Down payment"
            value={downPct}
            display={`${downPct}% · ${formatPkr(down)}`}
            min={10}
            max={80}
            step={5}
            onChange={setDownPct}
          />
          <Slider
            label="Tenure"
            value={months}
            display={`${months} months`}
            min={12}
            max={84}
            step={12}
            onChange={setMonths}
          />
          <Slider
            label="Markup rate"
            value={rate}
            display={`${rate}% flat`}
            min={8}
            max={35}
            step={1}
            onChange={setRate}
          />
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-500">Monthly instalment</p>
          <p className="text-3xl font-bold text-slate-900">
            {formatPkrExact(emi.monthlyPkr)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Financing {formatPkr(principal)} over {months} months · total
            payable {formatPkr(emi.totalPkr)} (markup{" "}
            {formatPkr(emi.totalInterestPkr)})
          </p>
        </div>
      </section>

      {state.ok ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5">
          <p className="font-medium text-emerald-900">Request received</p>
          <p className="mt-1 text-sm text-emerald-900">
            Partner banks will call you on the number you gave, usually within
            a working day.
          </p>
        </div>
      ) : (
        <form action={action} className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Get real offers
          </h2>
          <p className="mb-4 mt-0.5 text-sm text-slate-600">
            We&apos;ll pass these figures to partner banks. No fee, no
            obligation.
          </p>

          <input type="hidden" name="type" value="finance" />
          <input type="hidden" name="amountPkr" value={principal} />
          <input type="hidden" name="tenureMonths" value={months} />
          <input type="hidden" name="downPaymentPkr" value={down} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Your name" error={state.fieldErrors?.name}>
              <input name="name" required className={input} />
            </Field>
            <Field label="Mobile number" error={state.fieldErrors?.phone}>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                placeholder="0300 1234567"
                className={input}
              />
            </Field>
            <Field label="City">
              <select name="cityId" className={input} defaultValue="">
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {state.error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-4 w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Request finance offers"}
          </button>
        </form>
      )}
    </div>
  );
}

const input =
  "w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900";

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm text-slate-900">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-blue-600"
        aria-label={label}
      />
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
