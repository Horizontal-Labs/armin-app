import {z} from 'zod/v4';

export const SendMessageRequestSchema = z.object({
  conversationId: z.uuid(),
  message: z.string().min(1, 'Message cannot be empty'),
  isUserMessage: z.boolean(),
  timestamp: z.preprocess((val) => {
    if (typeof val === 'string' || typeof val === 'number') {
      return new Date(val);
    }
    return val;
  }, z.date()),
});

export type SendMessageRequestDto = z.infer<typeof SendMessageRequestSchema>;