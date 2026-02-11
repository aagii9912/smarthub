import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { X, Search } from 'lucide-react';

/* ─── Base Input ─── */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    label?: string;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, label, leftIcon, rightIcon, ...props }, ref) => (
        <div className="relative w-full">
            {label && <label className="block text-sm font-medium text-foreground/70 mb-1">{label}</label>}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        {leftIcon}
                    </div>
                )}
                <input
                    type={type}
                    className={cn(
                        'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground',
                        'placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'transition-colors duration-200',
                        leftIcon && 'pl-10',
                        rightIcon && 'pr-10',
                        error && 'border-destructive focus:ring-destructive/20',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {rightIcon}
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
    )
);
Input.displayName = 'Input';

/* ─── Search Input ─── */
interface SearchInputProps extends Omit<InputProps, 'leftIcon'> {
    onClear?: () => void;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    ({ className, onClear, value, ...props }, ref) => (
        <Input
            ref={ref}
            type="search"
            leftIcon={<Search className="h-4 w-4" />}
            rightIcon={
                value ? (
                    <button
                        type="button"
                        onClick={onClear}
                        className="hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                ) : undefined
            }
            value={value}
            className={cn('h-9', className)}
            {...props}
        />
    )
);
SearchInput.displayName = 'SearchInput';

/* ─── Textarea ─── */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: string;
    label?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, error, label, ...props }, ref) => (
        <div>
            {label && <label className="block text-sm font-medium text-foreground/70 mb-1">{label}</label>}
            <textarea
                className={cn(
                    'flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-foreground/30',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'resize-y transition-colors duration-200',
                    error && 'border-destructive focus:ring-destructive/20',
                    className
                )}
                ref={ref}
                {...props}
            />
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
    )
);
Textarea.displayName = 'Textarea';

/* ─── Label ─── */
const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ className, ...props }, ref) => (
        <label
            ref={ref}
            className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
            {...props}
        />
    )
);
Label.displayName = 'Label';

export { Input, SearchInput, Textarea, Label };
