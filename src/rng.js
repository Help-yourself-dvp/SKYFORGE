export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seedStr) {
  const seed = hashSeed(String(seedStr || 'SKY-001'));
  const next = mulberry32(seed);
  return {
    seed,
    seedStr: String(seedStr || 'SKY-001'),
    next,
    range(a, b) {
      return a + next() * (b - a);
    },
    int(a, b) {
      return Math.floor(a + next() * (b - a + 1));
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

export function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function smoother(a, b, t) {
  return lerp(a, b, fade(t));
}

export function createNoise2D(rng) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const grad2 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  function n2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const aa = grad2[perm[(xi + perm[yi & 255]) & 255] & 7];
    const ba = grad2[perm[(xi + 1 + perm[yi & 255]) & 255] & 7];
    const ab = grad2[perm[(xi + perm[(yi + 1) & 255]) & 255] & 7];
    const bb = grad2[perm[(xi + 1 + perm[(yi + 1) & 255]) & 255] & 7];
    const u = fade(xf);
    const v = fade(yf);
    const x1 = lerp(aa[0] * xf + aa[1] * yf, ba[0] * (xf - 1) + ba[1] * yf, u);
    const x2 = lerp(ab[0] * xf + ab[1] * (yf - 1), bb[0] * (xf - 1) + bb[1] * (yf - 1), u);
    return lerp(x1, x2, v);
  }

  function fbm(x, y, oct = 5, lac = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += n2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / norm;
  }

  return { n2, fbm };
}
