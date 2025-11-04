import { FailedCallsTable } from "@/components/call-logs/FailedCallsTable";

export default function FailedCallsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Failed Calls</h1>
        <p className="text-muted-foreground">
          Manage and retry calls that were not answered or failed
        </p>
      </div>
      <FailedCallsTable />
    </div>
  );
}
