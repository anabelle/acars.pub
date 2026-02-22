import { createRootRoute, Outlet } from '@tanstack/react-router';
// import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import React, { Suspense } from 'react';

const TanStackRouterDevtools =
    process.env.NODE_ENV === 'production'
        ? () => null
        : React.lazy(() =>
            import('@tanstack/router-devtools').then((res) => ({
                default: res.TanStackRouterDevtools,
            })),
        );

export const Route = createRootRoute({
    component: () => (
        <>
            <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
                <Outlet />
            </div>
            <Suspense fallback={null}>
                <TanStackRouterDevtools />
            </Suspense>
        </>
    ),
});
