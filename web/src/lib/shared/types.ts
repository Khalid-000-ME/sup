export interface PartyRef {
  party: string;
  name: string;
}

export interface TxEvent {
  kind: "created" | "exercised" | "archived";
  template: string;
  contractId: string;
  choice?: string;
  consuming?: boolean;
  actingParties?: PartyRef[];
  signatories?: PartyRef[];
  observers?: PartyRef[];
  payload?: Record<string, unknown>;
  depth: number;
}

export interface TxView {
  updateId: string;
  offset: number;
  effectiveAt: number;
  viewer: string;
  events: TxEvent[];
  eventCount: number;
}
