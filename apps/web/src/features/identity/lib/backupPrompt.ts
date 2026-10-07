/**
 * When to ask a guest to keep their key (S26.3).
 *
 * Two moments, each shown once per account:
 * - "landing": the first time we see the airline has flown (it now has
 *   something to lose);
 * - "return": the first later visit (a new browser session), when the player
 *   has proven they come back.
 *
 * A player whose first landing happened while away gets the landing prompt
 * on that visit and the return prompt on the next one. Backing the key up
 * (copy or download) ends both, through `isEphemeralKeySecured`.
 */

export type BackupPromptMoment = "landing" | "return";

const SHOWN_PREFIX = "acars:backup-prompt:";
const SESSION_PREFIX = "acars:backup-prompt:session:";

export interface BackupPromptStorage {
  local: Pick<Storage, "getItem" | "setItem">;
  session: Pick<Storage, "getItem" | "setItem">;
}

const shownKey = (pubkey: string, moment: BackupPromptMoment) =>
  `${SHOWN_PREFIX}${moment}:${pubkey}`;

function read(store: Pick<Storage, "getItem">, key: string): boolean {
  try {
    return store.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(store: Pick<Storage, "setItem">, key: string): void {
  try {
    store.setItem(key, "1");
  } catch {
    // Storage blocked: the prompt may show again, which is harmless.
  }
}

/** Which prompt is due now, if any. Pure apart from reading storage. */
export function dueBackupPrompt(
  pubkey: string,
  { hasLanded, secured }: { hasLanded: boolean; secured: boolean },
  storage: BackupPromptStorage,
): BackupPromptMoment | null {
  if (secured || !hasLanded) return null;
  if (!read(storage.local, shownKey(pubkey, "landing"))) return "landing";
  // A session that already showed a prompt is the visit it belongs to.
  if (read(storage.session, `${SESSION_PREFIX}${pubkey}`)) return null;
  if (!read(storage.local, shownKey(pubkey, "return"))) return "return";
  return null;
}

/** Records that `moment` was shown in this browser session. */
export function markBackupPromptShown(
  pubkey: string,
  moment: BackupPromptMoment,
  storage: BackupPromptStorage,
): void {
  write(storage.local, shownKey(pubkey, moment));
  write(storage.session, `${SESSION_PREFIX}${pubkey}`);
}

/** The browser's storage, or null where it can't be reached. */
export function browserBackupPromptStorage(): BackupPromptStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return { local: window.localStorage, session: window.sessionStorage };
  } catch {
    return null;
  }
}
