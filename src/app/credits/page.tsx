import type { Metadata } from "next";
import { CreditsList } from "@/components/settings/CreditsList";

export const metadata: Metadata = { title: "Crédits photo" };

export default function CreditsPage() {
  return <CreditsList />;
}
