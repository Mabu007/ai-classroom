import { z } from 'zod';
export const boardActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('write_text'), text: z.string().min(1).max(180), x: z.number().min(0).max(1600), y: z.number().min(0).max(1200) }),
  z.object({ type: z.literal('write_equation'), text: z.string().min(1).max(180), x: z.number().min(0).max(1600), y: z.number().min(0).max(1200) }),
  z.object({ type: z.literal('draw_shape'), shape: z.enum(['rectangle','ellipse']), x: z.number().min(0).max(1600), y: z.number().min(0).max(1200), width: z.number().min(10).max(800), height: z.number().min(10).max(800) }),
  z.object({ type: z.literal('draw_arrow'), x: z.number().min(0).max(1600), y: z.number().min(0).max(1200), endX: z.number().min(0).max(1600), endY: z.number().min(0).max(1200) }),
  z.object({ type: z.literal('clear_whiteboard') })
]);
export const teacherStepSchema = z.object({
  heading: z.string().min(2).max(100),
  speech: z.string().min(15).max(1200),
  board: z.array(boardActionSchema).min(1).max(6),
  question: z.string().max(240).optional(),
  equationLatex: z.string().max(200).optional()
});
export const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('me') }),
  z.object({ action: z.literal('createChild'), firstName: z.string().trim().min(1).max(40), grade: z.number().int().min(1).max(12) }),
  z.object({ action: z.literal('create') }),
  z.object({ action: z.literal('createPractice') }),
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('snapshot'), roomId: z.string().min(3).max(100) }),
  z.object({ action: z.literal('restart'), roomId: z.string().min(3).max(100) }),
  z.object({ action: z.literal('join'), roomId: z.string().min(3).max(100), childId: z.string().min(3).max(100).optional() }),
  z.object({ action: z.literal('start'), roomId: z.string().min(3).max(100) }),
  z.object({ action: z.literal('step'), roomId: z.string().min(3).max(100) }),
  z.object({ action: z.literal('pause'), roomId: z.string().min(3).max(100) }),
  z.object({ action: z.literal('resume'), roomId: z.string().min(3).max(100) }),
  z.object({ action: z.literal('ask'), roomId: z.string().min(3).max(100), question: z.string().trim().min(3).max(400) }),
  z.object({ action: z.literal('raise'), roomId: z.string().min(3).max(100) }),
  z.object({ action: z.literal('answer'), roomId: z.string().min(3).max(100), answer: z.string().trim().min(1).max(120) })
]);
