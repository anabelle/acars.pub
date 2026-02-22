import { Link } from '@tanstack/react-router';
import { Home, Plane, Building2, Globe } from 'lucide-react';

const navItems = [
    { icon: Home, label: 'Overview', to: '/' },
    { icon: Plane, label: 'Fleet', to: '/fleet' },
    { icon: Globe, label: 'Map', to: '/map' },
    { icon: Building2, label: 'Corporate', to: '/corporate' },
];

export function Sidebar() {
    return (
        <div className="pointer-events-auto flex h-full w-16 md:w-20 flex-col items-center border-r border-border bg-background/80 py-6 backdrop-blur-xl transition-all">
            <div className="flex flex-1 flex-col space-y-4">
                {navItems.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className="group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all"
                        activeProps={{
                            className: 'bg-primary/20 text-primary shadow-[inset_0_0_15px_rgba(16,185,129,0.2)]',
                        }}
                        inactiveProps={{
                            className: 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        }}
                    >
                        <item.icon className="h-6 w-6" />
                        {/* Tooltip on hover */}
                        <span className="absolute left-14 z-50 rounded-md bg-popover px-2 py-1 text-xs font-semibold text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                            {item.label}
                        </span>
                    </Link>
                ))}
            </div>

            <div className="flex flex-col space-y-4">
                {/* Future status or settings icons here */}
            </div>
        </div>
    );
}
