import { cn } from '../../Library/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children: React.ReactNode;
}

const badgeVariants = {
  default: "bg-primary text-on-primary hover:bg-primary/80",
  secondary: "bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80",
  destructive: "bg-error text-on-error hover:bg-error/80",
  outline: "text-on-surface border border-outline hover:bg-surface-variant",
};

export function Badge({ 
  className, 
  variant = 'default', 
  children, 
  ...props 
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}