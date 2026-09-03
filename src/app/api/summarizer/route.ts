import { NextResponse } from "next/server";
import { allProviderHealth, configuredProviderId } from "@/lib/summarize";

export const dynamic = "force-dynamic";

/**
 * Reports which summariser is configured and whether it can actually be
 * reached, so the dashboard can show when it is running on the offline rules
 * engine instead of the LLM host.
 */
export async function GET() {
  const configured = configuredProviderId();
  const providers = await allProviderHealth();
  const active = providers.find((p) => p.id === configured);

  return NextResponse.json({
    configured,
    /** True when the configured provider is down and runs would degrade. */
    degraded: Boolean(active && !active.reachable),
    providers,
  });
}
