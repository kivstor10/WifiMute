import React, { useState, useEffect, useCallback } from 'react';

// Define the expected props for this component
interface PinLockProps {
    onPinAttempt: (pin: string) => boolean;
}

const PIN_LENGTH = 4;
// Hardcoded PIN - simple deterrent, not intended for security against tech-savvy users
const HARDCODED_PIN = '1972';

// Keypad Button Component with mobile-optimized styling and inline fallbacks
const KeypadButton: React.FC<{ value: string | number, onClick: (value: string) => void, isUtility?: boolean }> = ({ value, onClick, isUtility = false }) => {
    const displayValue = value.toString();
    const isBackspace = displayValue === 'backspace';
    const isClear = displayValue === 'clear';
    const [isPressed, setIsPressed] = useState(false);

    // Inline style fallbacks ensure the keypad is usable even if Tailwind isn't applied
    const heightPx = 56; // mobile-friendly button height
    const baseStyle: React.CSSProperties = {
        width: '100%',
        height: `${heightPx}px`,
        borderRadius: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 150ms ease-out, background-color 150ms ease-out',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        transform: isPressed ? 'scale(0.92)' : 'scale(1)',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
    };

    const numberStyle: React.CSSProperties = {
        backgroundColor: isPressed ? '#374151' : '#1f2937', // gray-700 when pressed, gray-800 normal
        color: '#fff',
        fontSize: 20,
        fontWeight: 600,
    };

    const utilStyle: React.CSSProperties = {
        backgroundColor: 'transparent',
        color: isPressed ? '#D1D5DB' : '#9CA3AF', // gray-300 when pressed, gray-400 normal
        fontSize: 14,
        fontWeight: 500,
    };

    const style = Object.assign({}, baseStyle, isUtility ? utilStyle : numberStyle);

    const handleMouseDown = () => setIsPressed(true);
    const handleMouseUp = () => {
        setIsPressed(false);
        onClick(displayValue);
    };
    const handleMouseLeave = () => setIsPressed(false);

    return (
        <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
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
            // Check against hardcoded PIN directly
            const success = currentPin === HARDCODED_PIN;
            
            if (success) {
                console.log('PIN correct, unlocking...');
                onPinAttempt(currentPin); // Only call callback on success to trigger unlock
                setCurrentPin('');
            } else {
                console.log('PIN incorrect');
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
        // Full-screen lock screen overlay with gray-800 background to match buttons
        <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1f2937', // gray-800 - matches button background
        }}>
                {/* No separate background overlay needed - parent has solid navy background */}

                <div style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '28rem',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.5rem 1rem',
                }}>
                    <div className="text-center px-2">
                        <h2 className="text-2xl sm:text-3xl font-extrabold mb-1" style={{ color: '#ffffff' }}>Access Locked</h2>
                        <p className="text-gray-400 text-sm sm:text-base" style={{ color: '#ffffff' }}>Enter PIN to unlock network controls.</p>
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
                    <p className={`text-red-400 text-sm mt-4 transition-opacity duration-300 ${error ? 'opacity-100' : 'opacity-0'}`} style={{ color: '#f87171' }}>
                        Incorrect PIN. Please try again.
                    </p>
                </div>
            </div>
    );
};

export default PinLock;
