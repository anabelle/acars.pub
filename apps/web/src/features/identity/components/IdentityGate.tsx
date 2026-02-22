import { useAirlineStore } from '@airtr/store';
import { AirlineCreator } from './AirlineCreator';
import { Loader2 } from 'lucide-react';

export function IdentityGate({ children }: { children: React.ReactNode }) {
    const { identityStatus, airline, initializeIdentity, isLoading, error } = useAirlineStore();

    if (identityStatus === 'checking') {
        return (
            <div className="flex h-full w-full items-center justify-center pointer-events-auto">
                <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-border/50 bg-background/60 p-8 shadow-2xl backdrop-blur-xl">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Establishing secure connection to Nostr network...</p>
                </div>
            </div>
        );
    }

    if (identityStatus === 'no-extension') {
        return (
            <div className="flex h-full w-full items-center justify-center p-4 pointer-events-auto backdrop-blur-sm bg-background/40">
                <div className="max-w-md space-y-4 rounded-xl border border-border/50 bg-background/80 p-8 shadow-2xl backdrop-blur-xl">
                    <h2 className="text-2xl font-semibold tracking-tight">Identity Required</h2>
                    <p className="text-muted-foreground">
                        AirTR is a decentralized simulation. You must have a NIP-07 compatible wallet extension installed to access the network.
                    </p>
                    <div className="rounded-md bg-muted p-4 text-sm">
                        <p className="font-semibold text-foreground mb-2">Recommended Extensions:</p>
                        <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                            <li>nos2x</li>
                            <li>Alby</li>
                            <li>Nostr Connect</li>
                        </ul>
                    </div>
                    <button
                        onClick={initializeIdentity}
                        disabled={isLoading}
                        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isLoading ? 'Scanning...' : 'Retry Connection'}
                    </button>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            </div>
        );
    }

    // If we have an identity but no airline entity
    if (identityStatus === 'ready' && !airline) {
        return (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4 py-12 pointer-events-auto backdrop-blur-[2px] bg-background/20">
                <AirlineCreator />
            </div>
        );
    }

    // Success
    return <>{children}</>;
}
