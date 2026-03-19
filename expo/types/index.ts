export interface Clinician {
  id: string;
  email: string;
  name: string;
  name_zh?: string;
  tier_id?: string;
  clinic_name?: string;
  clinic_name_zh?: string;
  phone?: string;
  is_active?: boolean;
  created_at?: string;
  override_can_view_patients?: boolean | null;
  override_can_edit_patients?: boolean | null;
  override_can_create_patients?: boolean | null;
  override_can_view_exercises?: boolean | null;
  override_can_create_exercises?: boolean | null;
  override_can_view_programs?: boolean | null;
  override_can_create_programs?: boolean | null;
  override_can_marketplace?: boolean | null;
}

export interface ClinicianTier {
  id: string;
  name: string;
  can_view_patients: boolean;
  can_edit_patients: boolean;
  can_create_patients: boolean;
  can_view_exercises: boolean;
  can_create_exercises: boolean;
  can_view_programs: boolean;
  can_create_programs: boolean;
  can_marketplace: boolean;
}

export interface Patient {
  id: string;
  name: string;
  name_zh?: string;
  access_code: string;
  diagnosis?: string;
  diagnosis_zh?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  notes?: string;
  is_frozen: boolean;
  clinician_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  user_id?: string;
  clinician_id?: string;
}

export type MediaStatus = 'active' | 'pending_review' | 'rejected';

export interface Exercise {
  id: string;
  title: string;
  title_zh?: string;
  category?: string;
  description?: string;
  description_zh?: string;
  duration_seconds?: number;
  vimeo_url?: string;
  youtube_url?: string;
  audio_url?: string;
  subtitle_url?: string;
  live_subtitles?: boolean;
  media_status?: MediaStatus;
  created_by_clinician_id?: string;
  is_shared?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SharedExercise {
  id: string;
  exercise_id: string;
  clinician_id: string;
  created_at?: string;
  exercise_library?: Exercise;
}

export interface ExerciseMediaRequest {
  id?: string;
  exercise_id: string;
  clinician_id: string;
  video_url?: string;
  video_required: boolean;
  audio_optional: boolean;
  subtitle_optional: boolean;
  live_subtitles_optional: boolean;
  notes?: string;
  status?: string;
  created_at?: string;
}

export interface ExerciseProgram {
  id: string;
  patient_id: string;
  name: string;
  name_zh?: string;
  name_zh_cn?: string;
  schedule_type: 'daily' | 'custom';
  custom_days?: boolean[];
  issue_date: string;
  expiry_date: string;
  sort_order?: number;
  remarks?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  clinician_id?: string;
}

export interface ProgramExercise {
  id: string;
  program_id: string;
  exercise_id: string;
  sort_order: number;
  dosage?: string;
  dosage_sets?: number;
  dosage_reps?: number;
  dosage_duration_seconds?: number;
  notes?: string;
  created_at?: string;
  exercise_library?: Exercise;
}

export interface ProgramSchedule {
  id: string;
  program_id: string;
  day_of_week: number;
  is_active: boolean;
  created_at?: string;
}

export interface MarketplaceListing {
  id: string;
  exercise_id: string;
  clinician_id: string;
  title?: string;
  title_zh?: string;
  description?: string;
  description_zh?: string;
  contraindications?: string;
  contraindications_zh?: string;
  category?: string;
  tags?: string[];
  screenshots?: string[];
  hkd_per_day?: number;
  discount_tiers?: { min_days: number; discount_pct: number }[];
  approval_status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  listing_start_date?: string;
  listing_end_date?: string;
  total_earned?: number;
  avg_rating?: number;
  rating_count?: number;
  created_at?: string;
  updated_at?: string;
  exercise_library?: Exercise;
  clinicians?: { name: string; name_zh?: string; clinic_name?: string };
}

export interface MarketplaceRental {
  id: string;
  listing_id: string;
  renting_clinician_id: string;
  owner_clinician_id?: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled' | 'disputed';
  start_date: string;
  end_date: string;
  total_fee?: number;
  hkd_per_day?: number;
  created_at?: string;
  updated_at?: string;
  marketplace_listings?: MarketplaceListing;
  review_rating?: number;
  review_text?: string;
  reviewed_at?: string;
}

export interface MarketplaceReview {
  id: string;
  rental_id: string;
  listing_id: string;
  reviewer_clinician_id: string;
  rating: number;
  review_text?: string;
  created_at?: string;
}

export type UserRole = 'admin' | 'clinician';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  adminUser: { id: string; email: string } | null;
  clinician: Clinician | null;
  clinicianTier: ClinicianTier | null;
}
