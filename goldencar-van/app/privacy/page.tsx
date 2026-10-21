import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { legal } from "@/content/policies";

export const metadata: Metadata = { title: "개인정보처리방침", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return <LegalPage title="개인정보처리방침" body={legal.privacy} />;
}
