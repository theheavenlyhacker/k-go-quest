const { createHash, randomUUID } = require('node:crypto');

async function verifyApi(base, credentials, exerciseFlow = false) {
  const sessions = [];
  async function call(method, route, body, token, expected = 200) {
    const response = await fetch(`${base}/api/v1/${route}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status !== expected)
      throw new Error(
        `${method} ${route}: expected ${expected}, received ${response.status}`,
      );
    return response.json();
  }
  async function login(loginId, password, role) {
    const result = await call(
      'POST',
      'auth/login',
      { loginId, password, deviceId: `verification-${randomUUID()}` },
      undefined,
      201,
    );
    if (
      result.user.role !== role ||
      !result.accessToken ||
      !result.refreshToken
    )
      throw new Error('Login contract mismatch');
    sessions.push(result.accessToken);
    return result;
  }
  try {
    await call('GET', 'health/ready');
    const admin = await login(
      credentials.adminLogin,
      credentials.adminPassword,
      'LGU_ADMIN',
    );
    const teacher = await login(
      'teacher-demo',
      credentials.demoPassword,
      'TEACHER',
    );
    const student = await login(
      'student-demo',
      credentials.demoPassword,
      'STUDENT',
    );
    const profile = await call(
      'GET',
      'auth/me',
      undefined,
      student.accessToken,
    );
    if (profile.role !== 'STUDENT')
      throw new Error('Profile contract mismatch');
    const classes = await call(
      'GET',
      'classrooms',
      undefined,
      student.accessToken,
    );
    const classroom = classes.items.find(
      (item) => item.name === 'Grade 5 - Demo',
    );
    if (!classroom) throw new Error('Demo enrollment missing');
    const packs = await call(
      'GET',
      'content/packs',
      undefined,
      student.accessToken,
    );
    const pack = packs.items.find((item) => item.title === 'Fraction Quests');
    if (!pack) throw new Error('Demo content missing');
    const download = await call(
      'GET',
      `content/packs/${pack.id}/download`,
      undefined,
      student.accessToken,
    );
    const checksum = createHash('sha256')
      .update(
        JSON.stringify({ pack: download.pack, lessons: download.lessons }),
      )
      .digest('hex');
    if (
      checksum !== download.checksum ||
      JSON.stringify(download).includes('correctOption')
    )
      throw new Error('Download integrity or private-key protection failed');
    await call('GET', 'learning/progress/me', undefined, student.accessToken);
    await call('GET', 'learning/quests', undefined, student.accessToken);
    await call(
      'GET',
      `reports/classrooms/${classroom.id}`,
      undefined,
      teacher.accessToken,
    );
    const suggestions = await call(
      'GET',
      `reports/classrooms/${classroom.id}/suggestions`,
      undefined,
      teacher.accessToken,
    );
    if (!suggestions.groups || !['model', 'fallback'].includes(suggestions.method))
      throw new Error('Suggestions contract mismatch');
    await call('GET', 'reports/impact', undefined, admin.accessToken);
    await call('GET', 'reports/league', undefined, admin.accessToken);
    await call('GET', 'reports/impact', undefined, student.accessToken, 403);
    if (exerciseFlow) {
      // Only run this branch in the disposable seeded database, never configured Aiven.
      const exercises = download.lessons.flatMap((lesson) => lesson.exercises);
      const attempts = exercises.map((exercise) => ({
        clientAttemptId: randomUUID(),
        classroomId: classroom.id,
        exerciseId: exercise.id,
        selectedOption: 0,
        occurredAt: new Date().toISOString(),
      }));
      const result = await call(
        'POST',
        'learning/sync',
        { attempts },
        student.accessToken,
        201,
      );
      if (result.coinBalance !== 15 || result.awardedCoins !== 15)
        throw new Error('Compiled sync grading failed');
      const retry = await call(
        'POST',
        'learning/sync',
        { attempts },
        student.accessToken,
        201,
      );
      if (
        retry.coinBalance !== 15 ||
        retry.awardedCoins !== 0 ||
        retry.results.some((item) => !item.duplicate)
      )
        throw new Error('Compiled sync idempotency failed');
      const rewards = await call(
        'GET',
        'rewards',
        undefined,
        student.accessToken,
      );
      const reward = rewards.items.find(
        (item) => item.title === 'Demo School Supply Voucher',
      );
      if (!reward) throw new Error('Demo reward missing');
      const payload = { requestId: randomUUID(), rewardId: reward.id };
      const voucher = await call(
        'POST',
        'rewards/redemptions',
        payload,
        student.accessToken,
        201,
      );
      const repeated = await call(
        'POST',
        'rewards/redemptions',
        payload,
        student.accessToken,
        201,
      );
      if (voucher.redemption.id !== repeated.redemption.id)
        throw new Error('Compiled redemption idempotency failed');
      const after = await call(
        'GET',
        'learning/progress/me',
        undefined,
        student.accessToken,
      );
      if (after.coinBalance !== 5)
        throw new Error('Compiled wallet spending failed');
      await call(
        'POST',
        `rewards/redemptions/${voucher.redemption.id}/claim`,
        {},
        admin.accessToken,
        201,
      );
      await call(
        'POST',
        `rewards/redemptions/${voucher.redemption.id}/claim`,
        {},
        admin.accessToken,
        409,
      );
      const quiz = await call(
        'POST',
        'quizzes',
        {
          classroomId: classroom.id,
          subject: download.pack.subject,
          skillCodes: [download.lessons[0].skillCode],
          itemCount: 3,
        },
        teacher.accessToken,
        201,
      );
      if (quiz.questionCount !== 3 || quiz.answerKey.length !== 3)
        throw new Error('Compiled teacher quiz failed');
    }
    return {
      readiness: true,
      roles: ['STUDENT', 'TEACHER', 'LGU_ADMIN'],
      privateKeysProtected: true,
      checksumVerified: true,
      scopedReports: true,
      ...(exerciseFlow
        ? { syncRetry: true, rewards: true, teacherQuiz: true }
        : {}),
    };
  } finally {
    for (const token of sessions) {
      try {
        await call('POST', 'auth/logout', {}, token, 201);
      } catch {
        /* A failed verification still attempts to close all test sessions. */
      }
    }
  }
}
module.exports = { verifyApi };
