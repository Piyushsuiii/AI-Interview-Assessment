import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export type CandidateAuthPrincipal = { id: string; email: string; sessionId: string };

export const CurrentCandidate = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CandidateAuthPrincipal =>
    context.switchToHttp().getRequest().candidate,
);
