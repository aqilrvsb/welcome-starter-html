import * as React from 'react';

const { createContext, useContext, useState, useEffect } = React;

interface OnboardingContextType {
  isOnboardingOpen: boolean;
  currentStep: number;
  totalSteps: number;
  isOnboardingCompleted: boolean;
  showOnboarding: () => void;
  hideOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Check if onboarding has been completed
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(() => {
    return localStorage.getItem('onboarding_completed') === 'true';
  });

  // Auto-show onboarding for new users
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('onboarding_completed');
    const dontShowAgain = localStorage.getItem('onboarding_dont_show_again');
    
    if (!hasSeenOnboarding && !dontShowAgain) {
      // Delay to allow page to load first
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const showOnboarding = () => {
    setIsOnboardingOpen(true);
    setCurrentStep(1);
  };

  const hideOnboarding = () => {
    setIsOnboardingOpen(false);
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setIsOnboardingCompleted(true);
    setIsOnboardingOpen(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('onboarding_completed');
    setIsOnboardingCompleted(false);
    setCurrentStep(1);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingOpen,
        currentStep,
        totalSteps,
        isOnboardingCompleted,
        showOnboarding,
        hideOnboarding,
        nextStep,
        prevStep,
        goToStep,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};