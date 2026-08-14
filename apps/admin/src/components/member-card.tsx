'use client';

import Link from 'next/link';
import { memo } from 'react';
import { StatusBadge } from './status-badge';

interface MemberCardProps {
  id: string;
  name: string;
  memberCode: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'suspended' | 'frozen';
  membershipType?: string;
  household?: { name: string; memberCount: number };
  joinedDate?: string;
}

function MemberCardComponent({
  id,
  name,
  memberCode,
  email,
  phone,
  status,
  membershipType,
  household,
  joinedDate,
}: MemberCardProps) {
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="rounded-lg border border-[#D1D5DB] dark:border-[#4B5563] bg-white dark:bg-[#2D2D35] p-5 hover:shadow-lg hover:border-[#9CA3AF] dark:hover:border-[#6B7280] transition cursor-pointer">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[#0B0B0F] dark:text-[#E5E7EB]">{name}</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">ID: {memberCode}</p>
        </div>
        <StatusBadge status={status as any} label={statusLabel} size="sm" />
      </div>

      <div className="space-y-2 mb-4 text-sm">
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">{email}</p>
        <p className="text-[#6B7280] dark:text-[#9CA3AF]">{phone}</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-4 pb-4 border-t border-[#D1D5DB] dark:border-[#4B5563] pt-4">
        <div className="flex items-center gap-4">
          {membershipType && (
            <span className="text-xs font-medium text-[#0B0B0F] dark:text-[#E5E7EB] bg-[#F3F4F6] dark:bg-[#3F3F47] px-2 py-1 rounded">
              {membershipType}
            </span>
          )}
          {household && (
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              👥 {household.name} ({household.memberCount})
            </span>
          )}
          {joinedDate && (
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Joined {joinedDate}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/members/${id}`}
          className="flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg bg-[#F3F4F6] dark:bg-[#3F3F47] text-[#0B0B0F] dark:text-[#E5E7EB] hover:bg-[#E5E7EB] dark:hover:bg-[#4B5563] transition"
        >
          View
        </Link>
        <Link
          href={`/members/${id}/edit`}
          className="flex-1 text-center px-3 py-2 text-sm font-medium rounded-lg border border-[#D1D5DB] dark:border-[#4B5563] text-[#0B0B0F] dark:text-[#E5E7EB] hover:bg-[#F9FAFB] dark:hover:bg-[#3F3F47] transition"
        >
          Edit
        </Link>
        <button className="px-3 py-2 text-sm font-medium rounded-lg border border-[#D1D5DB] dark:border-[#4B5563] text-[#0B0B0F] dark:text-[#E5E7EB] hover:bg-[#F9FAFB] dark:hover:bg-[#3F3F47] transition">
          More
        </button>
      </div>
    </div>
  );
}

export const MemberCard = memo(MemberCardComponent);
