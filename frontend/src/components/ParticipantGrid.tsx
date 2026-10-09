import React from 'react';
import type { Participant } from '../types/meeting';
import { ParticipantCard } from './ParticipantCard';

interface ParticipantGridProps {
  currentUser: Participant;
  participants: Participant[];
  isSidebarOpen?: boolean;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  currentUser,
  participants,
  isSidebarOpen = true,
}) => {
  const allParticipants = [currentUser, ...participants];
  const count = allParticipants.length;

  // Responsive Grid Class Selection based on participant count
  const getGridClass = () => {
    if (count === 1) {
      return 'flex items-center justify-center p-2 h-full';
    }
    if (count === 2) {
      return 'grid grid-cols-1 md:grid-cols-2 gap-4 h-full items-center p-1';
    }
    if (count <= 4) {
      return 'grid grid-cols-1 sm:grid-cols-2 gap-4 h-full auto-rows-fr p-1';
    }
    return `grid grid-cols-1 sm:grid-cols-2 ${
      isSidebarOpen ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'
    } gap-4 h-full auto-rows-fr overflow-y-auto p-1`;
  };

  return (
    <div className={`w-full h-full ${getGridClass()}`}>
      {count === 1 ? (
        <div className="w-full max-w-3xl aspect-video h-auto min-h-[320px] sm:min-h-[400px] mx-auto">
          <ParticipantCard
            participant={currentUser}
            isSelf={true}
          />
        </div>
      ) : (
        allParticipants.map((participant) => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            isSelf={participant.id === currentUser.id}
          />
        ))
      )}
    </div>
  );
};
