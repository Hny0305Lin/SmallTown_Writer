// 小说类型定义
export interface Novel {
  id: string;
  title: string;
  content: string;
  lastEdited: Date | string | number;
  author?: string;
  tags?: string[];
  isCollaborative?: boolean;
  collaborationSessionId?: string;
} 