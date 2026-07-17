import { z } from 'zod';

export const tenantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
});

export const chatMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty"),
  chatSessionId: z.string().uuid().optional(),
});
