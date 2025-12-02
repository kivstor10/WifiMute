import React, { useState, useEffect, useCallback } from 'react';

// Define the expected props for this component
interface PinLockProps {
    onPinAttempt: (pin: string) => boolean;
}

const PIN_LENGTH = 4;

// Keypad Button Component with mobile-optimized styling and inline fallbacks
const KeypadButton: React.FC<{ value: string | number, onClick: (value: string) => void, isUtility?: boolean }> = ({ value, onClick, isUtility = false }) => {
    const displayValue = value.toString();
    const isBackspace = displayValue === 'backspace';
    const isClear = displayValue === 'clear';

    // Inline style fallbacks ensure the keypad is usable even if Tailwind isn't applied
    const heightPx = 56; // mobile-friendly button height
    const baseStyle: React.CSSProperties = {
        width: '100%',
        height: `${heightPx}px`,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 100ms',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
    };

    const numberStyle: React.CSSProperties = {
        backgroundColor: '#1f2937', // gray-800
        color: '#fff',
        fontSize: 20,
        fontWeight: 600,
        border: 'none',
    };

    const utilStyle: React.CSSProperties = {
        backgroundColor: 'transparent',
        color: '#9CA3AF', // gray-400
        fontSize: 14,
        fontWeight: 500,
        border: 'none',
    };

    const style = Object.assign({}, baseStyle, isUtility ? utilStyle : numberStyle);

    return (
        <button
            onClick={() => onClick(displayValue)}
            style={style}
        >
            {isBackspace ? (
                <span style={{ fontSize: 20 }}>⌫</span>
            ) : isClear ? (
                <span style={{ color: '#9CA3AF', fontSize: 13 }}>Clear</span>
            ) : (
                <span style={{ fontSize: 20, fontWeight: 600 }}>{displayValue}</span>
            )}
        </button>
    );
};

const PinLock: React.FC<PinLockProps> = ({ onPinAttempt }) => {
    const [currentPin, setCurrentPin] = useState('');
    const [error, setError] = useState(false);

    // Handles digit input
    const handleDigitClick = useCallback((digit: string) => {
        if (currentPin.length < PIN_LENGTH) {
            const newPin = currentPin + digit;
            setCurrentPin(newPin);
            setError(false);
            // debug: log current entry length
            // eslint-disable-next-line no-console
            console.log('PinLock input:', newPin);
        }
    }, [currentPin]);

    // Handles utility button clicks (Clear/Backspace)
    const handleUtilityClick = useCallback((action: string) => {
        if (action === 'clear') {
            setCurrentPin('');
            setError(false);
        } else if (action === 'backspace' && currentPin.length > 0) {
            setCurrentPin(currentPin.slice(0, -1));
            setError(false);
        }
    }, [currentPin]);

    // Effect to check PIN when length is met
    useEffect(() => {
        if (currentPin.length === PIN_LENGTH) {
            const success = onPinAttempt(currentPin);
            
            if (success) {
                setCurrentPin('');
            } else {
                setError(true);
                // Vibrate for haptic feedback on failure
                if (navigator.vibrate) {
                    navigator.vibrate(200);
                }
                setTimeout(() => {
                    setCurrentPin('');
                    setError(false);
                }, 1000);
            }
        }
    }, [currentPin, onPinAttempt]);

    // Render the PIN Display Dots (bigger on mobile) with inline style fallbacks
    const renderPinDots = () => {
        return Array.from({ length: PIN_LENGTH }).map((_, index) => {
            const filled = index < currentPin.length;
            const style: React.CSSProperties = {
                width: 20,
                height: 20,
                borderRadius: 9999,
                transition: 'all 200ms',
                border: '2px solid rgba(17,24,39,0.5)',
                backgroundColor: filled ? '#16A34A' : '#374151', // green-500 or gray-600
            };
            return <div key={index} style={style} />;
        });
    };

    return (
        // Overlay content rendered inside a fixed wrapper (wrapper provides fixed positioning and animation)
        <div className="relative w-full h-full flex items-center justify-center">
                {/* background overlay */}
                <div className="absolute inset-0 bg-gray-900 bg-opacity-95" />

                <div className="relative w-full max-w-md mx-auto flex flex-col items-center gap-4 px-4 py-6">
                    <div className="text-center px-2">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">Access Locked</h2>
                        <p className="text-gray-400 text-sm sm:text-base">Enter PIN to unlock network controls.</p>
                    </div>

                    {/* PIN Display Dots container */}
                    <div className="flex space-x-3 mt-2">
                        {renderPinDots()}
                    </div>

                    {/* Keypad Grid - give a max height so it never pushes past the viewport on mobile */}
                    <div className="w-full px-2">
                        <div className="grid grid-cols-3 gap-3 max-w-md w-full" style={{ maxHeight: '56vh' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <KeypadButton key={num} value={num} onClick={handleDigitClick} />
                            ))}

                            <KeypadButton value="clear" onClick={handleUtilityClick} isUtility />
                            <KeypadButton value={0} onClick={handleDigitClick} />
                            <KeypadButton value="backspace" onClick={handleUtilityClick} isUtility />
                        </div>
                    </div>

                    {/* Error Message */}
                    <p className={`text-red-400 text-sm mt-4 transition-opacity duration-300 ${error ? 'opacity-100' : 'opacity-0'}`}>
                        Incorrect PIN. Please try again.
                    </p>
                </div>
            </div>
    );
};

export default PinLock;
