/**
 * ASSET MANIFEST — the single place to swap placeholder art for real assets.
 *
 * CHARACTERS: omit `sheet` to use the built-in procedural rig. To use a real sprite sheet add e.g.
 *   sheet: {
 *     key: 'azure', url: '/assets/characters/azure.png', frameWidth: 128, frameHeight: 128,
 *     scale: 1.4,                       // optional; origin is bottom-center (feet)
 *     anims: {                          // one entry per fighter state (missing => falls back to idle)
 *       idle:  { start: 0,  end: 5,  frameRate: 8,  repeat: -1 },
 *       walk:  { start: 6,  end: 11, frameRate: 12, repeat: -1 },
 *       jump:  { start: 12, end: 14, frameRate: 8,  repeat: 0  },
 *       block: { start: 15, end: 15, frameRate: 8,  repeat: -1 },
 *       punch: { start: 16, end: 19, frameRate: 24, repeat: 0  },
 *       kick:  { start: 20, end: 24, frameRate: 20, repeat: 0  },
 *       hit:   { start: 25, end: 26, frameRate: 12, repeat: 0  },
 *       blockhit: { start: 15, end: 15, frameRate: 8, repeat: 0 },
 *       ko:    { start: 27, end: 30, frameRate: 10, repeat: 0  },
 *     },
 *   }
 * To add a new character: add it to CHARACTERS in shared/protocol.js (server validates ids) and here.
 *
 * SFX: set a URL (files in client/public/assets/sfx) to override the synthesized placeholder sound.
 * STAGES: set `image` to a 960x540 background; omit for the procedural backdrop.
 */
export const CHARACTER_ART = {
  azure:   { colors: { gi: 0x2f9bff, pants: 0x14305c, skin: 0xf0c8a0, accent: 0xffffff, glove: 0xe83c4a }, sheet: null },
  solar:   { colors: { gi: 0xffb13b, pants: 0x4a2f10, skin: 0xb9805a, accent: 0xff3b4e, glove: 0x1e2a44 }, sheet: null },
  ethan:   {
    colors: { gi: 0x52dbe3, pants: 0x123b42, skin: 0x91e8eb, accent: 0xffffff, glove: 0x123b42 },
    sheet: {
      key: 'ethan', url: '/assets/characters/ethan.png', frameWidth: 250, frameHeight: 250, scale: 0.65,
      anims: {
        idle:     { start: 0,  end: 7,  frameRate: 8,  repeat: -1 },
        walk:     { start: 8,  end: 15, frameRate: 12, repeat: -1 },
        jump:     { start: 16, end: 23, frameRate: 10, repeat: 0 },
        block:    { start: 24, end: 31, frameRate: 10, repeat: -1 },
        punch:    { start: 32, end: 39, frameRate: 18, repeat: 0 },
        kick:     { start: 40, end: 47, frameRate: 18, repeat: 0 },
        hit:      { start: 48, end: 55, frameRate: 14, repeat: 0 },
        blockhit: { start: 28, end: 29, frameRate: 14, repeat: 0 },
        ko:       { start: 56, end: 63, frameRate: 10, repeat: 0 },
      },
    },
  },
  ella:   {
    colors: { gi: 0xe65ad5, pants: 0x35203d, skin: 0xffdff7, accent: 0xffffff, glove: 0xb632b5 },
    sheet: {
      key: 'ella', url: '/assets/characters/ella.png', frameWidth: 250, frameHeight: 250, scale: 0.65,
      anims: {
        idle:     { start: 0,  end: 7,  frameRate: 8,  repeat: -1 },
        walk:     { start: 8,  end: 15, frameRate: 12, repeat: -1 },
        jump:     { start: 16, end: 23, frameRate: 10, repeat: 0 },
        block:    { start: 24, end: 31, frameRate: 10, repeat: -1 },
        punch:    { start: 32, end: 39, frameRate: 18, repeat: 0 },
        kick:     { start: 40, end: 47, frameRate: 18, repeat: 0 },
        hit:      { start: 48, end: 55, frameRate: 14, repeat: 0 },
        blockhit: { start: 28, end: 29, frameRate: 14, repeat: 0 },
        ko:       { start: 56, end: 63, frameRate: 10, repeat: 0 },
      },
    },
  },
  dex:    {
    colors: { gi: 0x29252f, pants: 0x17151c, skin: 0xc98b65, accent: 0x7658a8, glove: 0x25212b },
    sheet: {
      key: 'dex', url: '/assets/characters/dex.png', frameWidth: 250, frameHeight: 250, scale: 0.65,
      anims: {
        idle:     { start: 0,  end: 7,  frameRate: 8,  repeat: -1 },
        walk:     { start: 8,  end: 15, frameRate: 12, repeat: -1 },
        jump:     { start: 16, end: 23, frameRate: 10, repeat: 0 },
        block:    { start: 24, end: 31, frameRate: 10, repeat: -1 },
        punch:    { start: 32, end: 39, frameRate: 18, repeat: 0 },
        kick:     { start: 40, end: 47, frameRate: 18, repeat: 0 },
        hit:      { start: 48, end: 55, frameRate: 14, repeat: 0 },
        blockhit: { start: 28, end: 29, frameRate: 14, repeat: 0 },
        ko:       { start: 56, end: 63, frameRate: 10, repeat: 0 },
      },
    },
  },
  kamal:  {
    colors: { gi: 0xd8bd8c, pants: 0x34363a, skin: 0xc98b65, accent: 0x318bd0, glove: 0x34363a },
    sheet: {
      key: 'kamal', url: '/assets/characters/kamal.png', frameWidth: 250, frameHeight: 250, scale: 0.65,
      anims: {
        idle:     { start: 0,  end: 7,  frameRate: 8,  repeat: -1 },
        walk:     { start: 8,  end: 15, frameRate: 12, repeat: -1 },
        jump:     { start: 16, end: 23, frameRate: 10, repeat: 0 },
        block:    { start: 24, end: 31, frameRate: 10, repeat: -1 },
        punch:    { start: 32, end: 39, frameRate: 18, repeat: 0 },
        kick:     { start: 40, end: 47, frameRate: 18, repeat: 0 },
        hit:      { start: 48, end: 55, frameRate: 14, repeat: 0 },
        blockhit: { start: 28, end: 29, frameRate: 14, repeat: 0 },
        ko:       { start: 56, end: 63, frameRate: 10, repeat: 0 },
      },
    },
  },
  bachir: {
    colors: { gi: 0x292535, pants: 0xb8bec9, skin: 0xc88763, accent: 0xbc3f4c, glove: 0x292535 },
    sheet: {
      key: 'bachir', url: '/assets/characters/bachir.png', frameWidth: 250, frameHeight: 250, scale: 0.65,
      anims: {
        idle:     { start: 0,  end: 7,  frameRate: 8,  repeat: -1 },
        walk:     { start: 8,  end: 15, frameRate: 12, repeat: -1 },
        jump:     { start: 16, end: 23, frameRate: 10, repeat: 0 },
        block:    { start: 24, end: 31, frameRate: 10, repeat: -1 },
        punch:    { start: 32, end: 39, frameRate: 18, repeat: 0 },
        kick:     { start: 40, end: 47, frameRate: 18, repeat: 0 },
        hit:      { start: 48, end: 55, frameRate: 14, repeat: 0 },
        blockhit: { start: 28, end: 29, frameRate: 14, repeat: 0 },
        ko:       { start: 56, end: 63, frameRate: 10, repeat: 0 },
      },
    },
  },
};

export const SFX = { punch: null, kick: null, special: null, hit: null, block: null, ko: null, bell: null, tick: null };

export const STAGE_ART = {
  dojo:    { image: null, sky: [0x1a0f2e, 0x5a1d3a], sun: 0xff6a4d, far: 0x2a1530, near: 0x180c22, floor: 0x3b2430, line: 0xff6a4d },
  harbor:  { image: null, sky: [0x061a33, 0x1c5a7a], sun: 0xbff3ff, far: 0x0e2c4a, near: 0x08203a, floor: 0x1a3347, line: 0x36e2ff },
  rooftop: { image: null, sky: [0x0b0b1f, 0x3a1a6b], sun: 0xff3bd4, far: 0x1d1245, near: 0x120a30, floor: 0x2a2250, line: 0xff3bd4 },
};
