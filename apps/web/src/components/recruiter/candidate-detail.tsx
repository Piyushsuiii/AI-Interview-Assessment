'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react';
import {
  apiRequest,
  getCollection,
  getErrorMessage,
  type Assessment,
  type Candidate,
} from '@/lib/api';
import { useRecruiterApp } from './app-shell';
import { EmptyState, ErrorState, PageSkeleton, Select, SubmitButton } from './ui';

export function CandidateDetail({ id }: { id: string }) {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? '';
  const key = `${organizationId}:${id}`;
  const [state, setState] = useState<{
    key: string;
    candidate: Candidate | null;
    assessments: Assessment[];
    error: string;
  }>({ key: '', candidate: null, assessments: [], error: '' });
  const [retry, setRetry] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [invitationUrl, setInvitationUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    Promise.all([
      apiRequest<Candidate>(
        `/organizations/${organizationId}/candidates/${encodeURIComponent(id)}`,
        {},
        organizationId,
      ),
      apiRequest<Assessment[] | { items?: Assessment[]; assessments?: Assessment[] }>(
        `/organizations/${organizationId}/assessments`,
        {},
        organizationId,
      ),
    ])
      .then(
        ([candidate, assessments]) =>
          active &&
          setState({
            key,
            candidate,
            assessments: getCollection(assessments).filter(
              (assessment) => assessment.status === 'PUBLISHED',
            ),
            error: '',
          }),
      )
      .catch(
        (error: unknown) =>
          active &&
          setState({ key, candidate: null, assessments: [], error: getErrorMessage(error) }),
      );
    return () => {
      active = false;
    };
  }, [id, key, organizationId, retry]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const assessmentId = String(new FormData(event.currentTarget).get('assessmentId'));
    setInviting(true);
    setInviteError('');
    setInvitationUrl('');
    setCopied(false);
    try {
      const result = await apiRequest<{ invitationUrl?: string; url?: string }>(
        `/organizations/${organization.id}/candidates/${encodeURIComponent(id)}/invite`,
        { method: 'POST', body: JSON.stringify({ assessmentId }) },
        organization.id,
      );
      const url = result.invitationUrl ?? result.url;
      if (!url)
        throw new Error(
          'The invitation was created, but the API did not return an invitation URL.',
        );
      setInvitationUrl(url);
    } catch (error) {
      setInviteError(getErrorMessage(error));
    } finally {
      setInviting(false);
    }
  }

  if (!organization)
    return (
      <EmptyState
        title="No organization available"
        description="Select an organization before viewing a candidate."
      />
    );
  if (state.key !== key) return <PageSkeleton />;
  if (state.error)
    return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;
  if (!state.candidate)
    return (
      <EmptyState
        title="Candidate not found"
        description="This candidate is unavailable or no longer exists."
      />
    );
  const candidate = state.candidate;
  const name =
    [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.email;

  return (
    <div className="space-y-8">
      <Link
        href="/candidates"
        className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> Back to candidates
      </Link>
      <header className="border-b border-[#303030] pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">
          Candidate record
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{name}</h1>
        <p className="mt-3 text-sm text-[#aaa6a0]">
          {candidate.email} <span className="mx-2 text-[#555]">/</span>{' '}
          {candidate.job?.title || 'Job unavailable'}
        </p>
        {candidate.resumeUrl ? (
          <a
            href={candidate.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-xs text-[#ff8a68] hover:text-white"
          >
            Open resume <ExternalLink className="size-3" />
          </a>
        ) : (
          <p className="mt-4 text-xs text-[#777]">No resume URL provided.</p>
        )}
      </header>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">
            Interview history
          </h2>
          {candidate.interviews?.length ? (
            <div className="mt-4 divide-y divide-[#303030] border border-[#303030] bg-[#181818]">
              {candidate.interviews.map((interview) => (
                <div key={interview.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {interview.assessment?.title || 'Assessment'}
                    </p>
                    <p className="mt-1 text-xs text-[#777]">
                      {interview.status.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-[#aaa6a0]">
                    {typeof interview.score === 'number' ? `${interview.score}%` : 'Not scored'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 border border-dashed border-[#383838] p-6 text-sm text-[#888]">
              No invitations have been recorded.
            </p>
          )}
        </section>
        <aside className="border border-[#303030] bg-[#181818] p-5">
          <h2 className="text-lg font-semibold">Send assessment</h2>
          <p className="mt-2 text-sm leading-6 text-[#888]">
            Create an interview invitation and share the one-time returned link.
          </p>
          {state.assessments.length ? (
            <form onSubmit={invite} className="mt-5 space-y-4">
              <Select name="assessmentId" label="Assessment" required defaultValue="">
                <option value="" disabled>
                  Select an assessment
                </option>
                {state.assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.title}
                  </option>
                ))}
              </Select>
              <SubmitButton busy={inviting}>Create invitation</SubmitButton>
            </form>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-[#888]">No assessments are available.</p>
              <Link
                href="/assessments/new"
                className="mt-3 inline-flex text-xs text-[#ff8a68] hover:text-white"
              >
                Create an assessment
              </Link>
            </div>
          )}
          {inviteError ? (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {inviteError}
            </p>
          ) : null}
          {invitationUrl ? (
            <div
              className="mt-5 border border-emerald-900 bg-emerald-950/20 p-4"
              aria-live="polite"
            >
              <p className="text-xs font-medium text-emerald-300">Invitation created</p>
              <p className="mt-2 break-all text-xs text-[#b8c5bf]">{invitationUrl}</p>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(invitationUrl);
                  setCopied(true);
                }}
                className="mt-3 inline-flex items-center gap-2 border border-[#435048] px-3 py-2 font-mono text-[10px] uppercase tracking-wider hover:border-emerald-300"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <p className="mt-3 text-[11px] text-[#718078]">
                This link is shown from this response only. Store it before leaving.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
