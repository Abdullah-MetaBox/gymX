'use client';

interface FilterChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function FilterChip({ label, icon, selected, onClick, size = 'md' }: FilterChipProps) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-sm';

  if (selected) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap transition cursor-pointer ${sizeClass} bg-[#00FF41] text-[#0B0B0F] hover:bg-[#00E63A] dark:text-[#0B0B0F]`}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap border border-[#D1D5DB] dark:border-[#4B5563] text-[#6B7280] dark:text-[#A0A0A8] hover:border-[#9CA3AF] dark:hover:border-[#6B7280] hover:text-[#0B0B0F] dark:hover:text-[#FFFFFF] hover:bg-[#F9FAFB] dark:hover:bg-[#2D2D35] transition cursor-pointer ${sizeClass}`}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
