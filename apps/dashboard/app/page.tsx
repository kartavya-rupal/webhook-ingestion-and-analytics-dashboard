import Link from 'next/link';
import {
  getDashboardOverview,
} from '@/lib/api';
import {
  formatCount,
  formatDateTime,
  formatRelativeTime,
  formatStatusLabel,
  isFailureStatus,
  isSuccessStatus,
} from '@/lib/format';
import { DashboardShell } from '@/components/DashboardShell';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-sm text-zinc-400">{hint}</p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TenantPickerGrid({
  tenants,
}: {
  tenants: Array<{
    id: string;
    name: string;
    status: string;
    endpointCount: number;
    eventCount: number;
    latestEvent: { receivedAt: string; status: string; eventType: string } | null;
  }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tenants.map((tenant) => (
        <div key={tenant.id} className="rounded-3xl border border-white/10 bg-white/5 p-5" >
          <p className="text-lg font-semibold text-white">{tenant.name}</p>
          <p className="mt-1 text-sm text-zinc-400">{tenant.id}</p>
          <div className="mt-4 space-y-2 text-sm text-zinc-300">
            <div className="flex justify-between">
              <span>Endpoints</span>
              <span>{formatCount(tenant.endpointCount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Events</span>
              <span>{formatCount(tenant.eventCount)}</span>
            </div>
          </div>

          <form action="/api/context/tenant" method="post" className="mt-4">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="next" value="/" />
            <button className="rounded-full bg-white px-4 py-2 text-sm text-black">
              Select tenant
            </button>
          </form>
        </div>
      ))}
    </div>
  );

}

export default async function HomePage() {
  const overview = await getDashboardOverview();

  if (!overview.activeTenant || !overview.summary) {
    return (
      <DashboardShell
        title="Overview"
        description="Select a tenant to drill down into its webhook activity."
        tenantLabel="All tenants"
      >
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-lg font-semibold text-white">
            Choose a tenant
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Admin can drill down into any tenant. Operators and viewers stay locked to their own tenant.
          </p>

          <div className="mt-6">
            <TenantPickerGrid tenants={overview.tenants} />
          </div>
        </div>
      </DashboardShell>
    );
  }

  const { activeTenant, summary, endpoints, recentEvents, recentFailures } =
    overview;

  const activeEndpoints = endpoints.filter((endpoint) => endpoint.status === 'active');

  const quickLatestEvent = summary.latestEvent;

  return (
    <DashboardShell
      title={`${activeTenant.name} overview`}
      description="A compact operational view of the current tenant. It highlights event volume, delivery health, and the latest activity in the pipeline."
      tenantLabel={activeTenant.name}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Total events"
          value={formatCount(summary.totalEvents)}
          hint="All tracked webhook events"
        />
        <StatCard
          label="Succeeded"
          value={formatCount(summary.succeededEvents)}
          hint="Events that completed successfully"
        />
        <StatCard
          label="Retryable failures"
          value={formatCount(summary.retryableFailures)}
          hint="Events currently in retry flow"
        />
        <StatCard
          label="DLQ items"
          value={formatCount(summary.dlqEvents)}
          hint="Events moved to dead-letter queue"
        />
        <StatCard
          label="Active endpoints"
          value={formatCount(summary.endpointCount)}
          hint="Enabled provider endpoints"
        />
        <StatCard
          label="Latest activity"
          value={quickLatestEvent ? formatRelativeTime(quickLatestEvent.receivedAt) : '—'}
          hint={quickLatestEvent ? quickLatestEvent.eventType : 'No activity yet'}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.9fr_0.8fr]">
        <Section
          title="Recent activity"
          description="The latest events in the current tenant."
        >
          {recentEvents.length > 0 ? (
            <div className="space-y-3">
              {recentEvents.slice(0, 8).map((event) => {
                const statusTone = isSuccessStatus(event.status)
                  ? 'text-emerald-300'
                  : isFailureStatus(event.status)
                    ? 'text-amber-300'
                    : 'text-zinc-300';

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block rounded-2xl border border-white/10 bg-zinc-950/60 p-4 transition hover:border-white/20 hover:bg-zinc-900/80"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {event.eventType}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {event.id} · {event.externalEventId ?? 'no external id'}
                        </p>
                      </div>
                      <p className={`text-xs font-medium ${statusTone}`}>
                        {formatStatusLabel(event.status)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
                      <span>{event.providerSlug}</span>
                      <span>{formatRelativeTime(event.receivedAt)}</span>
                      <span>{event.replayCount} replays</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              No recent events for this tenant yet.
            </p>
          )}
        </Section>

        <Section
          title="Recent failures"
          description="Temporary failures, terminal failures, and DLQ activity."
        >
          {recentFailures.length > 0 ? (
            <div className="space-y-3">
              {recentFailures.slice(0, 6).map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-2xl border border-white/10 bg-zinc-950/60 p-4 transition hover:border-white/20 hover:bg-zinc-900/80"
                >
                  <p className="text-sm font-medium text-white">
                    {event.eventType}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatStatusLabel(event.status)} · {event.providerSlug}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {formatRelativeTime(event.receivedAt)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              No failures recorded for this tenant yet.
            </p>
          )}
        </Section>

        <Section
          title="Endpoint health"
          description="A simple view of provider-level activity."
        >
          {endpoints.length > 0 ? (
            <div className="space-y-3">
              {endpoints.map((endpoint) => {
                const isActive = endpoint.status === 'active';

                return (
                  <Link
                    key={endpoint.id}
                    href={`/endpoints/${endpoint.id}`}
                    className="block rounded-2xl border border-white/10 bg-zinc-950/60 p-4 transition hover:border-white/20 hover:bg-zinc-900/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {endpoint.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {endpoint.providerSlug}
                        </p>
                      </div>
                      <p
                        className={[
                          'text-xs font-medium',
                          isActive ? 'text-emerald-300' : 'text-zinc-300',
                        ].join(' ')}
                      >
                        {formatStatusLabel(endpoint.status)}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
                      <span>{formatCount(endpoint.eventCount)} events</span>
                      <span>{formatCount(endpoint.failureCount)} failures</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              No endpoints found for this tenant yet.
            </p>
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Section
          title="Quick links"
          description="Jump directly into the main investigation views."
        >
          <div className="flex flex-col gap-3">
            <Link
              href="/events"
              className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-zinc-900/80"
            >
              Open event list
            </Link>
            <Link
              href="/dlq"
              className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-zinc-900/80"
            >
              Inspect DLQ
            </Link>
            <Link
              href="/replay-jobs"
              className="rounded-2xl border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-zinc-900/80"
            >
              View replay jobs
            </Link>
          </div>
        </Section>

        <Section
          title="Tenant snapshot"
          description="A quick read of the selected tenant."
        >
          <div className="space-y-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between gap-3">
              <span>Status</span>
              <span>{formatStatusLabel(activeTenant.status)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Created</span>
              <span>{formatDateTime(activeTenant.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Updated</span>
              <span>{formatRelativeTime(activeTenant.updatedAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Active endpoints</span>
              <span>{formatCount(activeEndpoints.length)}</span>
            </div>
          </div>
        </Section>

        <Section
          title="Latest event"
          description="The most recent event summary for this tenant."
        >
          {quickLatestEvent ? (
            <div className="space-y-3 text-sm text-zinc-300">
              <div className="flex items-center justify-between gap-3">
                <span>Type</span>
                <span>{quickLatestEvent.eventType}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span>{formatStatusLabel(quickLatestEvent.status)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Received</span>
                <span>{formatDateTime(quickLatestEvent.receivedAt)}</span>
              </div>
              <div className="pt-2">
                <Link
                  href="/events"
                  className="text-sm font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                >
                  Go to event list
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No events yet.</p>
          )}
        </Section>
      </div>
    </DashboardShell>
  );
}