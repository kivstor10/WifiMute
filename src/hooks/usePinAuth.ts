import { useState, useEffect, useCallback } from 'react';

// Custom hook to manage the application lock state
export const usePinAuth = () => {
    const [isLocked, setIsLocked] = useState(true);

    // Forces the application into the locked state
    const lockApp = useCallback(() => {
        if (!isLocked) {
            console.log("Locking application due to inactivity or visibility change.");
            setIsLocked(true);
        }
    }, [isLocked]);

    // Unlocks the application - validation is done in PinLock component with hardcoded PIN
    const attemptUnlock = useCallback((_pin: string): boolean => {
        // PinLock component handles validation with hardcoded PIN
        // This function is only called when PIN is correct
        setIsLocked(false);
        console.log("Unlocking application.");
        return true;
    }, []);


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
