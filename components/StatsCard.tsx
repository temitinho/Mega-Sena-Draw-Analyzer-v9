
import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, color = "bg-white" }) => {
  return (
    <div className={`${color} p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 transition-all hover:shadow-md`}>
      {icon && (
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

export default StatsCard;
