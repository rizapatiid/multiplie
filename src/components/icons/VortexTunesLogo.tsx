
import Image from 'next/image';
import type React from 'react';
import { cn } from '@/lib/utils';

interface VortexTunesLogoProps {
  className?: string;
}

const VortexTunesLogo: React.FC<VortexTunesLogoProps> = ({ className }) => {
  return (
    <div className={cn('relative', className)}>
      <Image
        src="/vortextunes-logo.png" // User needs to place this file in the public folder
        alt="VortexTunes Logo"
        fill
        style={{ objectFit: 'contain' }} // 'contain' respects aspect ratio within bounds
        priority // Assuming it's an important logo, possibly in LCP
      />
    </div>
  );
};

export default VortexTunesLogo;
