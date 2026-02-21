import fs from 'node:fs';
import https from 'node:https';

const OPEN_FLIGHTS_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';

// Simple heuristic values for missing country data to populate the economic model
const REGION_HEURISTICS = {
    'US': { pop: 2_000_000, gdp: 65000 },
    'GB': { pop: 1_500_000, gdp: 45000 },
    'CN': { pop: 5_000_000, gdp: 12000 },
    'IN': { pop: 4_000_000, gdp: 2500 },
    'BR': { pop: 3_000_000, gdp: 9000 },
    // Default values
    'DEFAULT': { pop: 500_000, gdp: 15000 }
};

async function downloadFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    console.log('Downloading OpenFlights airport data...');
    const csv = await downloadFile(OPEN_FLIGHTS_URL);

    console.log('Parsing CSV...');
    const lines = csv.split('\n');
    const airports = [];

    for (const line of lines) {
        if (!line.trim()) continue;
        // Regex to split by comma, respecting quotes
        const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
        const parts = [];
        let match;
        while (match = regex.exec(line)) {
            parts.push(match[1] !== undefined ? match[1] : match[2]);
        }

        // OpenFlights format:
        // 0: Airport ID
        // 1: Name
        // 2: City
        // 3: Country
        // 4: IATA
        // 5: ICAO
        // 6: Latitude
        // 7: Longitude
        // 8: Altitude
        // 9: Timezone offset
        // 10: DST
        // 11: Tz database time zone
        // 12: Type (airport, station, port, unknown)
        // 13: Source

        const type = parts[12];
        if (type !== 'airport') continue; // only keep airports

        const iata = parts[4];
        if (!iata || iata === '\\N' || iata.length !== 3) continue; // must have IATA

        const lat = parseFloat(parts[6]);
        const lon = parseFloat(parts[7]);
        if (isNaN(lat) || isNaN(lon)) continue;

        const tz = parts[11] !== '\\N' ? parts[11] : 'UTC';

        // Heuristics for economy
        // (In a real app, this would be cross-referenced with a cities database)
        const heuristics = REGION_HEURISTICS['DEFAULT'];

        // Assign some random-ish but reasonable tags based on name/coords
        const tags = [];
        const nameLower = parts[1].toLowerCase();
        if (nameLower.includes('intl') || nameLower.includes('international')) {
            tags.push('business');
        } else if (lat < 30 && lat > -30) {
            tags.push('beach');
        } else {
            tags.push('general');
        }

        airports.push({
            id: parts[0],
            name: parts[1],
            iata,
            icao: parts[5] !== '\\N' ? parts[5] : '',
            latitude: lat,
            longitude: lon,
            altitude: parseInt(parts[8]) || 0,
            timezone: tz,
            country: parts[3], // OpenFlights uses long country names, but our type says "ISO 3166-1 alpha-2". We'll fix this.
            city: parts[2],
            population: Math.floor(heuristics.pop * (0.5 + Math.random())), // Fuzzed
            gdpPerCapita: Math.floor(heuristics.gdp * (0.8 + Math.random() * 0.4)),
            tags
        });
    }

    console.log(`Parsed ${airports.length} valid airports.`);

    // Write typescript file
    const fileContent = `// auto-generated file
import type { Airport } from '@airtr/core';

export const airports: Airport[] = ${JSON.stringify(airports, null, 2)};
`;

    fs.mkdirSync('src', { recursive: true });
    fs.writeFileSync('src/airports.ts', fileContent);
    console.log('Successfully wrote src/airports.ts');

    // Create index.ts
    fs.writeFileSync('src/index.ts', `export * from './airports.js';\n`);
}

main().catch(console.error);
