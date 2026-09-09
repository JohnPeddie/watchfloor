/**
 * Prints every URL the dashboard is reachable on from this machine.
 *
 * DHCP addresses change between networks, so a hardcoded URL goes stale.
 */
import { networkInterfaces } from "node:os";

const port = Number(process.env.WATCHFLOOR_PORT ?? process.env.PORT ?? 3050);

type Entry = { label: string; host: string; note: string };

/** Classifies an address so the output says which URL to prefer and why. */
function classify(iface: string, address: string): Entry | null {
  if (address.startsWith("127.") || address.startsWith("169.254.")) return null;

  const isCgnat = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address);
  if (isCgnat) {
    return { label: iface, host: address, note: "overlay / CGNAT" };
  }

  const isPrivate =
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address);
  if (!isPrivate) return null;

  const isOverlay = /zerotier|tailscale|docker|vethernet|wsl/i.test(iface);
  return {
    label: iface,
    host: address,
    note: isOverlay ? "overlay network" : "same LAN only",
  };
}

const entries: Entry[] = [];
for (const [iface, addresses] of Object.entries(networkInterfaces())) {
  for (const info of addresses ?? []) {
    if (info.family !== "IPv4" || info.internal) continue;
    const entry = classify(iface, info.address);
    if (entry) entries.push(entry);
  }
}

if (entries.length === 0) {
  console.log("No usable network address found — is Wi-Fi connected?");
} else {
  console.log(`Watchfloor on port ${port}:\n`);
  const width = Math.max(...entries.map((e) => e.label.length));
  for (const entry of entries) {
    console.log(
      `  ${entry.label.padEnd(width)}  http://${entry.host}:${port}  (${entry.note})`,
    );
  }
  console.log("\nOpen one of these on your phone or tablet.");
  console.log("Serve on all interfaces with: npm run dev:lan");
}
