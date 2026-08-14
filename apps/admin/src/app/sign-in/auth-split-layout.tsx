import type { ReactNode } from 'react';

/**
 * The two-panel sign-in shell.
 *
 * The form lives on the left and is passed in, so swapping the auth provider
 * changes what fills this slot and nothing about the page around it.
 *
 * The right panel collapses below `lg` rather than stacking: on a phone at the
 * front desk, a full-height brand panel above the form would push the password
 * field off-screen.
 */
export function AuthSplitLayout({
  form,
  brandName,
  brandTagline,
  logoUrl,
  primaryColor,
  accentColor,
  points,
}: {
  form: ReactNode;
  brandName: string;
  brandTagline: string;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  points: string[];
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: whatever signs the user in */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{form}</div>
      </div>

      {/* Right: the gym's own identity */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{
          backgroundColor: primaryColor,
          backgroundImage: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
        }}
      >
        {/* Soft geometry, drawn rather than loaded: no asset to ship, and no
            broken image if a gym has not uploaded one. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55) 0, transparent 45%), radial-gradient(circle at 85% 70%, rgba(255,255,255,.35) 0, transparent 40%)',
          }}
        />

        <div className="relative">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="mb-6 h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="mb-6 inline-block h-10 w-1.5 rounded-full bg-white/80" aria-hidden />
          )}
          <p className="font-semibold text-2xl tracking-tight">{brandName}</p>
        </div>

        <div className="relative">
          <p className="max-w-md font-semibold text-4xl leading-tight tracking-tight">
            {brandTagline}
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-white/85">
                <span aria-hidden className="mt-1 text-sm">
                  ●
                </span>
                <span className="text-sm">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-white/60 text-xs">Powered by GymX · Metabox</p>
      </div>
    </div>
  );
}
