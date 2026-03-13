import { TextureType } from '../types'

// Each texture has multiple color variants (index 0, 1, 2, ...)
// Returns: { bg: background fill color, fg: pattern element color, fg2?: optional secondary }
export interface TextureColors {
  bg: string
  fg: string
  fg2?: string
}

const TEXTURE_VARIANTS: Record<TextureType, TextureColors[]> = {
  water: [
    { bg: '#3a7bd5', fg: '#5a9be6', fg2: '#2a6bc5' },    // blue
    { bg: '#6aafe6', fg: '#8ec8f0', fg2: '#5a9fd6' },    // light blue
    { bg: '#4a90d9', fg: '#7ab8f0', fg2: '#3a80c9' },    // light blue
  ],
  bricks: [
    { bg: '#8b4513', fg: '#a0522d', fg2: '#6b3410' },    // red-brown
    { bg: '#6d6d6d', fg: '#888888', fg2: '#555555' },    // gray stone
    { bg: '#c4a882', fg: '#d4b892', fg2: '#b49872' },    // sandstone
  ],
  grass: [
    { bg: '#3a7d44', fg: '#4a9d54', fg2: '#2a6d34' },    // green
    { bg: '#6b8e23', fg: '#8bae43', fg2: '#5b7e13' },    // olive
    { bg: '#228b22', fg: '#32ab32', fg2: '#126b12' },    // forest
  ],
  gravel: [
    { bg: '#808080', fg: '#999999', fg2: '#666666' },    // gray
    { bg: '#8b7d6b', fg: '#a09080', fg2: '#6b5d4b' },    // brown-gray
    { bg: '#696969', fg: '#888888', fg2: '#505050' },    // dark gray
  ],
  sand: [
    { bg: '#d4b896', fg: '#e4c8a6', fg2: '#c4a886' },    // golden
    { bg: '#c2b280', fg: '#d2c290', fg2: '#b2a270' },    // khaki
    { bg: '#e8d5b7', fg: '#f0ddc0', fg2: '#d8c5a7' },    // pale
  ],
  pavement: [
    { bg: '#555555', fg: '#666666', fg2: '#444444' },    // dark
    { bg: '#888888', fg: '#999999', fg2: '#777777' },    // light
    { bg: '#6a5d4d', fg: '#7a6d5d', fg2: '#5a4d3d' },    // warm
  ],
  dirt: [
    { bg: '#2e1f14', fg: '#3e2f24', fg2: '#1e0f04' },    // dark soil
    { bg: '#241a10', fg: '#342a20', fg2: '#140a00' },    // deep mud
    { bg: '#382818', fg: '#483828', fg2: '#281808' },    // loam
  ],
  dirtTrailV: [
    { bg: '#2e1f14', fg: '#3e2f24', fg2: '#1e0f04' },    // stomped dark
    { bg: '#241a10', fg: '#342a20', fg2: '#140a00' },    // stomped mud
    { bg: '#382818', fg: '#483828', fg2: '#281808' },    // stomped loam
  ],
  dirtTrailH: [
    { bg: '#2e1f14', fg: '#3e2f24', fg2: '#1e0f04' },    // stomped dark
    { bg: '#241a10', fg: '#342a20', fg2: '#140a00' },    // stomped mud
    { bg: '#382818', fg: '#483828', fg2: '#281808' },    // stomped loam
  ],
  wood: [
    { bg: '#8b6914', fg: '#a07828', fg2: '#7a5a0a' },    // oak
    { bg: '#5c3a1e', fg: '#6e4c2e', fg2: '#4c2a0e' },    // walnut
    { bg: '#c4a56a', fg: '#d4b57a', fg2: '#b4955a' },    // birch/maple
  ],
  carpet: [
    { bg: '#8b2252', fg: '#a03368', fg2: '#6b1242' },    // burgundy/wine
    { bg: '#1a4a6e', fg: '#2a5a7e', fg2: '#0a3a5e' },    // navy blue
    { bg: '#2e5e3e', fg: '#3e6e4e', fg2: '#1e4e2e' },    // forest green
  ],
}

export function getTextureVariants(type: TextureType): TextureColors[] {
  return TEXTURE_VARIANTS[type]
}

export function getTextureColors(type: TextureType, variant: number): TextureColors {
  const variants = TEXTURE_VARIANTS[type]
  return variants[variant % variants.length]
}

export const TEXTURE_TYPES: TextureType[] = ['wood', 'carpet', 'gravel', 'bricks', 'pavement', 'grass', 'sand', 'dirt', 'dirtTrailV', 'dirtTrailH', 'water']

export const TEXTURE_LABELS: Record<TextureType, string> = {
  water: 'Water',
  bricks: 'Bricks',
  grass: 'Grass',
  gravel: 'Gravel',
  sand: 'Sand',
  pavement: 'Pavement',
  wood: 'Wood',
  dirt: 'Dirt',
  dirtTrailV: 'Dirt (V Trail)',
  dirtTrailH: 'Dirt (H Trail)',
  carpet: 'Carpet',
}

/** Get the pattern ID for a given texture type and variant */
export function texturePatternId(type: TextureType, variant: number): string {
  return `tex-${type}-${variant}`
}
