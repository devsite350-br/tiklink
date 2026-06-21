
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Trash2, PenTool } from 'lucide-react';

interface SignatureCanvasProps {
    onSignatureChange: (dataUrl: string | null) => void;
    disabled?: boolean;
    initialSignature?: string;
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ onSignatureChange, disabled = false, initialSignature }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2.5;

        if (initialSignature) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
                setHasSignature(true);
            };
            img.src = initialSignature;
        }
    }, [initialSignature]);

    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (disabled) return;
        e.preventDefault();
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
    }, [disabled, getPos]);

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || disabled) return;
        e.preventDefault();
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        setHasSignature(true);
    }, [isDrawing, disabled, getPos]);

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas && hasSignature) {
            onSignatureChange(canvas.toDataURL('image/png'));
        }
    }, [isDrawing, hasSignature, onSignatureChange]);

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        setHasSignature(false);
        onSignatureChange(null);
    };

    return (
        <div className="space-y-2">
            <div className={`relative border-2 border-dashed rounded-xl overflow-hidden transition-colors ${disabled ? 'border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5' : 'border-gray-300 dark:border-white/20 bg-white dark:bg-base-950 hover:border-primary/50'}`}>
                <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height: '160px' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                {!hasSignature && !disabled && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 dark:text-gray-600 text-sm">
                        חתום כאן ✍️
                    </div>
                )}
            </div>
            {!disabled && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    נקה חתימה
                </button>
            )}
        </div>
    );
};
