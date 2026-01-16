import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export function Input({ label, error, helperText, className = '', ...props }: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {label}
                </label>
            )}
            <input
                className={`w-full px-4 py-2.5 bg-white border rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 hover:border-gray-300'
                    } ${className}`}
                {...props}
            />
            {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
            {helperText && !error && <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>}
        </div>
    );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {label}
                </label>
            )}
            <textarea
                className={`w-full px-4 py-2.5 bg-white border rounded-xl text-gray-900 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 hover:border-gray-300'
                    } ${className}`}
                {...props}
            />
            {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
        </div>
    );
}
