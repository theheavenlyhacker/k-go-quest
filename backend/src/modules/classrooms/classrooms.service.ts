import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import {
  Classroom,
  Enrollment,
  Role,
  School,
  User,
} from '../../database/entities';
import { ScopeService } from '../../common/scope.service';
import { AuditService } from '../../common/audit.service';
import type { Principal } from '../../common/security';
import type { CreateClassroomDto } from './classrooms.dto';
import type { PaginationDto } from '../../common/pagination.dto';

@Injectable()
export class ClassroomsService {
  constructor(
    private readonly db: DataSource,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
  ) {}
  async create(actor: Principal, dto: CreateClassroomDto) {
    await this.scope.school(actor, dto.schoolId);
    if (
      !(await this.db.getRepository(User).existsBy({
        id: dto.teacherId,
        role: Role.TEACHER,
        schoolId: dto.schoolId,
        jurisdictionId: actor.jurisdictionId,
        active: true,
      }))
    )
      throw new BadRequestException('Teacher must belong to this school');
    return this.db.transaction(async (manager) => {
      const classroom = await manager.save(
        Classroom,
        manager.create(Classroom, dto),
      );
      await this.audit.record(
        actor,
        'CLASSROOM_CREATED',
        classroom.id,
        manager,
      );
      return classroom;
    });
  }
  async list(actor: Principal, query: PaginationDto) {
    const schools = await this.db
      .getRepository(School)
      .findBy({ jurisdictionId: actor.jurisdictionId });
    if (!schools.length)
      return { items: [], total: 0, page: query.page, limit: query.limit };
    let allowedIds: string[] | undefined;
    if (actor.role === Role.STUDENT)
      allowedIds = (
        await this.db
          .getRepository(Enrollment)
          .findBy({ studentId: actor.id, active: true })
      ).map((e) => e.classroomId);
    if (allowedIds && !allowedIds.length)
      return { items: [], total: 0, page: query.page, limit: query.limit };
    const [items, total] = await this.db.getRepository(Classroom).findAndCount({
      where: {
        schoolId: In(schools.map((s) => s.id)),
        ...(actor.role === Role.TEACHER ? { teacherId: actor.id } : {}),
        ...(allowedIds ? { id: In(allowedIds) } : {}),
      },
      order: { name: 'ASC', id: 'ASC' },
      take: query.limit,
      skip: query.skip,
    });
    return { items, total, page: query.page, limit: query.limit };
  }
  async enroll(actor: Principal, classroomId: string, studentId: string) {
    const classroom = await this.scope.classroom(actor, classroomId);
    const student = await this.db.getRepository(User).findOneBy({
      id: studentId,
      role: Role.STUDENT,
      schoolId: classroom.schoolId,
      jurisdictionId: actor.jurisdictionId,
      active: true,
    });
    if (!student)
      throw new BadRequestException(
        'Student must belong to the classroom school',
      );
    return this.db.transaction(async (manager) => {
      // Match the learner lock order used by sync and wallet mutations.
      await manager.findOneOrFail(User, {
        where: { id: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      const existing = await manager.findOneBy(Enrollment, {
        classroomId,
        studentId,
      });
      const enrollment = await manager.save(
        Enrollment,
        existing
          ? Object.assign(existing, { active: true })
          : manager.create(Enrollment, { classroomId, studentId }),
      );
      await this.audit.record(actor, 'STUDENT_ENROLLED', studentId, manager, {
        classroomId,
      });
      return enrollment;
    });
  }
  async unenroll(actor: Principal, classroomId: string, studentId: string) {
    await this.scope.classroom(actor, classroomId);
    return this.db.transaction(async (manager) => {
      const student = await manager.findOne(User, {
        where: { id: studentId, jurisdictionId: actor.jurisdictionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student) throw new NotFoundException('Enrollment not found');
      const enrollment = await manager.findOneBy(Enrollment, {
        classroomId,
        studentId,
      });
      if (!enrollment) throw new NotFoundException('Enrollment not found');
      if (enrollment.active) {
        await manager.update(Enrollment, enrollment.id, { active: false });
        await this.audit.record(
          actor,
          'STUDENT_UNENROLLED',
          studentId,
          manager,
          { classroomId },
        );
      }
      return { classroomId, studentId, active: false };
    });
  }
  async learners(actor: Principal, classroomId: string, query: PaginationDto) {
    await this.scope.classroom(actor, classroomId);
    const [items, total] = await this.db
      .getRepository(User)
      .createQueryBuilder('u')
      .innerJoin(
        Enrollment,
        'e',
        'e.studentId = u.id AND e.classroomId = :classroomId AND e.active = true',
        { classroomId },
      )
      .select(['u.id', 'u.alias', 'u.active'])
      .orderBy('u.alias', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .skip(query.skip)
      .take(query.limit)
      .getManyAndCount();
    return { items, total, page: query.page, limit: query.limit };
  }
}
