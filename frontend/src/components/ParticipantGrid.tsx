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

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${
        isSidebarOpen ? 'xl:grid-cols-2' : 'xl:grid-cols-3'
      } gap-4 overflow-y-auto p-1`}
    >
      {allParticipants.map((participant) => (
        <ParticipantCard
          key={participant.id}
          participant={participant}
          isSelf={participant.id === currentUser.id}
        />
      ))}
    </div>
  );
};
