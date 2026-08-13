import "server-only";
import { jazzcash } from "./jazzcash";
import { easypaisa } from "./easypaisa";
import type { GatewayName, PaymentDriver } from "./gateway";

const DRIVERS: Record<GatewayName, PaymentDriver> = { jazzcash, easypaisa };

export function getDriver(name: GatewayName): PaymentDriver {
  return DRIVERS[name];
}

export function availableGateways(): GatewayName[] {
  return (Object.keys(DRIVERS) as GatewayName[]).filter((n) =>
    DRIVERS[n].isConfigured(),
  );
}

export * from "./gateway";
