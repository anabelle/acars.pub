/**
 * Names for planes (S61): evocative, short, readable in English and Spanish,
 * never a model number. Birds, winds, stars, islands, flowers, landmarks.
 */
export const PLANE_NAMES = [
  "Quetzal",
  "Colibrí",
  "Dorado",
  "Mariposa",
  "Isla Bonita",
  "Isla Coral",
  "Alcatraz",
  "Cóndor",
  "Tucán",
  "Guacamaya",
  "Albatros",
  "Gaviota",
  "Golondrina",
  "Halcón",
  "Garza",
  "Flamenco",
  "Pelícano",
  "Petrel",
  "Fragata",
  "Cormorán",
  "Martín Pescador",
  "Ruiseñor",
  "Calandria",
  "Jilguero",
  "Alisio",
  "Siroco",
  "Mistral",
  "Brisa",
  "Tramontana",
  "Levante",
  "Poniente",
  "Pampero",
  "Chinook",
  "Monzón",
  "Céfiro",
  "Bóreas",
  "Aurora",
  "Lucero",
  "Polaris",
  "Vega",
  "Altair",
  "Sirius",
  "Orión",
  "Antares",
  "Rigel",
  "Canopus",
  "Cruz del Sur",
  "Estrella del Alba",
  "Luna Llena",
  "Cometa",
  "Galápagos",
  "Tortuga",
  "Margarita",
  "Isla Mujeres",
  "Roatán",
  "Isla Verde",
  "San Andrés",
  "Bonaire",
  "Aruba",
  "Curazao",
  "Tobago",
  "Cozumel",
  "Orquídea",
  "Heliconia",
  "Buganvilla",
  "Jacaranda",
  "Ceiba",
  "Palma Real",
  "Magnolia",
  "Camelia",
  "Gardenia",
  "Azahar",
  "Laurel",
  "Olivo",
  "Almendro",
  "Flor de Lis",
  "Volcán",
  "Cordillera",
  "Nevado",
  "Altiplano",
  "Sabana",
  "Pampa",
  "Selva",
  "Laguna",
  "Arrecife",
  "Marea",
  "Oleaje",
  "Bahía",
  "Ensenada",
  "Cabo",
  "Faro",
  "Puerto Viejo",
  "Sol de Mayo",
  "Atardecer",
  "Amanecer",
  "Horizonte",
  "Meridiano",
  "Ecuador",
  "Trópico",
  "Rosa de los Vientos",
  "Brújula",
  "Astrolabio",
  "Sextante",
  "Bitácora",
  "Mapamundi",
  "Travesía",
  "Ruta Azul",
  "Cielo Abierto",
  "Nube Blanca",
  "Arcoíris",
  "Relámpago",
  "Trueno",
  "Ventisca",
  "Rocío",
  "Neblina",
  "Escarcha",
  "Primavera",
  "Verano",
  "Otoño",
  "Invierno",
] as const;

const ROMAN = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** FNV-1a: a small, stable string hash (same seed, same name, every client). */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A name for a new plane: picked by `seed`, never one the fleet already uses
 * (case-insensitive). When every name is taken it adds a numeral ("Quetzal II").
 */
export function suggestPlaneName(seed: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, (name) => name.trim().toLowerCase()));
  const start = hash(seed) % PLANE_NAMES.length;
  for (const suffix of ["", ...ROMAN]) {
    for (let i = 0; i < PLANE_NAMES.length; i++) {
      const base = PLANE_NAMES[(start + i) % PLANE_NAMES.length];
      const name = suffix ? `${base} ${suffix}` : base;
      if (!used.has(name.toLowerCase())) return name;
    }
  }
  return `${PLANE_NAMES[start]} ${used.size + 1}`;
}
