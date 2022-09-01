import { writable } from 'svelte/store';

export const brush = {
  atom: writable('sand'),
  noise: writable(24),
  radius: writable(12),
};

export const colors = {
  background: writable(Math.floor(Math.random() * 0xFFFFFF)),
  sand: Array.from({ length: 4 }, () => writable(Math.floor(Math.random() * 0xFFFFFF))),
  water: writable(Math.floor(Math.random() * 0xFFFFFF))
};

export const generator = {
  compute: writable(false),
  reset: writable(false),
  seed: Array.from({ length: 3 }, () => writable(Math.floor(Math.random() * 65536))),
  waterLevel: writable(Math.floor(16 + Math.random() * 32)),
};
