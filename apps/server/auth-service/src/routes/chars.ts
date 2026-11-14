// Job: length checks for request schemas, counted in characters (code points), not UTF-16 units.
export const chars = (min: number, max: number) => (s: string) => [...s].length >= min && [...s].length <= max;
