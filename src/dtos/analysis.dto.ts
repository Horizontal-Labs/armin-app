import { z } from 'zod'

export const AnalysisMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('image'), content: z.string().url() }),
])

export const AnalysisResponseSchema = z.object({ messages: z.array(AnalysisMessageSchema) })

export type AnalysisMessage = z.infer<typeof AnalysisMessageSchema>