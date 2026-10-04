import {
  ForbiddenException,
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
} from '../database/entities';
import type { Principal } from './security';

@Injectable()
export class ScopeService {
  constructor(private readonly db: DataSource) {}
  async school(user: Principal, id: string) {
    const school = await this.db
      .getRepository(School)
      .findOneBy({ id, jurisdictionId: user.jurisdictionId });
    if (!school) throw new NotFoundException('School not found');
    if (user.role !== Role.LGU_ADMIN && user.schoolId !== school.id)
      throw new ForbiddenException();
    return school;
  }
  async classroom(user: Principal, id: string) {
    const classroom = await this.db.getRepository(Classroom).findOneBy({ id });
    if (!classroom) throw new NotFoundException('Classroom not found');
    await this.school(user, classroom.schoolId);
    if (user.role === Role.TEACHER && classroom.teacherId !== user.id)
      throw new ForbiddenException('Classroom is not assigned to you');
    if (
      user.role === Role.STUDENT &&
      !(await this.db
        .getRepository(Enrollment)
        .existsBy({ classroomId: id, studentId: user.id, active: true }))
    )
      throw new ForbiddenException();
    return classroom;
  }
  async student(user: Principal, studentId: string) {
    const student = await this.db
      .getRepository(User)
      .findOneBy({
        id: studentId,
        role: Role.STUDENT,
        jurisdictionId: user.jurisdictionId,
      });
    if (!student) throw new NotFoundException('Learner not found');
    if (user.role === Role.STUDENT && student.id !== user.id)
      throw new ForbiddenException();
    if (user.role === Role.TEACHER) {
      const classrooms = await this.db
        .getRepository(Classroom)
        .findBy({ teacherId: user.id, schoolId: user.schoolId! });
      if (
        !classrooms.length ||
        !(await this.db
          .getRepository(Enrollment)
          .existsBy({
            studentId,
            classroomId: In(classrooms.map((c) => c.id)),
            active: true,
          }))
      )
        throw new ForbiddenException('Learner is not in your classes');
    }
    return student;
  }
}
