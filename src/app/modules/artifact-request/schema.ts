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
    ]),
    instructions: z.string().nullable().optional(),
});

export type ArtifactRequestCreateInput = z.infer<typeof artifactRequestCreateSchema>;
