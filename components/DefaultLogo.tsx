import React from 'react';

// The bundled default system logo, rendered inline (not via <img>) so it can
// adapt to light/dark mode: the "Tik" wordmark uses `currentColor` driven by
// Tailwind `dark:` text classes, while the monogram tile and the "Link" accent
// keep their brand colors (legible on any background). `direction: ltr` is
// forced so the Latin wordmark isn't reordered inside the RTL app shell.
// Used wherever no custom logo has been uploaded.
export const DefaultLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 430 150"
        className={`text-[#22394f] dark:text-gray-50 ${className || ''}`}
        style={{ direction: 'ltr' }}
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
        <rect x="5" y="5" width="140" height="140" rx="34" fill="url(#tlTileGrad)" />

        {/* White "T" whose stem flows into an "L" hook — a single clean mark */}
        <g fill="none" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
            <path d="M40 52 H112" />
            <path d="M76 52 V92 a20 20 0 0 0 20 20 H112" />
        </g>

        {/* Wordmark */}
        <text
            x="172"
            y="98"
            fontFamily="system-ui, 'Segoe UI', Arial, Helvetica, sans-serif"
            fontSize="66"
            fontWeight="700"
            textAnchor="start"
        >
            <tspan fill="currentColor">Tik</tspan>
            <tspan fill="#34a98a"> Link</tspan>
        </text>
    </svg>
);
