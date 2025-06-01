
import Image from 'next/image';
import type React from 'react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface VortexTunesLogoProps {
  className?: string;
  fallbackText?: string;
}

const VortexTunesLogo: React.FC<VortexTunesLogoProps> = ({ className, fallbackText = "VortexTunes Digital" }) => {
  const [imgError, setImgError] = useState(false);

  // Pastikan gambar 'vortextunes-logo.png' ada di dalam folder 'public'
  const imgSrc = "/vortextunes-logo.png";

  if (imgError) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <span className="font-headline text-primary text-sm sm:text-base whitespace-nowrap">{fallbackText}</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <Image
        src={imgSrc}
        alt="VortexTunes Logo"
        fill
        style={{ objectFit: 'contain' }}
        priority // Anggap logo adalah bagian penting (LCP)
        onError={() => {
          setImgError(true); // Jika gambar gagal dimuat, set error ke true
        }}
      />
    </div>
  );
};

export default VortexTunesLogo;
