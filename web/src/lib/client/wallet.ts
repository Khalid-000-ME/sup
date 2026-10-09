"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Canton wallet connection (CIP-103) through the official dApp SDK.
 *
 * The SDK opens its own wallet picker (browser-extension wallets, remote wallet
 * gateways, WalletConnect). What we keep is the connected party, so the app can show
 * who is signed in. The SDK is imported lazily so it never runs during server rendering.
 */
export interface WalletAccount {
  partyId: string;
  networkId?: string;
  hint?: string;
}

const KEY = "sup.wallet";
let current: WalletAccount | null = null;
let restored = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
function set(next: WalletAccount | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the session just will not persist */
  }
  emit();
}

async function sdk() {
  return import("@canton-network/dapp-sdk");
}

async function primaryAccount(): Promise<WalletAccount | null> {
  const s = await sdk();
  const accounts = await s.listAccounts();
  const a = accounts.find((x) => x.primary) ?? accounts[0];
  return a ? { partyId: a.partyId, networkId: a.networkId, hint: a.hint } : null;
}

/** Opens the SDK's wallet picker and resolves with the connected party. */
export async function connectWallet(): Promise<WalletAccount> {
  const s = await sdk();
  const res = await s.connect();
  if (!res.isConnected) throw new Error("The wallet did not connect.");
  const account = await primaryAccount();
  if (!account) throw new Error("The wallet connected but has no account to use.");
  set(account);
  return account;
}

export async function disconnectWallet(): Promise<void> {
  try {
    await (await sdk()).disconnect();
  } finally {
    set(null);
  }
}

/** Restores a previous session without opening the picker. */
async function restore() {
  if (restored) return;
  restored = true;
  try {
    const s = await sdk();
    await s.init();
    if (await s.isConnected()) {
      const account = await primaryAccount();
      if (account) set(account);
    }
  } catch {
    /* no wallet to restore */
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useWallet(): WalletAccount | null {
  const account = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    void restore();
  }, []);
  return account;
}

export const shortParty = (p: string) => {
  const [name, fp] = p.split("::");
  return fp ? `${name}::${fp.slice(0, 6)}…${fp.slice(-4)}` : p.length > 20 ? `${p.slice(0, 10)}…${p.slice(-6)}` : p;
};
