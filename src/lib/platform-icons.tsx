import type { LucideIcon } from 'lucide-react';
import { Disc3, Headphones, Youtube, Speaker, Music2, Music, RadioTower } from 'lucide-react';

interface PlatformIconsMap {
  [key: string]: LucideIcon;
}

const platformIcons: PlatformIconsMap = {
  spotify: Disc3,
  'apple music': Headphones,
  'youtube music': Youtube,
  youtube: Youtube,
  amazon: Speaker,
  'amazon music': Speaker,
  deezer: RadioTower,
  tidal: Music,
  default: Music2,
};

export const getPlatformIcon = (platformName: string): LucideIcon => {
  const lowerPlatformName = platformName.toLowerCase();
  for (const key in platformIcons) {
    if (lowerPlatformName.includes(key)) {
      return platformIcons[key];
    }
  }
  return platformIcons.default;
};
