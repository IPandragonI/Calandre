import type { Metadata } from "next";
import { StatsScreen } from "@/components/stats/StatsScreen";

export const metadata: Metadata = { title: "Statistiques" };

export default function StatsPage() {
  return <StatsScreen />;
}
