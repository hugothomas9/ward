/** Regroupe les milliers avec une espace insécable fine (feel journal financier). */
export const groupInt = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export const usd = (n: number) => "$" + groupInt(n);
export const usd2 = (n: number) => "$" + n.toFixed(2);
export const pct = (n: number, d = 1) => n.toFixed(d) + " %";

/** Couleur sémantique d'un health factor. */
export const hfColor = (hf: number) =>
  hf < 1 ? "var(--danger)" : hf < 1.2 ? "var(--warn)" : "var(--ward)";

export const hfLabel = (hf: number) =>
  hf < 1 ? "À risque" : hf < 1.2 ? "Limite" : "Sain";

export const shortAddr = (a: string) =>
  a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

/** Normalise la valeur d'un Slider (single ou range) en un nombre. */
export const num1 = (v: number | readonly number[]) =>
  Array.isArray(v) ? v[0] : (v as number);
