interface BadgeProps {
  label: string;
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-slate-100 text-slate-600',
};

export default function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {label}
    </span>
  );
}
