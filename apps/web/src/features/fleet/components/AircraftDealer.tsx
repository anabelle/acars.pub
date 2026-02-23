import { useState, useMemo } from 'react';
import { aircraftModels } from '@airtr/data';
import type { AircraftModel } from '@airtr/core';
import { fpFormat } from '@airtr/core';
import { useAirlineStore } from '@airtr/store';
import { Search, Plane, Users, ArrowRight, Coins, Check, Timer, X, MapPin, Tag } from 'lucide-react';

export function AircraftDealer() {
    const [search, setSearch] = useState('');
    const [selectedTier, setSelectedTier] = useState<number | 'all'>('all');
    const [selectedModel, setSelectedModel] = useState<AircraftModel | null>(null);

    const filteredAircraft = useMemo(() => {
        let list = aircraftModels;
        if (selectedTier !== 'all') {
            list = list.filter((a) => a.unlockTier === selectedTier);
        }
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (a) =>
                    a.name.toLowerCase().includes(q) ||
                    a.manufacturer.toLowerCase().includes(q)
            );
        }
        return list;
    }, [search, selectedTier]);

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header & Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-card border border-border/40 p-4 shadow-sm backdrop-blur-xl">
                <div className="relative flex items-center min-w-[300px]">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <input
                        className="h-10 w-full rounded-xl bg-background border border-border/50 pl-10 pr-4 text-sm transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground outline-none"
                        placeholder="Search aircraft models..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center space-x-2 bg-background p-1 rounded-xl border border-border/50">
                    <button
                        onClick={() => setSelectedTier('all')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedTier === 'all'
                            ? 'bg-primary/20 text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        All
                    </button>
                    {[1, 2, 3, 4].map((tier) => (
                        <button
                            key={tier}
                            onClick={() => setSelectedTier(tier)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${selectedTier === tier
                                ? 'bg-primary/20 text-primary shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            Tier {tier}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {filteredAircraft.map((aircraft) => (
                        <AircraftCard
                            key={aircraft.id}
                            aircraft={aircraft}
                            onSelect={() => setSelectedModel(aircraft)}
                        />
                    ))}
                    {filteredAircraft.length === 0 && (
                        <div className="col-span-full py-20 text-center flex flex-col items-center border border-dashed border-border/50 rounded-2xl bg-card/20">
                            <Plane className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                            <p className="text-muted-foreground">No aircraft found matching your criteria.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Purchase Modal */}
            {selectedModel && (
                <PurchaseModal
                    aircraft={selectedModel}
                    onClose={() => setSelectedModel(null)}
                />
            )}
        </div>
    );
}

function AircraftCard({ aircraft, onSelect }: { aircraft: AircraftModel, onSelect: () => void }) {
    const gradientMap: Record<string, string> = {
        'Airbus': 'from-blue-500/20 via-blue-900/10 to-transparent',
        'Boeing': 'from-indigo-500/20 via-purple-900/10 to-transparent',
        'Embraer': 'from-emerald-500/20 via-green-900/10 to-transparent',
        'ATR': 'from-orange-500/20 via-red-900/10 to-transparent',
        'De Havilland': 'from-red-500/20 via-rose-900/10 to-transparent',
    };
    const bgGradient = gradientMap[aircraft.manufacturer] || 'from-zinc-500/20 via-zinc-900/10 to-transparent';
    const totalCapacity = aircraft.capacity.economy + aircraft.capacity.business + aircraft.capacity.first;

    return (
        <div className="group relative flex flex-col rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:border-border/80">
            {/* Top Image Splash */}
            <div className={`h-32 w-full bg-gradient-to-br ${bgGradient} relative flex items-center justify-center border-b border-border/30`}>
                <div className="absolute top-4 left-4 flex gap-2">
                    <span className="inline-flex items-center rounded-full bg-background/80 backdrop-blur-md px-2.5 py-0.5 text-xs font-semibold text-foreground border border-border/50">
                        Tier {aircraft.unlockTier}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-background/80 backdrop-blur-md px-2.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground border border-border/50">
                        {aircraft.type}
                    </span>
                </div>
                <Plane className="h-16 w-16 text-foreground/20 rotate-[-15deg] group-hover:scale-110 group-hover:text-foreground/40 transition-all duration-500" />
            </div>

            <div className="flex flex-col flex-1 p-5">
                <div className="mb-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{aircraft.manufacturer}</p>
                    <h3 className="text-xl font-bold text-foreground">{aircraft.name}</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 mt-auto">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/30 text-accent-foreground border border-accent/20">
                            <Users className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Capacity</p>
                            <p className="text-sm font-medium">{totalCapacity} pax</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/30 text-accent-foreground border border-accent/20">
                            <ArrowRight className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Range</p>
                            <p className="text-sm font-medium">{aircraft.rangeKm.toLocaleString()} km</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 col-span-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                            <Timer className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Factory Lead Time</p>
                            <p className="text-sm font-medium text-yellow-500">{aircraft.deliveryTimeTicks} Engine Ticks</p>
                        </div>
                    </div>
                </div>

                <div className="h-px w-full bg-border/50 mb-4" />

                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">List Price</p>
                        <p className="text-lg font-bold text-primary group-hover:text-primary-foreground transition-colors group-hover:-translate-y-0.5 transform duration-300 drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            {fpFormat(aircraft.price, 0)}
                        </p>
                    </div>

                    <button
                        onClick={onSelect}
                        className="relative overflow-hidden rounded-xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                    >
                        <span className="relative flex items-center gap-2">
                            Configure & Buy
                        </span>
                    </button>
                </div>
            </div >
        </div >
    );
}

function PurchaseModal({ aircraft, onClose }: { aircraft: AircraftModel, onClose: () => void }) {
    const hubs = useAirlineStore(state => state.airline?.hubs || []);
    const purchaseAircraft = useAirlineStore(state => state.purchaseAircraft);
    const corporateBalance = useAirlineStore(state => state.airline?.corporateBalance);

    const [selectedHub, setSelectedHub] = useState<string>(hubs[0] || '');
    const [customName, setCustomName] = useState('');
    const [isPurchasing, setIsPurchasing] = useState(false);

    const [busSeats, setBusSeats] = useState(aircraft.capacity.business);
    const [firstSeats, setFirstSeats] = useState(aircraft.capacity.first);

    // Calculate space dynamics based on fleet manager plan
    const baseEconSpace = aircraft.capacity.economy + (aircraft.capacity.business * 2.5) + (aircraft.capacity.first * 4);
    const econSeats = Math.floor(baseEconSpace - (busSeats * 2.5) - (firstSeats * 4));
    const totalCapacity = econSeats + busSeats + firstSeats;

    const maxFirstClass = Math.floor(baseEconSpace / 4);
    const maxBusinessClass = Math.floor((baseEconSpace - (firstSeats * 4)) / 2.5);

    const handlePurchase = async () => {
        setIsPurchasing(true);
        try {
            await purchaseAircraft(
                aircraft,
                selectedHub,
                { economy: econSeats, business: busSeats, first: firstSeats, cargoKg: aircraft.capacity.cargoKg },
                customName
            );
            setIsPurchasing(false);
            onClose();
        } catch (error: any) {
            alert(error.message);
            setIsPurchasing(false);
        }
    };

    const gradientMap: Record<string, string> = {
        'Airbus': 'from-blue-500/20 via-blue-900/10 to-transparent',
        'Boeing': 'from-indigo-500/20 via-purple-900/10 to-transparent',
        'Embraer': 'from-emerald-500/20 via-green-900/10 to-transparent',
        'ATR': 'from-orange-500/20 via-red-900/10 to-transparent',
        'De Havilland': 'from-red-500/20 via-rose-900/10 to-transparent',
    };
    const bgGradient = gradientMap[aircraft.manufacturer] || 'from-zinc-500/20 via-zinc-900/10 to-transparent';

    const canAfford = typeof corporateBalance === 'number' ? corporateBalance >= aircraft.price : true; // naive fallback

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header Graphic */}
                <div className={`h-32 w-full bg-gradient-to-br ${bgGradient} relative flex items-center justify-between p-6 border-b border-border/30 shrink-0`}>
                    <div className="z-10">
                        <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground block mb-1">{aircraft.manufacturer}</span>
                        <h2 className="text-3xl font-bold text-foreground drop-shadow-sm">{aircraft.name}</h2>
                    </div>
                    <Plane className="h-24 w-24 text-foreground/10 rotate-[-15deg] absolute right-6 top-4" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-background/20 hover:bg-background/40 backdrop-blur-md transition-colors z-20"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">

                    {/* Identification */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" />
                            Aircraft Identity
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5 border border-border/50 rounded-xl p-3 bg-background/50 focus-within:border-primary/50 transition-colors">
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase block">Registration / Name (Optional)</label>
                                <input
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    placeholder={`e.g. ${aircraft.name} 1`}
                                    className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
                                />
                            </div>

                            {hubs.length > 0 && (
                                <div className="space-y-1.5 border border-border/50 rounded-xl p-3 bg-background/50 focus-within:border-primary/50 transition-colors">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase block flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> Delivery Hub
                                    </label>
                                    <select
                                        value={selectedHub}
                                        onChange={(e) => setSelectedHub(e.target.value)}
                                        className="w-full bg-transparent text-sm font-medium outline-none cursor-pointer"
                                    >
                                        {hubs.map(hub => (
                                            <option key={hub} value={hub} className="bg-background text-foreground">
                                                {hub}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-px w-full bg-border/50" />

                    {/* Seat Configuration */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-primary" />
                            Cabin Configuration
                        </h4>

                        <div className="border border-border/50 rounded-xl p-5 bg-background/50 space-y-6">

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase flex justify-between">
                                    <span>First Class (4x space)</span>
                                    <span className={firstSeats > 0 ? 'text-primary' : ''}>{firstSeats} seats</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max={maxFirstClass}
                                    step="1"
                                    value={firstSeats}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (baseEconSpace - (busSeats * 2.5) - (val * 4) >= 0) {
                                            setFirstSeats(val);
                                        } else {
                                            setBusSeats(Math.floor((baseEconSpace - (val * 4)) / 2.5));
                                            setFirstSeats(val);
                                        }
                                    }}
                                    className="w-full accent-primary h-2 bg-border/50 rounded-lg appearance-none cursor-pointer hover:bg-border transition-colors"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase flex justify-between">
                                    <span>Business Class (2.5x space)</span>
                                    <span className={busSeats > 0 ? 'text-primary' : ''}>{busSeats} seats</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max={maxBusinessClass}
                                    step="1"
                                    value={busSeats}
                                    onChange={(e) => setBusSeats(parseInt(e.target.value))}
                                    className="w-full accent-primary h-2 bg-border/50 rounded-lg appearance-none cursor-pointer hover:bg-border transition-colors"
                                />
                            </div>

                            <div className="flex flex-col mt-4 pt-4 border-t border-border/50">
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <div className="text-center flex-1">
                                        <span className="text-muted-foreground text-[10px] block uppercase font-bold mb-1">First</span>
                                        <span className="font-mono font-bold line-clamp-1 text-lg">{firstSeats}</span>
                                    </div>
                                    <div className="text-center flex-1 border-x border-border/50">
                                        <span className="text-muted-foreground text-[10px] block uppercase font-bold mb-1">Business</span>
                                        <span className="font-mono font-bold line-clamp-1 text-lg">{busSeats}</span>
                                    </div>
                                    <div className="text-center flex-1">
                                        <span className="text-muted-foreground text-[10px] block uppercase font-bold mb-1">Economy</span>
                                        <span className="font-mono font-bold text-primary line-clamp-1 text-lg">{econSeats}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-4 px-4 py-2 bg-accent/20 rounded-lg border border-accent/20">
                                    <span className="text-accent-foreground font-semibold uppercase text-[10px]">Total Passengers</span>
                                    <span className="font-mono font-bold text-accent-foreground">{totalCapacity}</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-border/50 bg-background/50 flex items-center justify-between shrink-0">
                    <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Total Cost</p>
                        <p className={`text-2xl font-bold drop-shadow-[0_0_10px_rgba(16,185,129,0.2)] ${canAfford ? 'text-primary' : 'text-red-500'}`}>
                            {fpFormat(aircraft.price, 0)}
                        </p>
                        <p className="text-xs text-yellow-500 font-medium mt-1 flex items-center gap-1">
                            <Timer className="h-3 w-3" /> Delivery in {aircraft.deliveryTimeTicks} Ticks
                        </p>
                    </div>

                    <button
                        onClick={handlePurchase}
                        disabled={isPurchasing || !canAfford || (hubs.length > 0 && !selectedHub)}
                        className={`relative overflow-hidden rounded-xl px-8 py-3 text-base font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${isPurchasing
                            ? 'bg-primary text-primary-foreground opacity-90 scale-95'
                            : !canAfford
                                ? 'bg-red-500/10 text-red-500 cursor-not-allowed border border-red-500/20'
                                : 'bg-primary text-primary-foreground hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:opacity-90'
                            }`}
                    >
                        <span className="relative flex items-center gap-2">
                            {isPurchasing ? (
                                <>
                                    <Check className="h-5 w-5 animate-pulse" />
                                    Purchasing...
                                </>
                            ) : !canAfford ? (
                                <>Insufficient Funds</>
                            ) : (
                                <>
                                    <Coins className="h-5 w-5" />
                                    Confirm Order
                                </>
                            )}
                        </span>
                    </button>
                </div>

            </div>
        </div>
    );
}
