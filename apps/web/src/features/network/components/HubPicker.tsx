import { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import type { Airport } from '@airtr/core';
import { airports as AIRPORTS } from '@airtr/data';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X, MapPin } from 'lucide-react';

export function HubPicker({
    currentHub,
    onSelect,
}: {
    currentHub: Airport | null;
    onSelect: (airport: Airport | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [deferredSearch, setDeferredSearch] = useState('');
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const filtered = useMemo(() => {
        if (!deferredSearch) return AIRPORTS;
        const q = deferredSearch.toLowerCase();
        return AIRPORTS.filter(
            (a) =>
                a.iata.toLowerCase().includes(q) ||
                a.city.toLowerCase().includes(q) ||
                a.name.toLowerCase().includes(q) ||
                a.country.toLowerCase().includes(q)
        );
    }, [deferredSearch]);

    const virtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 64, // Approximate row height
        overscan: 5,
    });

    const handleSearchChange = (val: string) => {
        setSearch(val);
        startTransition(() => {
            setDeferredSearch(val);
        });
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background h-10 px-4 py-2"
                title="Change your hub airport"
            >
                <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                {currentHub ? 'Change Hub' : 'Select Hub'}
            </button>

            {open &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center sm:items-center p-4 sm:p-0">
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-all duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in"
                            onClick={() => setOpen(false)}
                        />
                        {/* Modal */}
                        <div
                            role="dialog"
                            aria-modal="true"
                            className="relative z-50 grid w-full max-w-lg gap-4 rounded-xl border bg-card text-card-foreground shadow-lg duration-200 animate-in fade-in-90 zoom-in-95 sm:max-w-[425px]"
                        >
                            <div className="flex flex-col space-y-1.5 p-6 pb-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold leading-none tracking-tight">Search Airports</h2>
                                    <button
                                        onClick={() => setOpen(false)}
                                        className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <X className="h-4 w-4" />
                                        <span className="sr-only">Close</span>
                                    </button>
                                </div>
                            </div>

                            <div className="px-6 pb-2">
                                <div className="relative flex items-center border-b pb-2">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <input
                                        ref={inputRef}
                                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Search by city, IATA code, or airport name..."
                                        value={search}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div
                                ref={scrollRef}
                                className="max-h-[300px] overflow-y-auto px-2 pb-2"
                            >
                                <div
                                    className="relative w-full"
                                    style={{ height: `${virtualizer.getTotalSize()}px` }}
                                >
                                    {virtualizer.getVirtualItems().map((virtualRow) => {
                                        const airport = filtered[virtualRow.index];
                                        const isActive = currentHub && airport.iata === currentHub.iata;

                                        return (
                                            <button
                                                key={airport.iata}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                }}
                                                className={`flex w-full items-center justify-between rounded-md px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${isActive ? 'bg-primary/10 text-primary' : ''
                                                    }`}
                                                onClick={() => {
                                                    onSelect(airport);
                                                    setOpen(false);
                                                    setSearch('');
                                                    setDeferredSearch('');
                                                }}
                                            >
                                                <div className="flex flex-col overflow-hidden">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="font-bold text-foreground">{airport.iata}</span>
                                                        <span className="truncate text-muted-foreground">{airport.city}</span>
                                                    </div>
                                                    <span className="truncate text-xs text-muted-foreground opacity-70">
                                                        {airport.name}
                                                    </span>
                                                </div>
                                                <span className="ml-4 shrink-0 text-xs font-semibold uppercase opacity-50">
                                                    {airport.country}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {filtered.length === 0 && !isPending && (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        No airports match "{search}"
                                    </div>
                                )}
                                {isPending && (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        Searching...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
