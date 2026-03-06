import { motion } from 'motion/react';
import { PetState } from '../constants';

export function BongoCat({ state }: { state: PetState }) {
  return (
    <svg width="160" height="120" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-xl">
      {/* Body */}
      <path d="M20 150C20 90 50 50 100 50C150 50 180 90 180 150" fill="#ffffff" stroke="#1e293b" strokeWidth="6"/>
      
      {/* Ears */}
      <path d="M30 70L45 15L80 55" fill="#ffffff" stroke="#1e293b" strokeWidth="6" strokeLinejoin="round"/>
      <path d="M170 70L155 15L120 55" fill="#ffffff" stroke="#1e293b" strokeWidth="6" strokeLinejoin="round"/>
      
      {/* Inner Ears */}
      <path d="M42 35L48 25L70 50" fill="#fecdd3" />
      <path d="M158 35L152 25L130 50" fill="#fecdd3" />

      {/* Eyes */}
      <circle cx="65" cy="90" r="6" fill="#1e293b"/>
      <circle cx="135" cy="90" r="6" fill="#1e293b"/>
      
      {/* Blushes */}
      <ellipse cx="45" cy="100" rx="8" ry="4" fill="#fecdd3" opacity="0.8"/>
      <ellipse cx="155" cy="100" rx="8" ry="4" fill="#fecdd3" opacity="0.8"/>

      {/* Mouth */}
      <path d="M90 100 Q100 110 110 100" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round"/>
      
      {/* Paws */}
      {/* Left Paw */}
      <motion.g
        animate={state === 'typing' ? { y: [0, -20, 0] } : { y: 0 }}
        transition={{ repeat: Infinity, duration: 0.15, ease: "easeInOut" }}
      >
        <path d="M25 150 Q25 115 50 115 Q75 115 75 150" fill="#ffffff" stroke="#1e293b" strokeWidth="6"/>
      </motion.g>
      
      {/* Right Paw */}
      <motion.g
        animate={state === 'typing' ? { y: [0, -20, 0] } : state === 'thinking' ? { y: -45, x: -25, rotate: -15 } : { y: 0 }}
        transition={state === 'typing' ? { repeat: Infinity, duration: 0.15, delay: 0.075, ease: "easeInOut" } : { duration: 0.3, type: "spring" }}
      >
        <path d="M125 150 Q125 115 150 115 Q175 115 175 150" fill="#ffffff" stroke="#1e293b" strokeWidth="6"/>
      </motion.g>

      {/* Laptop */}
      <path d="M30 150 L55 115 L145 115 L170 150 Z" fill="#cbd5e1" stroke="#1e293b" strokeWidth="6" strokeLinejoin="round"/>
      <path d="M55 115 L145 115 L145 108 L55 108 Z" fill="#94a3b8" stroke="#1e293b" strokeWidth="6" strokeLinejoin="round"/>
      
      {/* Apple Logo on Laptop (Joke) */}
      <circle cx="100" cy="135" r="6" fill="#f8fafc" opacity="0.8"/>
    </svg>
  );
}
