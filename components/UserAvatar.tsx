
import React from 'react';

interface UserAvatarProps {
    name?: string;
    photoUrl?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
    showTooltip?: boolean;
}

const SIZE_MAP = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
};

const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

// Generate a consistent color based on the name
const getAvatarColor = (name: string): string => {
    const colors = [
        'from-blue-500 to-blue-600',
        'from-sky-500 to-sky-600',
        'from-emerald-500 to-emerald-600',
        'from-amber-500 to-amber-600',
        'from-pink-500 to-pink-600',
        'from-cyan-500 to-cyan-600',
        'from-lime-500 to-lime-600',
        'from-rose-500 to-rose-600',
        'from-teal-500 to-teal-600',
        'from-orange-500 to-orange-600',
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ name = '', photoUrl, size = 'sm', className = '', showTooltip = true }) => {
    const sizeClass = SIZE_MAP[size];
    const initials = getInitials(name);
    const colorClass = getAvatarColor(name);

    return (
        <div
            className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 ${sizeClass} ${className}`}
            title={showTooltip ? name : undefined}
        >
            {photoUrl ? (
                <img
                    src={photoUrl}
                    alt={name}
                    className={`${sizeClass} rounded-full object-cover ring-2 ring-white dark:ring-base-800 shadow-sm`}
                    referrerPolicy="no-referrer"
                />
            ) : (
                <div className={`${sizeClass} rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold ring-2 ring-white dark:ring-base-800 shadow-sm select-none`}>
                    {initials}
                </div>
            )}
        </div>
    );
};

export default UserAvatar;
