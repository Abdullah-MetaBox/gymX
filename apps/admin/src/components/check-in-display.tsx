'use client';

interface CheckInDisplayProps {
  memberName: string;
  status: 'granted' | 'denied';
  reason?: string;
  membershipType?: string;
  occupancy?: { current: number; max: number };
}

export function CheckInDisplay({
  memberName,
  status,
  reason,
  membershipType,
  occupancy,
}: CheckInDisplayProps) {
  const isGranted = status === 'granted';
  const bgColor = isGranted ? 'bg-[#10B981]/5' : 'bg-[#EF4444]/5';
  const borderColor = isGranted ? 'border-[#10B981]' : 'border-[#EF4444]';
  const textColor = isGranted ? 'text-[#10B981]' : 'text-[#EF4444]';
  const icon = isGranted ? '✓' : '✗';

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} p-8 text-center`}>
      {/* Large Icon */}
      <div className={`text-6xl mb-4 ${textColor}`}>{icon}</div>

      {/* Status Text */}
      <h1 className={`text-3xl font-bold mb-2 ${textColor}`}>
        {isGranted ? 'Access Granted' : 'Access Denied'}
      </h1>

      {/* Member Name */}
      <p className="text-xl font-semibold text-[#0B0B0F] mb-4">{memberName}</p>

      {/* Membership Type */}
      {membershipType && (
        <p className="text-sm text-[#6B7280] mb-4">
          Membership: <span className="font-medium text-[#0B0B0F]">{membershipType}</span>
        </p>
      )}

      {/* Reason (if denied) */}
      {reason && !isGranted && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-4 mb-6 max-w-sm mx-auto">
          <p className="text-sm font-medium text-[#0B0B0F]">Reason</p>
          <p className="text-sm text-[#6B7280] mt-1">{reason}</p>
        </div>
      )}

      {/* Occupancy (if granted) */}
      {occupancy && isGranted && (
        <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg p-4 max-w-sm mx-auto">
          <p className="text-sm font-medium text-[#0B0B0F]">Occupancy</p>
          <p className="text-2xl font-bold text-[#10B981] mt-1">
            {occupancy.current} / {occupancy.max}
          </p>
        </div>
      )}

      {/* Action Prompt */}
      {!isGranted && (
        <div className="mt-6 text-sm text-[#6B7280]">
          <p>Contact staff for assistance</p>
        </div>
      )}
    </div>
  );
}
