import { createContext, useContext, useState, type ReactNode } from 'react';

type OutingContextValue = {
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  departurePlace: string;
  setDeparturePlace: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  transport: string;
  setTransport: (value: string) => void;
  specialRequests: string;
  setSpecialRequests: (value: string) => void;
};

const OutingContext = createContext<OutingContextValue | null>(null);

export function OutingProvider({ children }: { children: ReactNode }) {
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('16:00');
  const [departurePlace, setDeparturePlace] = useState('自宅');
  const [budget, setBudget] = useState('15000');
  const [transport, setTransport] = useState('車');
  const [specialRequests, setSpecialRequests] = useState('');

  return (
    <OutingContext.Provider
      value={{
        startTime,
        setStartTime,
        endTime,
        setEndTime,
        departurePlace,
        setDeparturePlace,
        budget,
        setBudget,
        transport,
        setTransport,
        specialRequests,
        setSpecialRequests,
      }}
    >
      {children}
    </OutingContext.Provider>
  );
}

export function useOuting() {
  const context = useContext(OutingContext);
  if (!context) {
    throw new Error('useOuting must be used within OutingProvider');
  }
  return context;
}
