export type RoomStatus = 'scheduled' | 'teaching' | 'awaiting_answer' | 'paused' | 'completed' | 'failed';
export type BoardAction =
  | { type: 'write_text' | 'write_equation'; text: string; x: number; y: number }
  | { type: 'draw_shape'; shape: 'rectangle' | 'ellipse'; x: number; y: number; width: number; height: number }
  | { type: 'draw_arrow'; x: number; y: number; endX: number; endY: number }
  | { type: 'clear_whiteboard' };
export interface Room { id: string; title: string; topic: string; grade: number; subject: string; status: RoomStatus; stage: number; sequence: number; createdAt?: unknown; createdBy?: string; memberCount?: number; mode?: 'practice' | 'shared' }
export interface ClassroomEvent { id: string; sequence: number; type: 'teacher_step' | 'question_asked' | 'hand_raised' | 'answer' | 'classroom_status' | 'classroom_reset'; payload: Record<string, unknown>; createdAt?: unknown }
export interface Child { id: string; firstName: string; grade: number }
export interface TeacherStep { speech: string; heading: string; board: BoardAction[]; question?: string; equationLatex?: string }
