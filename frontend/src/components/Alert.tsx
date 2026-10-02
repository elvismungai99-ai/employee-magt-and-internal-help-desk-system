import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  className = '',
  onClose,
}) => {
  let styleClasses = 'bg-blue-50 border-blue-200 text-blue-800';
  let Icon = Info;

  switch (type) {
    case 'success':
      styleClasses = 'bg-green-50 border-green-200 text-green-800';
      Icon = CheckCircle2;
      break;
    case 'error':
      styleClasses = 'bg-red-50 border-red-200 text-red-800';
      Icon = XCircle;
      break;
    case 'warning':
      styleClasses = 'bg-yellow-50 border-yellow-200 text-yellow-800';
      Icon = AlertCircle;
      break;
    case 'info':
    default:
      styleClasses = 'bg-blue-50 border-blue-200 text-blue-800';
      Icon = Info;
      break;
  }

  return (
    <div className={`p-4 rounded-lg border flex items-start gap-3 ${styleClasses} ${className}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        {title && <h4 className="font-semibold mb-0.5">{title}</h4>}
        <p className="whitespace-pre-wrap">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 font-bold ml-2 text-sm"
        >
          ×
        </button>
      )}
    </div>
  );
};
