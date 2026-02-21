import NDK from '@nostr-dev-kit/ndk';

const defaultRelays = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://purplepag.es',
];

let globalNDK: NDK | null = null;

export function getNDK(): NDK {
    if (!globalNDK) {
        globalNDK = new NDK({
            explicitRelayUrls: defaultRelays,
            autoConnectUserRelays: true,
        });
    }
    return globalNDK;
}

export async function connectNDK(): Promise<void> {
    const ndk = getNDK();
    try {
        // Enforce a strict 2.5 second timeout so unresponsive relays don't hang the app
        await Promise.race([
            ndk.connect(2500),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2500))
        ]);
    } catch (e) {
        console.warn("NDK connection warning (some relays may have failed):", e);
    }
}
