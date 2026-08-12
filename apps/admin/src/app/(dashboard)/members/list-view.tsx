'use client';

import { useState } from 'react';
import { MemberCard } from '../../../components/member-card';
import { FilterChip } from '../../../components/filter-chip';

interface Member {
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

interface MemberListViewProps {
  members: Member[];
}

export function MemberListView({ members }: MemberListViewProps) {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const statuses = ['active', 'frozen', 'suspended', 'inactive'];

  const filteredMembers = selectedStatus
    ? members.filter((m) => m.status === selectedStatus)
    : members;

  return (
    <div className="space-y-6">
      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="All"
          selected={selectedStatus === null}
          onClick={() => setSelectedStatus(null)}
          icon="📋"
        />
        {statuses.map((status) => (
          <FilterChip
            key={status}
            label={status.charAt(0).toUpperCase() + status.slice(1)}
            selected={selectedStatus === status}
            onClick={() => setSelectedStatus(status)}
            icon={
              status === 'active'
                ? '✓'
                : status === 'frozen'
                  ? '❄'
                  : status === 'suspended'
                    ? '🚫'
                    : '○'
            }
          />
        ))}
      </div>

      {/* Member Cards Grid */}
      {filteredMembers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <MemberCard key={member.id} {...member} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-[#6B7280]">No members found</p>
        </div>
      )}

      <p className="text-sm text-[#6B7280] text-center">
        Showing {filteredMembers.length} of {members.length} members
      </p>
    </div>
  );
}
