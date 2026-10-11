// Where the game's public assets are served from. The hosted game serves them at the site root; a static copy of the game
// (play/) can set globalThis.__ANIMAL_CHAIN_ASSETS to a relative path before the scene loads.
export const assetRoot = (): string => (globalThis as any).__ANIMAL_CHAIN_ASSETS ?? '/';
