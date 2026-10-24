import { Suspense } from "react";
import { CarDetailsScreen } from "@/components/garage/CarDetailsScreen";

/** Shareable car page: /garage/q1075802. The catalogue is loaded on the client. */
export default function CarPage({ params }: PageProps<"/garage/[id]">) {
  return (
    <Suspense>
      <CarPageContent params={params} />
    </Suspense>
  );
}

async function CarPageContent({ params }: { params: PageProps<"/garage/[id]">["params"] }) {
  const { id } = await params;
  return <CarDetailsScreen id={decodeURIComponent(id)} />;
}
