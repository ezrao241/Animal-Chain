// Everything the 3D world needs before its first frame: the terrain height / trail / water fields, the finished terrain
// tiles and placement tables, and the life-size animal and food models. Loaded once and shared by every scene.
import {preloadWorld} from './forest-world';
import {preloadRealAnimals} from './real-animals';
import {preloadRealFood} from './real-food';

type Tile = {url: string; x0: number; y0: number; x1: number; y1: number};
// finished areas of the 400 x 280 m map (game units); the rest of the map uses the base terrain until it is built
export const WORLD_TILES: Tile[] = [{url: 'tiles/test_ford.glb', x0: 2190, y0: 930, x1: 2990, y1: 1730}];
export const WORLD_PLACEMENTS = ['placements_trees.json', 'test_ford/placements_detail.json', 'placements_ground.json'];

let ready: Promise<void> | null = null;
export function loadGameAssets(opts: {tiles?: Tile[]; placements?: string[]; animals?: boolean} = {}) {
  return ready ||= Promise.all([
    preloadWorld('/world/', opts.tiles ?? WORLD_TILES, opts.placements ?? WORLD_PLACEMENTS),
    opts.animals === false ? null : preloadRealAnimals('/animals/'),
    opts.animals === false ? null : preloadRealFood('/food/'),
  ]).then(() => undefined);
}
