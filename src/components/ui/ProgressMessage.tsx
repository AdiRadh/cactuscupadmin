import { type FC, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProgressMessageProps {
  message: string;
  estimatedSeconds?: number;
  showTimer?: boolean;
}

/**
 * Progress message component for long-running operations
 * Shows a message with optional countdown timer
 */
export const ProgressMessage: FC<ProgressMessageProps> = ({
  message,
  estimatedSeconds,
  showTimer = true,
}) => {
  const [remainingSeconds, setRemainingSeconds] = useState(estimatedSeconds || 0);

  useEffect(() => {
    if (!showTimer || !estimatedSeconds) return;

    setRemainingSeconds(estimatedSeconds);

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [estimatedSeconds, showTimer]);

  return (
    <div className="flex items-center justify-center space-x-3 text-orange-200">
      <Loader2 className="h-5 w-5 animate-spin" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{message}</span>
        {showTimer && estimatedSeconds && remainingSeconds > 0 && (
          <span className="text-xs text-orange-300">
            Estimated time: {remainingSeconds} second{remainingSeconds !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};
