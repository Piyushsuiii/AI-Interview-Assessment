# AI Hiring Intelligence Platform - AI Architecture

The AI layer is central to this platform. To prevent vendor lock-in and optimize costs, we use an abstracted AI Gateway approach.

## 1. AI Gateway Pattern

```text
[Frontend/Backend Request]
       ↓
[AI Service Layer (NestJS)]
       ↓
[AI Gateway Package (@ai-hiring-platform/ai)]
   ├── Strategy: OpenAI
   └── Strategy: Gemini
       ↓
[External Provider API]
```

## 2. Core AI Capabilities

1. **Job Description Generation:** From a few bullet points, generate full JD and required skills.
2. **Assessment Generation:** Generate relevant coding and behavioral questions based on Job Skills.
3. **Adaptive Interviewing:** Real-time conversational AI that acts as a technical recruiter, probing candidate answers.
4. **Candidate Evaluation:** Deep analysis of transcripts and code submissions to produce structured scoring reports.

## 3. Provider Abstraction

The `@ai-hiring-platform/ai` package exposes generic interfaces:

```typescript
export interface AIProvider {
  generateObject<T>(request: StructuredRequest<T>): Promise<AIResult<T>>;
}
```

## 4. Prompt Engineering & Versioning

- Prompts are centralized and versioned in `packages/ai/src/prompts.ts`.
- Follow-up, evaluation, report summary, comparison, Copilot, and similarity tasks each have a strict Zod response contract.
- Prompt inputs contain stored interview facts and explicitly prohibit unsupported claims.

## 5. Reliability & Cost Tracking

- **Retries & Fallbacks:** The configured primary provider is attempted first. Retryable OpenAI/Gemini failures move sequentially to the other configured provider.
- **Token Tracking:** Every AI request logs `prompt_tokens`, `completion_tokens`, and `provider` to the `UsageRecord` database table for billing and cost-analysis.
- **Validation:** Provider text is parsed and validated before business logic can persist it. Invalid output is treated as a provider failure.
- **Adaptive fallback:** Follow-up generation is bounded; if both providers fail, a deterministic rubric-based prompt keeps the interview operational.
- **Evaluation fallback:** Evaluation failures are recorded for retry rather than inventing scores.

## 6. Grounding and Auditability

Evaluation evidence stores the source type and source identifier for each claim. Recruiter Copilot exposes explicit organization-scoped tools for candidate listing, comparison, score explanation, and review priority. Optional narratives can only summarize returned records. Recommendation overrides preserve both the machine recommendation and the recruiter's reason.
