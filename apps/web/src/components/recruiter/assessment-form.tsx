'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { apiRequest, getErrorMessage, type Assessment, type AssessmentQuestion } from '@/lib/api';
import { useRecruiterApp } from './app-shell';
import { EmptyState, Input, Select, SubmitButton } from './ui';

type DraftQuestion = AssessmentQuestion & {
  key: number;
  starterCode: string;
  typescriptStarterCode: string;
  pythonStarterCode: string;
  publicTests: string;
  hiddenTests: string;
};
const emptyQuestion = (key: number): DraftQuestion => ({
  key,
  type: 'TECHNICAL',
  difficulty: 'MEDIUM',
  prompt: '',
  skills: [],
  rubric: '',
  starterCode: 'function solve(input) {\n  // Return your result.\n}\n',
  typescriptStarterCode: 'function solve(input: unknown): unknown {\n  // Return your result.\n}\n',
  pythonStarterCode: 'def solve(input):\n    # Return your result.\n    pass\n',
  publicTests: '[]',
  hiddenTests: '[]',
});
const textAreaClass =
  'w-full border border-[#353535] bg-[#151515] p-3 text-[#f0ede8] outline-none placeholder:text-[#666] focus:border-[#ff4d1c] focus:ring-2 focus:ring-[#ff4d1c]/20';

export function AssessmentForm() {
  const router = useRouter();
  const { organization } = useRecruiterApp();
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function updateQuestion(
    key: number,
    field:
      | 'type'
      | 'difficulty'
      | 'prompt'
      | 'rubric'
      | 'skills'
      | 'starterCode'
      | 'typescriptStarterCode'
      | 'pythonStarterCode'
      | 'publicTests'
      | 'hiddenTests',
    value: string,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key
          ? {
              ...question,
              [field]:
                field === 'skills'
                  ? value
                      .split(',')
                      .map((skill) => skill.trim())
                      .filter(Boolean)
                  : value,
            }
          : question,
      ),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    const form = new FormData(event.currentTarget);
    let questionPayload: Array<Record<string, unknown>>;
    try {
      questionPayload = questions.map((question) => {
        const base = {
          type: question.type,
          difficulty: question.difficulty,
          prompt: question.prompt,
          skills: question.skills,
          rubric: question.rubric,
        };
        if (question.type !== 'CODING') return base;
        const publicTests = JSON.parse(question.publicTests) as unknown;
        const hiddenTests = JSON.parse(question.hiddenTests) as unknown;
        if (!Array.isArray(publicTests) || !Array.isArray(hiddenTests) || !hiddenTests.length) {
          throw new Error('Coding questions require JSON arrays and at least one hidden test.');
        }
        return {
          ...base,
          codingConfig: {
            title: question.prompt.slice(0, 200),
            allowedLanguages: ['javascript', 'typescript', 'python'],
            starterCode: {
              javascript: question.starterCode,
              typescript: question.typescriptStarterCode,
              python: question.pythonStarterCode,
            },
            publicTests,
            hiddenTests,
            timeLimitMs: 5000,
            memoryLimitMb: 128,
          },
        };
      });
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Coding tests contain invalid JSON.');
      return;
    }
    const body = {
      title: String(form.get('title')),
      description: String(form.get('description') || '') || undefined,
      durationMins: Number(form.get('durationMins')),
      questions: questionPayload,
    };
    setBusy(true);
    setError('');
    try {
      const assessment = await apiRequest<Assessment>(
        `/organizations/${organization.id}/assessments`,
        { method: 'POST', body: JSON.stringify(body) },
        organization.id,
      );
      router.push(`/assessments/${assessment.id}`);
      router.refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (!organization)
    return (
      <EmptyState
        title="Select an organization"
        description="An assessment must belong to an organization."
      />
    );
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/assessments"
        className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> Back to assessments
      </Link>
      <header className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff4d1c]">
          Assessment builder
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Design the interview</h1>
        <p className="mt-2 text-sm text-[#8e8a84]">
          Define the candidate experience and evidence expected from every answer.
        </p>
      </header>
      <form onSubmit={submit} className="mt-8 space-y-8">
        <fieldset className="grid gap-5 border border-[#303030] bg-[#181818] p-5 sm:grid-cols-[1fr_180px] md:p-7">
          <legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">
            Metadata
          </legend>
          <Input
            name="title"
            label="Title"
            required
            maxLength={160}
            placeholder="Senior engineering screen"
          />
          <Input
            name="durationMins"
            label="Duration (minutes)"
            type="number"
            required
            min={5}
            max={240}
            step={5}
            defaultValue={60}
          />
          <label
            className="grid gap-2 text-sm text-[#d5d1ca] sm:col-span-2"
            htmlFor="assessment-description"
          >
            <span className="font-medium">Description</span>
            <textarea
              id="assessment-description"
              name="description"
              rows={4}
              maxLength={2000}
              className={textAreaClass}
              placeholder="Purpose, audience, and expected outcomes."
            />
          </label>
        </fieldset>
        <section aria-labelledby="questions-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 id="questions-heading" className="text-lg font-semibold">
                Questions
              </h2>
              <p className="mt-1 text-xs text-[#777]">
                Every question requires a prompt and scoring rubric.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuestions((current) => [...current, emptyQuestion(nextKey)]);
                setNextKey((value) => value + 1);
              }}
              className="inline-flex items-center gap-2 border border-[#444] px-3 py-2 font-mono text-[10px] uppercase tracking-wider hover:border-[#f0ede8]"
            >
              <Plus className="size-3.5" /> Add question
            </button>
          </div>
          <div className="space-y-5">
            {questions.map((question, index) => (
              <fieldset
                key={question.key}
                className="border border-[#303030] bg-[#181818] p-5 md:p-7"
              >
                <legend className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">
                  Question {index + 1}
                </legend>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Select
                    label="Question type"
                    value={question.type}
                    onChange={(event) => updateQuestion(question.key, 'type', event.target.value)}
                  >
                    <option value="TECHNICAL">Technical</option>
                    <option value="CODING">Coding</option>
                    <option value="SYSTEM_DESIGN">System design</option>
                    <option value="BEHAVIORAL">Behavioral</option>
                    <option value="SCENARIO">Scenario</option>
                  </Select>
                  <Select
                    label="Difficulty"
                    value={question.difficulty}
                    onChange={(event) =>
                      updateQuestion(question.key, 'difficulty', event.target.value)
                    }
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                    <option value="EXPERT">Expert</option>
                  </Select>
                  <label className="grid gap-2 text-sm text-[#d5d1ca] sm:col-span-2">
                    <span className="font-medium">Prompt</span>
                    <textarea
                      rows={4}
                      required
                      maxLength={5000}
                      value={question.prompt}
                      onChange={(event) =>
                        updateQuestion(question.key, 'prompt', event.target.value)
                      }
                      className={textAreaClass}
                    />
                  </label>
                  {question.type === 'CODING' ? (
                    <div className="grid gap-5 border-t border-[#303030] pt-5 sm:col-span-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">
                        Isolated execution configuration
                      </p>
                      <div className="grid gap-5 lg:grid-cols-3">
                        <label className="grid gap-2 text-sm text-[#d5d1ca]">
                          <span className="font-medium">JavaScript starter</span>
                          <textarea value={question.starterCode} onChange={(event) => updateQuestion(question.key, 'starterCode', event.target.value)} rows={7} className={`${textAreaClass} font-mono text-xs`} required />
                        </label>
                        <label className="grid gap-2 text-sm text-[#d5d1ca]">
                          <span className="font-medium">TypeScript starter</span>
                          <textarea value={question.typescriptStarterCode} onChange={(event) => updateQuestion(question.key, 'typescriptStarterCode', event.target.value)} rows={7} className={`${textAreaClass} font-mono text-xs`} required />
                        </label>
                        <label className="grid gap-2 text-sm text-[#d5d1ca]">
                          <span className="font-medium">Python starter</span>
                          <textarea value={question.pythonStarterCode} onChange={(event) => updateQuestion(question.key, 'pythonStarterCode', event.target.value)} rows={7} className={`${textAreaClass} font-mono text-xs`} required />
                        </label>
                      </div>
                      <div className="grid gap-5 md:grid-cols-2">
                        <label className="grid gap-2 text-sm text-[#d5d1ca]">
                          <span className="font-medium">Public tests JSON</span>
                          <textarea value={question.publicTests} onChange={(event) => updateQuestion(question.key, 'publicTests', event.target.value)} rows={7} className={`${textAreaClass} font-mono text-xs`} aria-describedby={`public-tests-${question.key}`} />
                          <span id={`public-tests-${question.key}`} className="text-xs text-[#777]">Array of name, input, and expected objects shown to candidates.</span>
                        </label>
                        <label className="grid gap-2 text-sm text-[#d5d1ca]">
                          <span className="font-medium">Hidden tests JSON</span>
                          <textarea value={question.hiddenTests} onChange={(event) => updateQuestion(question.key, 'hiddenTests', event.target.value)} rows={7} className={`${textAreaClass} font-mono text-xs`} required aria-describedby={`hidden-tests-${question.key}`} />
                          <span id={`hidden-tests-${question.key}`} className="text-xs text-[#777]">At least one test. Hidden expected values are never returned to candidates.</span>
                        </label>
                      </div>
                    </div>
                  ) : null}
                  <Input
                    label="Skills"
                    value={question.skills.join(', ')}
                    onChange={(event) => updateQuestion(question.key, 'skills', event.target.value)}
                    placeholder="TypeScript, systems design"
                    hint="Comma-separated skills assessed."
                    className="sm:col-span-2"
                  />
                  <label className="grid gap-2 text-sm text-[#d5d1ca] sm:col-span-2">
                    <span className="font-medium">Scoring rubric</span>
                    <textarea
                      rows={5}
                      required
                      maxLength={5000}
                      value={question.rubric}
                      onChange={(event) =>
                        updateQuestion(question.key, 'rubric', event.target.value)
                      }
                      className={textAreaClass}
                      placeholder="Describe weak, acceptable, and exceptional evidence."
                    />
                  </label>
                </div>
                {questions.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((current) => current.filter((item) => item.key !== question.key))
                    }
                    className="mt-5 inline-flex items-center gap-2 text-xs text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="size-3.5" /> Remove question
                  </button>
                ) : null}
              </fieldset>
            ))}
          </div>
        </section>
        {error ? (
          <p
            role="alert"
            className="border border-red-950 bg-red-950/20 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </p>
        ) : null}
        <div className="ml-auto w-full sm:w-56">
          <SubmitButton busy={busy}>Save draft</SubmitButton>
        </div>
      </form>
    </div>
  );
}
