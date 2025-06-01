
import type React from 'react';

interface VortexTunesLogoProps extends React.SVGProps<SVGSVGElement> {
  // Props for className, width, height can be passed directly
}

const VortexTunesLogo: React.FC<VortexTunesLogoProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 230 32" 
    aria-label="VortexTunes Logo"
    {...props}
  >
    {/* VT Symbol - Simplified representation */}
    <g id="vt-symbol">
      {/* Blue left V-stroke */}
      <path d="M0 2 L6 2 L16 28 L10 28 Z" fill="#0059A9" />
      {/* Yellow right T-stroke (also part of V) */}
      <path d="M17 2 L23 2 L33 28 L27 28 Z" fill="#F9B200" />
      {/* Top Blue Bar (to make V top flat and connect) */}
      <path d="M0 0 L23 0 L21 2 L2 2 Z" fill="#0059A9" />
       {/* Small Yellow top bar for T illusion */}
      <path d="M21 0 L30 0 L28 2 L19 2 Z" fill="#F9B200" />
    </g>

    {/* Text: VORTEXTUNES */}
    <text
      x="40" 
      y="23" 
      fontFamily="Arial, Helvetica, sans-serif" 
      fontSize="20"
      fontWeight="bold"
      letterSpacing="0.2"
    >
      <tspan fill="#0059A9">VORTEX</tspan>
      <tspan fill="#F9B200">TUNES</tspan>
    </text>
  </svg>
);

export default VortexTunesLogo;
