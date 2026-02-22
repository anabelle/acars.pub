import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
    component: Index,
});

function Index() {
    return (
        <div className="flex w-full flex-col items-center justify-center space-y-4 p-8">
            <h1 className="text-4xl font-bold tracking-tight text-primary">AirTR Terminal</h1>
            <p className="max-w-md text-center text-muted-foreground">
                Welcome to the bleeding-edge corporate layer. The Nostr node connection is established.
            </p>
            <div className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex animate-pulse space-x-4">
                    <div className="h-4 w-4 rounded-full bg-primary" />
                    <div className="font-mono text-sm">Engine Determinism: Verified</div>
                </div>
            </div>
        </div>
    );
}
