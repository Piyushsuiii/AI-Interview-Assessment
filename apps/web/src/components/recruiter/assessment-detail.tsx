'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, LoaderCircle, Send } from 'lucide-react';
import { apiRequest, getErrorMessage, type Assessment } from '@/lib/api';
import { useRecruiterApp } from './app-shell';
import { AssessmentStatus } from './assessments-view';
import { EmptyState, ErrorState, PageSkeleton } from './ui';

export function AssessmentDetail({ id }: { id: string }) {
  const { organization } = useRecruiterApp();
  const organizationId = organization?.id ?? '';
  const key = `${organizationId}:${id}`;
  const [state, setState] = useState<{ key: string; assessment: Assessment | null; error: string }>(
    { key: '', assessment: null, error: '' },
  );
  const [retry, setRetry] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    apiRequest<Assessment>(
      `/organizations/${organizationId}/assessments/${encodeURIComponent(id)}`,
      {},
      organizationId,
    )
      .then((assessment) => active && setState({ key, assessment, error: '' }))
      .catch(
        (error: unknown) =>
          active && setState({ key, assessment: null, error: getErrorMessage(error) }),
      );
    return () => {
      active = false;
    };
  }, [id, key, organizationId, retry]);

  async function publish() {
    if (!organization) return;
    setPublishing(true);
    setActionError('');
    setSuccess('');
    try {
      await apiRequest(
        `/organizations/${organization.id}/assessments/${encodeURIComponent(id)}/publish`,
        { method: 'POST' },
        organization.id,
      );
      setSuccess('Assessment published successfully.');
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setPublishing(false);
    }
  }

  if (!organization)
    return (
      <EmptyState
        title="No organization available"
        description="Select an organization before viewing an assessment."
      />
    );
  if (state.key !== key) return <PageSkeleton />;
  if (state.error)
    return <ErrorState message={state.error} onRetry={() => setRetry((value) => value + 1)} />;
  if (!state.assessment)
    return (
      <EmptyState
        title="Assessment not found"
        description="This assessment is unavailable or no longer exists."
      />
    );
  const assessment = state.assessment;
  const published = assessment.status === 'PUBLISHED' || assessment.status === 'ACTIVE';

  return (
    <div className="space-y-8">
      <Link
        href="/assessments"
        className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> Back to assessments
      </Link>
      <header className="border-b border-[#303030] pb-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-3">
              <AssessmentStatus status={assessment.status} />
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#777]">
                <Clock className="size-3" /> {assessment.durationMins} minutes
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
              {assessment.title}
            </h1>
            <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#aaa6a0]">
              {assessment.description || 'No description provided.'}
            </p>
          </div>
          {published ? (
            <span
              className="border border-[#3b3b3b] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#777]"
              aria-label="Publishing unavailable: assessment is already published"
            >
              Already published
            </span>
          ) : (
            <button
              type="button"
              onClick={publish}
              disabled={publishing}
              className="btn-orange inline-flex h-10 items-center justify-center gap-2 px-4 font-mono text-xs uppercase disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {publishing ? 'Publishing' : 'Publish'}
            </button>
          )}
        </div>
        {actionError ? (
          <p
            role="alert"
            className="mt-5 border border-red-950 bg-red-950/20 px-4 py-3 text-sm text-red-300"
          >
            {actionError}
          </p>
        ) : null}
        {success ? (
          <p
            role="status"
            className="mt-5 border border-emerald-900 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300"
          >
            {success}
          </p>
        ) : null}
      </header>
      <section aria-labelledby="question-list">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ff4d1c]">
              Interview structure
            </p>
            <h2 id="question-list" className="mt-2 text-xl font-semibold">
              {assessment.questions
                ? `${assessment.questions.length} questions`
                : 'Questions unavailable'}
            </h2>
          </div>
          <span className="text-xs text-[#666]">Editing unavailable after creation</span>
        </div>
        {assessment.questions?.length ? (
          <ol className="mt-5 space-y-4">
            {assessment.questions.map((question, index) => (
              <li
                key={question.id ?? `${index}-${question.prompt}`}
                className="border border-[#303030] bg-[#181818] p-5 md:p-7"
              >
                <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-[#888]">
                  <span className="text-[#ff7048]">Q{String(index + 1).padStart(2, '0')}</span>
                  <span>/</span>
                  <span>{question.type.replaceAll('_', ' ')}</span>
                  <span>/</span>
                  <span>{question.difficulty}</span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#dedad3]">
                  {question.prompt}
                </p>
                <div className="mt-5 grid gap-5 border-t border-[#303030] pt-5 md:grid-cols-2">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[#666]">
                      Skills
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {question.skills.length ? (
                        question.skills.map((skill) => (
                          <span
                            key={skill}
                            className="border border-[#3a3a3a] px-2 py-1 text-xs text-[#aaa6a0]"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#777]">No skills specified</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[#666]">
                      Scoring rubric
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[#aaa6a0]">
                      {question.rubric}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title={assessment.questions ? 'No questions' : 'Question data unavailable'}
            description={
              assessment.questions
                ? 'This assessment does not contain a question set.'
                : 'The assessment API did not return question details.'
            }
          />
        )}
      </section>
    </div>
  );
}
