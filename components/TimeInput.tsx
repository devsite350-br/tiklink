import React, { useState, useEffect } from 'react';

interface TimeInputProps {
    valueMs: number;
    onChange: (newMs: number) => void;
    className?: string;
    placeholder?: string;
}

export const formatTime = (ms: number): string => {
    if (!ms || isNaN(ms)) return "00:00";
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}`;
};

export const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return (hours * 3600000) + (minutes * 60000);
};

export const TimeInput: React.FC<TimeInputProps> = ({ valueMs, onChange, className, placeholder = "00:00" }) => {
    const [text, setText] = useState(formatTime(valueMs));

    // Update local state when prop changes externally
    useEffect(() => {
        setText(formatTime(valueMs));
    }, [valueMs]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9]/g, ''); // strict numbers
        if (val.length > 4) val = val.substring(0, 4);

        if (val.length > 2) {
            val = val.substring(0, 2) + ':' + val.substring(2);
        }

        setText(val);
    };

    const handleBlur = () => {
        let val = text.replace(/[^0-9]/g, '');

        if (val.length === 0) {
            onChange(0);
            setText("00:00");
            return;
        }

        // Pad logic: 
        // 1 digit -> 00:0X
        // 2 digits -> 00:XX
        // 3 digits -> 0X:XX
        // 4 digits -> XX:XX
        if (val.length === 1) val = "000" + val;
        else if (val.length === 2) val = "00" + val;
        else if (val.length === 3) val = "0" + val;

        const hours = parseInt(val.substring(0, 2));
        const minutes = parseInt(val.substring(2, 4));

        const newMs = (hours * 3600000) + (minutes * 60000);
        onChange(newMs);
        setText(formatTime(newMs));
    };

    return (
        <input
            type="text"
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={className}
            placeholder={placeholder}
            dir="ltr"
        />
    );
};
