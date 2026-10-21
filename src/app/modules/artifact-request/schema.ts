import { z } from "zod";
import { ARTIFACT_TYPES } from "../../../domain/types.js";

const dateRangeScopeSchema = z
    .object({
        type: z.literal("DATE_RANGE"),
        from: z.iso.date(),
        to: z.iso.date(),
    })
    .refine(scope => scope.from <= scope.to, {
        path: ["to"],
        message: "to must be the same day as or later than from",
    });

export const artifactRequestCreateSchema = z.object({
    repositoryId: z.uuid(),
    artifactTypes: z.array(z.enum(ARTIFACT_TYPES)).min(1).refine(types => new Set(types).size === types.length, {
        message: "artifactTypes must not contain duplicates",
    }),
    scope: z.discriminatedUnion("type", [
        z.object({ type: z.literal("TODAY") }),
        z.object({ type: z.literal("YESTERDAY") }),
        z.object({ type: z.literal("THIS_WEEK") }),
        z.object({ type: z.literal("LAST_WEEK") }),
        z.object({ type: z.literal("LATEST") }),
        dateRangeScopeSchema,
    ]).optional(),
    instructions: z.string().nullable().optional(),
});

export const artifactRequestParamsSchema = z.object({ artifactRequestId: z.uuid() });
export const artifactCandidateParamsSchema = z.object({ artifactRequestId: z.uuid(), candidateId: z.uuid() });
export const artifactCandidateIdParamsSchema = z.object({ candidateId: z.uuid() });
export const editArtifactCandidateBodySchema = z.object({ content: z.string().trim().min(1).max(3000) });

export type ArtifactRequestCreateInput = z.infer<typeof artifactRequestCreateSchema>;
export type ArtifactRequestParams = z.infer<typeof artifactRequestParamsSchema>;
export type ArtifactCandidateParams = z.infer<typeof artifactCandidateParamsSchema>;
export type EditArtifactCandidateBody = z.infer<typeof editArtifactCandidateBodySchema>;
