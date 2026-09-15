// Randomness: the engine takes all of it from Math.random (the fuzz test replaces it with a seeded generator).

export const randomBelow = (limit) => Math.floor(Math.random() * limit);
export const pick = (items) => items[randomBelow(items.length)];
export const shuffle = (items) => {
  items = items.slice();
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};
