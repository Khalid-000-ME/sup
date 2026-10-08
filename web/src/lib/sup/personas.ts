export type SupRole = "assetIssuer" | "cashIssuer" | "seller" | "buyer" | "agent" | "auditor" | "outsider";

export interface SupPersona {
  id: SupRole;
  /** Party name to create in the DevNet Console (namespace prefix is added by the node). */
  name: string;
  label: string;
  role: string;
  blurb: string;
  color: string;
}

export const SUP_PERSONAS: Record<SupRole, SupPersona> = {
  seller: {
    id: "seller",
    name: "sup-seller",
    label: "Seller",
    role: "Seller",
    blurb: "Holds the tokenized asset and sells it at private terms.",
    color: "#3987e5",
  },
  buyer: {
    id: "buyer",
    name: "sup-buyer",
    label: "Buyer",
    role: "Buyer",
    blurb: "Pays cash against delivery of the asset.",
    color: "#199e70",
  },
  agent: {
    id: "agent",
    name: "sup-agent",
    label: "Agent",
    role: "Settlement agent",
    blurb: "Verifies the document reference. Sees nothing else.",
    color: "#c98500",
  },
  auditor: {
    id: "auditor",
    name: "sup-auditor",
    label: "Auditor",
    role: "Auditor",
    blurb: "Opt-in observer of trade terms and receipts.",
    color: "#9085e9",
  },
  assetIssuer: {
    id: "assetIssuer",
    name: "sup-asset-issuer",
    label: "Bond registry",
    role: "Asset issuer",
    blurb: "Issues the tokenized asset and co-signs its custody.",
    color: "#8a94a6",
  },
  cashIssuer: {
    id: "cashIssuer",
    name: "sup-cash-issuer",
    label: "Cash issuer",
    role: "Cash issuer",
    blurb: "Issues the payment token and co-signs its custody.",
    color: "#6b7b94",
  },
  outsider: {
    id: "outsider",
    name: "sup-outsider",
    label: "Outsider",
    role: "Unrelated party",
    blurb: "Another participant on the network. Sees nothing.",
    color: "#e66767",
  },
};

export const SUP_ORDER: SupRole[] = [
  "seller",
  "buyer",
  "agent",
  "auditor",
  "assetIssuer",
  "cashIssuer",
  "outsider",
];

/** Roles that hold a custody account (can lock a leg). */
export const CUSTODY_ROLES: SupRole[] = ["seller", "buyer"];

export function isSupRole(v: unknown): v is SupRole {
  return typeof v === "string" && v in SUP_PERSONAS;
}

export const ASSET_CLASS = "BOND-2031";
export const ASSET_SYMBOL = "BOND";
export const CASH_CURRENCY = "CashUSD";
