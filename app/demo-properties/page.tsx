import { notFound } from "next/navigation";
import { DemoProperties } from "@/components/demo-properties";

export const dynamic = "force-dynamic";
export const metadata = { title: "Property sandbox" };
export default function DemoPropertiesPage() {
  // This sandbox is never available on deployed production or preview builds.
  if (process.env.NODE_ENV !== "development") notFound();
  return <DemoProperties />;
}
