import { createContext } from 'svelte';
import type { Map } from 'maplibre-gl';

/**
 * Child components of <MapView> (route lines, place markers, …) read the map
 * instance from this context. The getter returns the map once its style has loaded.
 */
export const [getMapContext, setMapContext] = createContext<() => Map | null>();
