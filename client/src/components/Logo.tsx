/** Title lockup: a small bobbing submarine over the game's name. */

import { motion } from 'framer-motion';
import { INK } from '../lib/theme';

export function Logo({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="display text-lg font-extrabold leading-none tracking-tight text-foam">
        Deep Sea <span className="text-gold">Adventure</span>
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center text-center">
      <motion.svg
        width="92"
        height="58"
        viewBox="0 0 92 58"
        aria-hidden
        animate={{ y: [0, -4, 0], rotate: [0, -2, 0] }}
        transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut' }}
      >
        <g strokeLinejoin="round" stroke={INK} strokeWidth="3.5">
          <path d="M14 30 L4 22 V44 L14 38 Z" fill="#dca233" />
          <path d="M46 14 V6 H58" fill="none" strokeWidth="4.5" strokeLinecap="round" />
          <rect x="36" y="12" width="26" height="16" rx="6" fill="#f0c24b" />
          <rect x="10" y="22" width="78" height="32" rx="16" fill="#f0c24b" />
          <circle cx="32" cy="38" r="6" fill="#cfe9ec" strokeWidth="3" />
          <circle cx="50" cy="38" r="6" fill="#cfe9ec" strokeWidth="3" />
          <circle cx="68" cy="38" r="6" fill="#cfe9ec" strokeWidth="3" />
        </g>
      </motion.svg>
      <h1 className="display mt-2 text-4xl font-extrabold leading-[0.95] tracking-tight text-foam sm:text-5xl">
        Deep Sea
        <br />
        <span className="text-gold">Adventure</span>
      </h1>
      <p className="display mt-1 text-sm font-semibold tracking-[0.25em] text-foam/60 uppercase">Phiêu lưu biển sâu</p>
    </div>
  );
}
