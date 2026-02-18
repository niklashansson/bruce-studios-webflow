// Global type declarations for CDN-loaded libraries

import type mapboxgl from 'mapbox-gl';

declare global {
  interface Window {
    /** Mapbox GL JS loaded via CDN */
    mapboxgl: typeof mapboxgl;
    /** Webflow push queue */
    Webflow: Array<() => void>;
    /** Finsweet Attributes integration */
    FinsweetAttributes: unknown[];
  }
}
