import { useState, useEffect, useCallback } from 'react';

const PIN_KEY = "networkAppPin";
const DEFAULT_PIN = "1234";

// Utility function to ensure the PIN is initialized in local storage
const getStoredPin = (): string => {
    let pin = localStorage.getItem(PIN_KEY);
    if (!pin) {
        localStorage.setItem(PIN_KEY, DEFAULT_PIN);
        console.log("Default PIN set for first use: 1234");
        pin = DEFAULT_PIN;
    }
    return pin;
};

// Custom hook to manage the application lock state
export const usePinAuth = () => {
    const [isLocked, setIsLocked] = useState(true);
    const correctPin = getStoredPin();

    // Forces the application into the locked state
    const lockApp = useCallback(() => {
        if (!isLocked) {
            console.log("Locking application due to inactivity or visibility change.");
            setIsLocked(true);
        }
    }, [isLocked]);

    // Attempts to unlock the application with the provided PIN
    const attemptUnlock = useCallback((pin: string): boolean => {
        if (pin === correctPin) {
            setIsLocked(false);
            console.log("PIN accepted. Unlocking.");
            return true;
        }
        console.log("Incorrect PIN entered.");
        return false;
    }, [correctPin]);


    // Effect for the visibilitychange listener (Part 2, Item 3)
    useEffect(() => {
        let lastHiddenTime = 0;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // App is minimized/hidden
                lastHiddenTime = Date.now();
            } else {
                // App is brought back into view
                const timeHidden = Date.now() - lastHiddenTime;

                // Lock only if hidden for more than 1 second (to prevent false triggers)
                // We check !isLocked to prevent locking when the lock screen is already active
                if (timeHidden > 1000 && !isLocked) {
                    lockApp();
                }
            }
        };

        // Attach listener
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup listener on component unmount
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [lockApp, isLocked]);

    return {
        isLocked,
        attemptUnlock,
        lockApp, // Exposed if manual locking is ever needed
    };
};

export default usePinAuth;
