import { randomUUID } from 'node:crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Role {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  LGU_ADMIN = 'LGU_ADMIN',
}
export enum Subject {
  MATH = 'MATH',
  SCIENCE = 'SCIENCE',
  ENGLISH = 'ENGLISH',
  FILIPINO = 'FILIPINO',
}

export abstract class RecordEntity {
  @PrimaryColumn('uuid') id: string = randomUUID();
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('jurisdictions')
export class Jurisdiction extends RecordEntity {
  @Column({ length: 120 }) name: string;
}
@Entity('schools')
export class School extends RecordEntity {
  @Index() @Column('uuid') jurisdictionId: string;
  @Column({ length: 120 }) name: string;
  @Column({ length: 80, default: '' }) barangay: string;
}
@Entity('users')
export class User extends RecordEntity {
  @Index({ unique: true }) @Column({ length: 80 }) loginId: string;
  @Column({ length: 40 }) role: Role;
  @Index() @Column('uuid') jurisdictionId: string;
  @Column({ type: 'uuid', nullable: true }) schoolId: string | null;
  @Column({ length: 80 }) alias: string;
  @Column({ select: false }) passwordHash: string;
  @Column({ default: true }) active: boolean;
  @Column({ default: 0 }) coins: number;
  @Column({ default: 0, select: false }) failedLogins: number;
  @Column({ type: 'timestamptz', nullable: true, select: false })
  lockedUntil: Date | null;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
@Entity('auth_sessions')
export class AuthSession extends RecordEntity {
  @Index() @Column('uuid') userId: string;
  @Column({ length: 80 }) deviceId: string;
  @Column({ select: false }) refreshHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
}
@Entity('classrooms')
export class Classroom extends RecordEntity {
  @Index() @Column('uuid') schoolId: string;
  @Index() @Column('uuid') teacherId: string;
  @Column({ length: 80 }) name: string;
  @Column() grade: number;
}
@Entity('enrollments')
@Index(['classroomId', 'studentId'], { unique: true })
export class Enrollment extends RecordEntity {
  @Column('uuid') classroomId: string;
  @Column('uuid') studentId: string;
  @Column({ default: true }) active: boolean;
}
@Entity('content_packs')
export class ContentPack extends RecordEntity {
  @Index() @Column('uuid') jurisdictionId: string;
  @Column({ length: 120 }) title: string;
  @Column({ length: 30 }) subject: Subject;
  @Column() grade: number;
  @Column({ length: 30 }) version: string;
  @Column({ default: false }) published: boolean;
  @Column({ default: 'Original K-Go demo content' }) attribution: string;
}
@Entity('lessons')
export class Lesson extends RecordEntity {
  @Index() @Column('uuid') packId: string;
  @Column({ length: 120 }) title: string;
  @Column({ length: 100 }) skillCode: string;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'jsonb', default: {} }) hints: Record<string, string>;
}
@Entity('exercises')
export class Exercise extends RecordEntity {
  @Index() @Column('uuid') lessonId: string;
  @Column({ type: 'text' }) prompt: string;
  @Column('jsonb') options: string[];
  @Column({ select: false }) correctOption: number;
  @Column({ default: 5 }) coinAward: number;
}
@Entity('attempts')
@Index(['studentId', 'clientAttemptId'], { unique: true })
@Index(['studentId', 'exerciseId', 'receivedAt'])
export class Attempt extends RecordEntity {
  @Column('uuid') clientAttemptId: string;
  @Column('uuid') studentId: string;
  @Column('uuid') classroomId: string;
  @Column('uuid') exerciseId: string;
  @Column({ length: 100 }) skillCode: string;
  @Column({ length: 30 }) subject: Subject;
  @Column() selectedOption: number;
  @Column() correct: boolean;
  @Column() awardedCoins: number;
  @Column({ type: 'timestamptz' }) occurredAt: Date;
  @Column({ type: 'timestamptz' }) receivedAt: Date;
  /** 'device' for real practice, 'demo' for synthetic seed history. */
  @Column({ length: 20, default: 'device' }) source: string;
}
@Entity('skill_progress')
@Index(['studentId', 'skillCode'], { unique: true })
export class SkillProgress extends RecordEntity {
  @Column('uuid') studentId: string;
  @Column({ length: 100 }) skillCode: string;
  @Column({ length: 30 }) subject: Subject;
  @Column('double precision', { default: 0.2 }) mastery: number;
  @Column({ default: 0 }) attempts: number;
  @Column({ default: 0 }) correctAttempts: number;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
@Entity('growth_snapshots')
@Index(['studentId', 'skillCode', 'month'], { unique: true })
export class GrowthSnapshot extends RecordEntity {
  @Column('uuid') studentId: string;
  @Column('uuid') classroomId: string;
  @Column({ length: 100 }) skillCode: string;
  @Column({ length: 7 }) month: string;
  @Column('double precision') baseline: number;
  @Column('double precision') latest: number;
}
@Entity('rewards')
export class Reward extends RecordEntity {
  @Index() @Column('uuid') jurisdictionId: string;
  @Column({ length: 120 }) title: string;
  @Column() cost: number;
  @Column() stock: number;
  @Column({ default: true }) active: boolean;
}
@Entity('redemptions')
@Index(['studentId', 'requestId'], { unique: true })
export class Redemption extends RecordEntity {
  @Column('uuid') studentId: string;
  @Column('uuid') rewardId: string;
  @Column('uuid') requestId: string;
  @Column() cost: number;
  @Column({ length: 20, default: 'ISSUED' }) status: 'ISSUED' | 'CLAIMED';
  @Column({ type: 'timestamptz', nullable: true }) claimedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) claimedBy: string | null;
}
@Entity('model_versions')
export class ModelVersion extends RecordEntity {
  @Index({ unique: true }) @Column({ length: 60 }) version: string;
  @Column({ length: 200 }) method: string;
  @Column({ length: 30 }) source: string;
  @Column({ default: false }) active: boolean;
  @Column({ type: 'timestamptz' }) fittedAt: Date;
  @Column() skills: number;
}
@Entity('skill_model_params')
@Index(['modelVersion', 'skillCode'], { unique: true })
export class SkillModelParams extends RecordEntity {
  @Column({ length: 60 }) modelVersion: string;
  @Column({ length: 100 }) skillCode: string;
  @Column('double precision') prior: number;
  @Column('double precision') learn: number;
  @Column('double precision') guess: number;
  @Column('double precision') slip: number;
  @Column() sequences: number;
  @Column() observations: number;
}
export enum QuizStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}
@Entity('quizzes')
export class Quiz extends RecordEntity {
  @Index() @Column('uuid') classroomId: string;
  @Column({ length: 120 }) title: string;
  @Column({ length: 30 }) subject: Subject;
  @Column({ type: 'jsonb' }) skillCodes: string[];
  /** Ordered. */
  @Column({ type: 'jsonb' }) exerciseIds: string[];
  @Column({ length: 20, default: QuizStatus.DRAFT }) status: QuizStatus;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
@Entity('audit_events')
export class AuditEvent extends RecordEntity {
  @Column({ type: 'uuid', nullable: true }) actorId: string | null;
  @Index() @Column('uuid') jurisdictionId: string;
  @Column({ length: 80 }) action: string;
  @Column({ type: 'uuid', nullable: true }) targetId: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
}

export const ENTITIES = [
  Jurisdiction,
  School,
  User,
  AuthSession,
  Classroom,
  Enrollment,
  ContentPack,
  Lesson,
  Exercise,
  Attempt,
  SkillProgress,
  GrowthSnapshot,
  Reward,
  Redemption,
  ModelVersion,
  SkillModelParams,
  Quiz,
  AuditEvent,
];
