import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { legal } from "@/content/policies";

export const metadata: Metadata = { title: "이용약관", alternates: { canonical: "/terms" } };

export default function Terms() {
  return <LegalPage title="이용약관" body={legal.terms} />;
}
