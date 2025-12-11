import { type FC } from 'react';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  name: string;
  description: string;
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
}

/**
 * Wizard stepper component showing progress through multi-step flow
 */
export const WizardStepper: FC<WizardStepperProps> = ({
  steps,
  currentStep,
  completedSteps,
}) => {
  // Calculate progress percentage
  const progressPercentage = Math.round((completedSteps.length / steps.length) * 100);

  // Find current step info for mobile display
  const currentStepInfo = steps.find(s => s.id === currentStep);

  return (
    <nav aria-label="Registration progress">
      {/* Progress bar */}
      <div className="mb-3 sm:mb-4">
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <span className="text-xs sm:text-sm font-medium text-white" id="progress-label">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-xs sm:text-sm font-medium text-orange-200" aria-live="polite">
            {progressPercentage}% Complete
          </span>
        </div>
        <div className="w-full bg-turquoise-900/50 rounded-full h-1.5 sm:h-2" role="presentation">
          <div
            className="bg-orange-500 h-1.5 sm:h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-valuenow={progressPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-labelledby="progress-label"
            aria-label={`Registration progress: ${progressPercentage}% complete`}
          />
        </div>
      </div>

      {/* Step indicators */}
      <ol className="flex items-center justify-between" role="list">
        {steps.map((step, stepIdx) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = step.id === currentStep;

          // Build status text for screen readers
          let statusText = '';
          if (isCompleted) {
            statusText = 'Completed';
          } else if (isCurrent) {
            statusText = 'Current step';
          } else {
            statusText = 'Not started';
          }

          return (
            <li
              key={step.id}
              className={`relative ${stepIdx !== steps.length - 1 ? 'flex-1' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* Connector line */}
              {stepIdx !== steps.length - 1 && (
                <div
                  className="absolute left-1/2 top-3 sm:top-4 h-0.5 w-full -translate-y-1/2"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full ${
                      isCompleted || completedSteps.some((s) => s > step.id)
                        ? 'bg-orange-500'
                        : 'bg-turquoise-900/50'
                    }`}
                  />
                </div>
              )}

              <div className="group relative flex flex-col items-center">
                {/* Step circle - smaller on mobile */}
                <span
                  className={`relative z-10 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : isCurrent
                        ? 'border-orange-500 bg-white text-orange-500'
                        : 'border-turquoise-900/50 bg-white text-turquoise-900/50'
                  }`}
                  aria-label={`Step ${step.id}: ${step.name} - ${statusText}`}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 sm:h-5 sm:w-5" aria-hidden="true" />
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold" aria-hidden="true">{step.id}</span>
                  )}
                </span>

                {/* Step label - hidden on mobile, shown on sm+ */}
                <span className="mt-1.5 sm:mt-2 text-center hidden sm:block">
                  <span
                    className={`block text-sm font-medium ${
                      isCurrent ? 'text-white' : isCompleted ? 'text-orange-200' : 'text-turquoise-300'
                    }`}
                    aria-hidden="true"
                  >
                    {step.name}
                  </span>
                  <span className={`hidden text-xs md:block ${
                    isCurrent ? 'text-orange-200' : 'text-turquoise-400'
                  }`}
                  aria-hidden="true">
                    {step.description}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Current step label - shown only on mobile */}
      {currentStepInfo && (
        <div className="mt-3 text-center sm:hidden">
          <span className="text-sm font-medium text-white">
            {currentStepInfo.name}
          </span>
          <span className="block text-xs text-orange-200 mt-0.5">
            {currentStepInfo.description}
          </span>
        </div>
      )}
    </nav>
  );
};
