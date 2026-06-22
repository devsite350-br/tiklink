import React from 'react';

// The bundled default system logo, rendered inline (not via <img>) so it can
// adapt to light/dark mode: the wordmark + tagline use `currentColor` driven by
// Tailwind `dark:` text classes, while the monogram tile and the "Link" accent
// keep their brand colors (legible on any background). Used wherever no custom
// logo has been uploaded.
export const DefaultLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 600 180"
        className={`text-[#22394f] dark:text-gray-50 ${className || ''}`}
        role="img"
        aria-label="Tik Link"
        xmlns="http://www.w3.org/2000/svg"
    >
        <defs>
            <linearGradient id="tlTileGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3bb491" />
                <stop offset="1" stopColor="#234a63" />
            </linearGradient>
        </defs>

        {/* Monogram tile */}
        <rect x="10" y="10" width="160" height="160" rx="42" fill="url(#tlTileGrad)" />

        {/* White "T" whose stem flows into an "L" hook — a single clean mark */}
        <g fill="none" stroke="#ffffff" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
            {/* T bar */}
            <path d="M55 63 H125" />
            {/* T stem flowing down into a rightward foot (the L) */}
            <path d="M90 63 V108 a26 26 0 0 0 26 26 H128" />
        </g>

        {/* Wordmark */}
        <text
            x="196"
            y="108"
            fontFamily="Segoe UI, Arial, Helvetica, sans-serif"
            fontSize="74"
            fontWeight="700"
        >
            <tspan fill="currentColor">Tik</tspan>
            <tspan fill="#34a98a"> Link</tspan>
        </text>

        {/* Hebrew tagline with side rules */}
        <line x1="300" y1="146" x2="330" y2="146" stroke="#34a98a" strokeWidth="3" strokeLinecap="round" />
        <line x1="540" y1="146" x2="570" y2="146" stroke="#34a98a" strokeWidth="3" strokeLinecap="round" />
        <text
            x="435"
            y="153"
            textAnchor="middle"
            fontFamily="Segoe UI, Arial, Helvetica, sans-serif"
            fontSize="23"
            fontWeight="500"
            fill="currentColor"
            opacity="0.65"
            direction="rtl"
        >
            ניהול תיק לקוח חכם
        </text>
    </svg>
);
