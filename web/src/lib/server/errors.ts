import type { Transaction } from "./ledger";

/** A failure caused by the caller's input, reported to the client as a 400. */
export class UserError extends Error {}

/** Events of a transaction with their nesting depth. */
export function withDepth(tx: Transaction): { ev: Transaction["events"][number]; depth: number }[] {
  const stack: number[] = [];
  const out: { ev: Transaction["events"][number]; depth: number }[] = [];
  for (const ev of tx.events) {
    const inner = "CreatedEvent" in ev ? ev.CreatedEvent : "ExercisedEvent" in ev ? ev.ExercisedEvent : ev.ArchivedEvent;
    while (stack.length && stack[stack.length - 1] < inner.nodeId) stack.pop();
    out.push({ ev, depth: stack.length });
    if ("ExercisedEvent" in ev) stack.push(ev.ExercisedEvent.lastDescendantNodeId);
  }
  return out;
}
