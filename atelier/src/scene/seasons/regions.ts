export type RegionId = 'tokyo' | 'hongkong' | 'lunar' | 'singapore'
export type Region = { id: RegionId; city: string; season: string; file: string; silk: string; border: string }
/** The website's Seasons section ("a living archive"): the region Z logos. silk = the scarf's ground, border = its edge colour. */
export const REGIONS: readonly Region[] = [
  { id: 'tokyo', city: 'TOKYO', season: 'CHERRY BLOSSOM', file: 'regions/tokyo.webp', silk: '#f6e3e6', border: '#c94d6b' },
  { id: 'hongkong', city: 'HONG KONG', season: 'BAUHINIA', file: 'regions/hongkong.webp', silk: '#7d0e1f', border: '#e2b04a' },
  { id: 'lunar', city: 'LUNAR NEW YEAR', season: 'YEAR OF THE DRAGON', file: 'regions/lunar.webp', silk: '#5a0614', border: '#d9a441' },
  { id: 'singapore', city: 'SINGAPORE', season: 'MARINA BAY', file: 'regions/singapore.webp', silk: '#f3ece1', border: '#b5121b' },
]
