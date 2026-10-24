import type { Metadata } from "next";
import { CategoryPicker } from "@/components/categories/CategoryPicker";

export const metadata: Metadata = { title: "Catégories" };

export default function CategoriesPage() {
  return <CategoryPicker />;
}
