// Body SVGs: airplane silhouette only (tinted with primary livery color)
export const NARROWBODY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
export const TURBOPROP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
export const WIDEBODY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
export const REGIONAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 15v-2l-7-5V3.5c0-.83-.67-1.5-1.5-1.5S9 2.67 9 3.5V8l-7 5v2l7-2.5V18l-1.5 1V21l2.5-.8 2.5.8v-1.5L11 18v-5.5l8 2.5z"/></svg>`;

// Accent SVGs: detail shapes only (tinted with secondary livery color)
// These overlay on top of the body layer at the same position/rotation.
export const NARROWBODY_ACCENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><rect x="10.5" y="5" width="3" height="3"/><rect x="4" y="12" width="3" height="1"/><rect x="17" y="12" width="3" height="1"/></svg>`;
export const TURBOPROP_ACCENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><circle cx="15.5" cy="11.5" r="2"/><circle cx="8.5" cy="11.5" r="2"/></svg>`;
export const WIDEBODY_ACCENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><rect x="16" y="11" width="1" height="2"/><rect x="18" y="12" width="1" height="2"/><rect x="7" y="11" width="1" height="2"/><rect x="5" y="12" width="1" height="2"/></svg>`;
export const REGIONAL_ACCENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><rect x="12" y="16" width="1.5" height="3"/><rect x="8.5" y="16" width="1.5" height="3"/></svg>`;

// Aliases for backward compatibility
export const NARROWBODY_BODY_SVG = NARROWBODY_SVG;
export const TURBOPROP_BODY_SVG = TURBOPROP_SVG;
export const WIDEBODY_BODY_SVG = WIDEBODY_SVG;
export const REGIONAL_BODY_SVG = REGIONAL_SVG;
