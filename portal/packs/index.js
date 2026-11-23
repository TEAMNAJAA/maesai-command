/* Registered data packs (area × hazard). Add a pack: copy sai-arsenic.js, replace the facts, import it here.
   ?pack=<id> in the URL opens a specific pack. */
import sai from './sai-arsenic'

export const PACKS = [sai]
export const packById = (id) => PACKS.find((p) => p.id === id) || PACKS[0]
