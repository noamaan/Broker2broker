import { LoadingState } from "@/components/dashboard-ui";

export default function DashboardLoading() {
  return <div aria-live="polite"><LoadingState label="Opening your workspace…"/></div>;
}
