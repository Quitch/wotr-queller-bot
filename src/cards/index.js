// Every Shadow card, base game first. The order matters: the seeded shuffle in the tests depends on it.
import { BASE_CARDS } from "./base.js";
import { WOME_CARDS } from "./wome.js";

export const CARDS = [...BASE_CARDS, ...WOME_CARDS];
