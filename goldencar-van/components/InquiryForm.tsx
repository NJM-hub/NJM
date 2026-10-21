"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KakaoButton, PhoneButton } from "@/components/ContactButtons";
import { SELECT_VEHICLE_EVENT } from "@/components/SelectVehicleLink";
import { inquiryPrivacy } from "@/content/policies";
import { kakaoHref, phoneHref } from "@/lib/contact";
import {
  emptyInquiry,
  purposes,
  rentalDays,
  summarizeInquiry,
  todayKst,
  validateInquiry,
  vehicleOptions,
  type InquiryErrors,
  type InquiryField,
  type InquiryInput,
} from "@/lib/inquiry";

const hasDirectContact = Boolean(phoneHref() || kakaoHref());
const noContactText = "전화·카카오톡 연락처는 준비 중입니다. 잠시 후 다시 시도해 주세요.";

const noopSubscribe = () => () => {};

type Stage = "edit" | "review" | "sending" | "sent" | "unavailable" | "error";

const fieldOrder: InquiryField[] = ["name", "phone", "vehicle", "startDate", "endDate", "purpose", "notes", "consent"];

export default function InquiryForm() {
  const [form, setForm] = useState<InquiryInput>(emptyInquiry);
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [stage, setStage] = useState<Stage>("edit");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // 차량 카드의 '렌트 문의' 버튼 → 해당 차량 자동 선택
  useEffect(() => {
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setForm((f) => ({ ...f, vehicle: id }));
      setErrors((er) => ({ ...er, vehicle: undefined }));
      setStage((s) => (s === "sent" ? s : "edit"));
    };
    window.addEventListener(SELECT_VEHICLE_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_VEHICLE_EVENT, onSelect);
  }, []);

  const set = <K extends InquiryField>(key: K, value: InquiryInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const onReview = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateInquiry(form);
    setErrors(found);
    const first = fieldOrder.find((k) => found[k]);
    if (first) {
      document.getElementById(`inq-${first}`)?.focus();
      return;
    }
    setStage("review");
    scrollTop();
  };

  const onSend = async () => {
    setStage("sending");
    setMessage("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, website: honeypot.current?.value ?? "" }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; code?: string; message?: string; errors?: InquiryErrors }
        | null;
      if (res.ok && data?.ok) {
        setStage("sent");
      } else if (data?.code === "not_configured") {
        setStage("unavailable");
      } else if (data?.code === "invalid" && data.errors) {
        setErrors(data.errors);
        setMessage(data.message ?? "입력 내용을 다시 확인해 주세요.");
        setStage("edit");
      } else {
        setMessage(data?.message ?? "문의를 보내는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.");
        setStage("error");
      }
    } catch {
      setMessage("인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
      setStage("error");
    }
    scrollTop();
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summarizeInquiry(form));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const reset = () => {
    setForm(emptyInquiry);
    setErrors({});
    setMessage("");
    setStage("edit");
  };

  const days = rentalDays(form.startDate, form.endDate);
  // 미리 만들어 둔 페이지라 '오늘'은 방문자 브라우저에서 계산 (서버 렌더 때는 빈 값)
  const today = useSyncExternalStore(noopSubscribe, todayKst, () => "");
  const vehicleLabel = vehicleOptions.find((v) => v.id === form.vehicle)?.label ?? "";

  return (
    <div ref={topRef} className="scroll-mt-24">
      {stage === "sent" && (
        <Notice tone="success" title="예약 문의가 접수되었습니다">
          <p>담당자가 확인 후 입력하신 연락처({form.phone})로 연락드립니다.</p>
          <p className="mt-1 text-sm">아직 예약이 확정된 것은 아니며, 상담 후 확정됩니다.</p>
          <button type="button" className="btn-outline-dark mt-5" onClick={reset}>
            새 문의 작성
          </button>
        </Notice>
      )}

      {stage === "unavailable" && (
        <Notice tone="warn" title="온라인 접수가 아직 준비 중입니다">
          <p>문의가 접수되지 않았습니다. 아래 내용을 복사해 전화나 카카오톡으로 보내 주시면 안내해 드립니다.</p>
          {!hasDirectContact && <p className="mt-1">{noContactText}</p>}
          <SummaryBox form={form} />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className="btn-dark" onClick={copySummary}>
              {copied ? "복사했습니다" : "문의 내용 복사"}
            </button>
            <KakaoButton hideIfMissing />
            <PhoneButton hideIfMissing />
          </div>
        </Notice>
      )}

      {stage === "error" && (
        <Notice tone="error" title="문의를 보내지 못했습니다">
          <p>{message}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className="btn-dark" onClick={onSend}>
              다시 보내기
            </button>
            <button type="button" className="btn-outline-dark" onClick={() => setStage("edit")}>
              내용 수정
            </button>
            <PhoneButton hideIfMissing />
          </div>
        </Notice>
      )}

      {(stage === "review" || stage === "sending") && (
        <div className="rounded-3xl border border-gold-300 bg-gold-50 p-6 sm:p-8">
          <h3 className="text-lg font-bold">입력하신 내용을 확인해 주세요</h3>
          <SummaryBox form={form} />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-gold" onClick={onSend} disabled={stage === "sending"}>
              {stage === "sending" ? "보내는 중…" : "이대로 문의 보내기"}
            </button>
            <button type="button" className="btn-outline-dark" onClick={() => setStage("edit")} disabled={stage === "sending"}>
              수정하기
            </button>
          </div>
        </div>
      )}

      {stage === "edit" && (
        <form noValidate onSubmit={onReview} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          {message && (
            <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </p>
          )}

          {/* 스팸 방지 (사람에게는 보이지 않음) */}
          <div className="hidden" aria-hidden="true">
            <label>
              웹사이트
              <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <fieldset>
            <legend className="field-label">렌트 희망 차량 *</legend>
            <div className="grid grid-cols-2 gap-3">
              {vehicleOptions.map((v, i) => (
                <label
                  key={v.id}
                  className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border px-3 text-center font-semibold transition ${
                    form.vehicle === v.id
                      ? "border-gold-500 bg-gold-50 text-ink-900 ring-2 ring-gold-200"
                      : "border-neutral-300 text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  <input
                    id={i === 0 ? "inq-vehicle" : undefined}
                    type="radio"
                    name="vehicle"
                    value={v.id}
                    checked={form.vehicle === v.id}
                    onChange={() => set("vehicle", v.id)}
                    className="sr-only"
                  />
                  {v.label}
                </label>
              ))}
            </div>
            <FieldError msg={errors.vehicle} />
          </fieldset>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field id="name" label="이름 *" error={errors.name}>
              <input
                id="inq-name"
                className={`field ${errors.name ? "field-error" : ""}`}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="name"
                maxLength={30}
                aria-invalid={!!errors.name}
              />
            </Field>
            <Field id="phone" label="연락처 *" error={errors.phone}>
              <input
                id="inq-phone"
                type="tel"
                inputMode="tel"
                className={`field ${errors.phone ? "field-error" : ""}`}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
                placeholder="010-1234-5678"
                aria-invalid={!!errors.phone}
              />
            </Field>
            <Field id="startDate" label="대여 시작일 *" error={errors.startDate}>
              <input
                id="inq-startDate"
                type="date"
                min={today || undefined}
                className={`field ${errors.startDate ? "field-error" : ""}`}
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                aria-invalid={!!errors.startDate}
              />
            </Field>
            <Field id="endDate" label="반납 예정일 *" error={errors.endDate}>
              <input
                id="inq-endDate"
                type="date"
                min={form.startDate || today || undefined}
                className={`field ${errors.endDate ? "field-error" : ""}`}
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                aria-invalid={!!errors.endDate}
              />
            </Field>
          </div>
          {days && vehicleLabel && (
            <p className="mt-3 text-sm text-neutral-600">
              {vehicleLabel} · {days}일 이용 문의
            </p>
          )}

          <div className="mt-5">
            <Field id="purpose" label="이용 목적 *" error={errors.purpose}>
              <select
                id="inq-purpose"
                className={`field ${errors.purpose ? "field-error" : ""}`}
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
                aria-invalid={!!errors.purpose}
              >
                <option value="">선택해 주세요</option>
                {purposes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <Field id="notes" label="추가 요청사항" error={errors.notes}>
              <textarea
                id="inq-notes"
                rows={4}
                maxLength={1000}
                className={`field ${errors.notes ? "field-error" : ""}`}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="인원, 인수 희망 장소·시간 등 알려 주실 내용을 적어 주세요."
              />
            </Field>
          </div>

          <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
            <p className="font-semibold text-neutral-800">개인정보 수집·이용 안내</p>
            <ul className="mt-2 space-y-0.5">
              <li>수집 항목: {inquiryPrivacy.items}</li>
              <li>이용 목적: {inquiryPrivacy.purpose}</li>
              <li>보유 기간: {inquiryPrivacy.retention || "개인정보처리방침에 따름"}</li>
            </ul>
            <p className="mt-2">동의하지 않을 수 있으며, 동의하지 않으면 온라인 문의를 보낼 수 없습니다.</p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 font-medium text-neutral-800">
              <input
                id="inq-consent"
                type="checkbox"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-gold-500"
                aria-invalid={!!errors.consent}
              />
              개인정보 수집·이용에 동의합니다. (필수)
            </label>
            <FieldError msg={errors.consent} />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="submit" className="btn-gold sm:min-w-48">
              예약 문의하기
            </button>
            <PhoneButton hideIfMissing />
            <KakaoButton hideIfMissing />
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={`inq-${id}`} className="field-label">
        {label}
      </label>
      {children}
      <FieldError msg={error} />
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? (
    <p className="error-text" role="alert">
      {msg}
    </p>
  ) : null;
}

function SummaryBox({ form }: { form: InquiryInput }) {
  const vehicle = vehicleOptions.find((v) => v.id === form.vehicle)?.label ?? "";
  const days = rentalDays(form.startDate, form.endDate);
  const rows: [string, string][] = [
    ["이름", form.name.trim()],
    ["연락처", form.phone.trim()],
    ["차량", vehicle],
    ["기간", `${form.startDate} ~ ${form.endDate}${days ? ` (${days}일)` : ""}`],
    ["이용 목적", form.purpose],
    ["요청사항", form.notes.trim() || "없음"],
  ];
  return (
    <dl className="mt-4 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[6rem_1fr] gap-3 px-4 py-3">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="break-words whitespace-pre-line text-ink-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Notice({ tone, title, children }: { tone: "success" | "warn" | "error"; title: string; children: React.ReactNode }) {
  const cls = {
    success: "border-emerald-300 bg-emerald-50",
    warn: "border-gold-300 bg-gold-50",
    error: "border-red-300 bg-red-50",
  }[tone];
  return (
    <div role="status" className={`rounded-3xl border p-6 sm:p-8 ${cls}`}>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-2 text-neutral-700">{children}</div>
    </div>
  );
}
