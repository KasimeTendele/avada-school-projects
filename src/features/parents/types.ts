// DTOs exposés par GET /admin-parents (voir docs/BACKEND.md).
export interface ParentChildDto {
  id: string;
  full_name: string;
  matricule: string | null;
  class_name: string | null;
}

export interface ParentDto {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  status?: string | null;
  children: ParentChildDto[];
  created_at?: string;
}

export interface ParentListQuery {
  schoolId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateParentInput {
  school_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
  relationship?: string;
  children?: Array<{ student_id: string; relationship?: string }>;
}

export type UpdateParentInput = Partial<Omit<CreateParentInput, "password">>;