// Centralized defaults for stats and skills
export const STAT_DEFAULT_VALUES = Object.freeze({
  INT: 5, REF: 5, TECH: 5, COOL: 5, ATTR: 5,
  LUCK: 5, MA: 5, BODY: 5, EMP: 5, EDU: 5
});

export function applyStatDefaults(stats = {}, defaults = STAT_DEFAULT_VALUES) {
  const out = { ...defaults }; // shallow copy
  for (const [k, v] of Object.entries(stats)) {
    if (v && typeof v === 'object') out[k] = { value: Number(v.value) ?? defaults[k] };
  }
  // Ensure shape {KEY:{value:number}}
  for (const k of Object.keys(out)) {
    const val = out[k];
    if (typeof val !== 'object') out[k] = { value: Number(val) || defaults[k] };
    else out[k].value = Number(out[k].value) || defaults[k];
  }
  return out;
}
