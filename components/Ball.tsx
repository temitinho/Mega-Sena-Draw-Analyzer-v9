
import React from 'react';

interface BallProps {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
}

const Ball: React.FC<BallProps> = ({ number, size = 'md', highlight = false }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl'
  };

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        flex items-center justify-center rounded-full font-bold 
        shadow-sm border-2 transition-all transform hover:scale-110
        ${highlight 
          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-400' 
          : 'bg-white text-gray-700 border-gray-200'}
      `}
    >
      {String(number).padStart(2, '0')}
    </div>
  );
};

export default Ball;
