'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { deleteMemberPhotoAction, setMemberPhotoAction } from '../app/(dashboard)/members/actions';
import { IMAGE_ACCEPT } from '../lib/image-upload';
import { Alert, Avatar, Button } from './ui/index';

/**
 * Upload lives on the edit screen rather than the create form: the storage key
 * is scoped to a member id, which does not exist until the member is created,
 * and the adapter has no move operation to promote a staged file afterwards.
 */
export function MemberPhotoField({
  memberId,
  memberName,
  photoUrl,
}: {
  memberId: string;
  memberName: string;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setError(null);

    const body = new FormData();
    body.append('file', file);

    const response = await fetch(`/api/members/${memberId}/photo`, { method: 'POST', body });
    const payload = (await response.json()) as { url?: string; key?: string; error?: string };

    if (!response.ok || !payload.url || !payload.key) {
      setError(payload.error ?? 'Could not upload that photo.');
      return;
    }

    const saved = await setMemberPhotoAction({
      memberId,
      photoKey: payload.key,
      photoUrl: payload.url,
    });
    if (!saved.ok) {
      setError(saved.error);
      return;
    }

    setPreview(payload.url);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Avatar src={preview} name={memberName} size="lg" />

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset immediately so re-picking the same file fires onChange again.
              event.target.value = '';
              if (file) startTransition(() => void upload(file));
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? 'Uploading…' : preview ? 'Replace photo' : 'Add photo'}
            </Button>

            {preview ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteMemberPhotoAction({ memberId });
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setPreview(null);
                    router.refresh();
                  })
                }
              >
                Remove
              </Button>
            ) : null}
          </div>

          <p className="text-muted text-xs">
            JPEG, PNG or WebP, up to 4&nbsp;MB. Used to confirm identity at check-in.
          </p>
        </div>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
