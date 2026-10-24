import type { Metadata } from "next";
import { GarageScreen } from "@/components/garage/GarageScreen";

export const metadata: Metadata = { title: "Garage" };

export default function GaragePage() {
  return <GarageScreen />;
}
