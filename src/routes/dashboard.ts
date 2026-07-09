import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { rawDb } from "../lib/enhanced.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

// ── Helpers ──

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

async function getMember(orgId: string, userId: string) {
  return rawDb.member.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
}

// ── GET /api/dashboard/owner ──
router.get("/owner", async (req: Request, res: Response) => {
  try {
    const member = await getMember(req.orgId, req.authUser!.id);
    if (!member || !["OWNER", "OPS_DIRECTOR"].includes(member.taktRole)) {
      res.status(403).json(errResponse("FORBIDDEN", "Доступ только для владельцев"));
      return;
    }

    const today = todayStr();
    const yesterday = yesterdayStr();
    const weekAgo = daysAgoStr(7);

    // Parallel queries
    const [
      locations,
      allMembers,
      todayShifts,
      pendingAlerts,
      pendingTasks,
      recentPhotos,
      weekShifts,
      yesterdayShifts,
      yesterdayAlertCount,
      yesterdayTaskStats,
      checklistTemplates,
    ] = await Promise.all([
      rawDb.location.findMany({ where: { orgId: req.orgId }, orderBy: { name: "asc" } }),
      rawDb.member.findMany({
        where: { organizationId: req.orgId },
        include: { user: { select: { id: true, name: true } } },
      }),
      rawDb.shift.findMany({
        where: { orgId: req.orgId, date: today },
        include: { completions: true },
      }),
      rawDb.alert.findMany({
        where: { orgId: req.orgId, resolved: false },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { location: { select: { name: true } } },
      }),
      rawDb.calendarTask.findMany({
        where: { orgId: req.orgId, date: today, done: false },
        include: { location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      rawDb.taskCompletion.findMany({
        where: {
          shift: { orgId: req.orgId },
          photo: { not: null },
        },
        orderBy: { doneAt: "desc" },
        take: 10,
        include: {
          shift: { select: { date: true, location: { select: { name: true } } } },
        },
      }),
      rawDb.shift.findMany({
        where: { orgId: req.orgId, date: { gte: weekAgo } },
        include: { completions: true, ratings: true },
      }),
      rawDb.shift.findMany({
        where: { orgId: req.orgId, date: yesterday },
        include: { completions: true, ratings: true, location: { select: { name: true } } },
      }),
      rawDb.alert.count({
        where: { orgId: req.orgId, createdAt: { gte: new Date(yesterday) } },
      }),
      rawDb.calendarTask.findMany({
        where: { orgId: req.orgId, date: yesterday },
      }),
      rawDb.checklistTemplate.findMany({
        where: { orgId: req.orgId },
      }),
    ]);

    // Build location cards
    const locationCards = locations.map((loc) => {
      const shift = todayShifts.find((s) => s.locationId === loc.id);
      const staff = allMembers
        .filter((m) => m.locationIds.includes(loc.id))
        .map((m) => ({ userId: m.user.id, name: m.user.name, taktRole: m.taktRole }));

      let todayShiftData: any = null;
      if (shift) {
        const done = shift.completions.filter((c) => c.done).length;
        const total = shift.completions.length;
        todayShiftData = {
          id: shift.id,
          status: shift.status,
          openedAt: shift.openedAt,
          responsibleName: shift.responsibleName,
          responsibleId: shift.responsibleId,
          completionRate: total > 0 ? done / total : 0,
          completionDone: done,
          completionTotal: total,
        };
      }

      return {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        todayShift: todayShiftData,
        staff,
      };
    });

    // Checklist stats across all today's shifts
    const allCompletionsToday = todayShifts.flatMap((s) => s.completions);
    // Count expected tasks from templates for today's shifts
    const totalExpectedPerShift = checklistTemplates.reduce(
      (sum, tpl) => {
        const sections = (tpl.sections as any[]) || [];
        return sum + sections.reduce((s2, sec) => s2 + (sec.tasks?.length || 0), 0);
      },
      0
    );

    const checklistStats = {
      done: allCompletionsToday.filter((c) => c.done).length,
      inProgress: allCompletionsToday.filter((c) => !c.done).length,
      overdue: 0,
      completedLate: 0,
      total: allCompletionsToday.length || totalExpectedPerShift * todayShifts.length,
    };

    // For closed shifts — tasks not done = overdue
    for (const shift of todayShifts) {
      if (shift.status === "CLOSED") {
        for (const c of shift.completions) {
          if (!c.done) checklistStats.overdue++;
          else if (c.doneAt && shift.closedAt && c.doneAt > shift.closedAt) {
            checklistStats.completedLate++;
          }
        }
      }
    }

    // Photos
    const photos = recentPhotos.map((p) => ({
      id: p.id,
      photo: p.photo,
      taskKey: p.taskKey,
      shiftDate: p.shift.date,
      locationName: p.shift.location.name,
      byName: p.byName,
      doneAt: p.doneAt,
    }));

    // Location summary (7 days)
    const locationSummary = locations.map((loc) => {
      const locShifts = weekShifts.filter((s) => s.locationId === loc.id);
      const allComps = locShifts.flatMap((s) => s.completions);
      const doneComps = allComps.filter((c) => c.done).length;
      const totalComps = allComps.length;
      const allRatings = locShifts.flatMap((s) => s.ratings);
      const avgRating =
        allRatings.length > 0
          ? allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length
          : null;

      return {
        locationId: loc.id,
        name: loc.name,
        checklistOnTimePercent: totalComps > 0 ? Math.round((doneComps / totalComps) * 100) : null,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        shiftsCount7d: locShifts.length,
        writeOffPercent: null,
        latenessCount: null,
        lastInventoryDate: null,
      };
    });

    // Yesterday summary
    let yesterdaySummary: any = null;
    if (yesterdayShifts.length > 0) {
      const ydTasks = yesterdayShifts.flatMap((s) => s.completions);
      yesterdaySummary = {
        date: yesterday,
        shifts: yesterdayShifts.map((s) => {
          const done = s.completions.filter((c) => c.done).length;
          const total = s.completions.length;
          const ratings = s.ratings;
          const avg = ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : null;
          return {
            locationName: s.location.name,
            status: s.status,
            completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
            responsibleName: s.responsibleName,
            rating: avg ? Math.round(avg * 10) / 10 : null,
          };
        }),
        tasksCompleted: ydTasks.filter((c) => c.done).length,
        tasksTotal: ydTasks.length,
        alertsCreated: yesterdayAlertCount,
      };
    }

    const hasPhotos = recentPhotos.length > 0;

    res.json(okResponse({
      locations: locationCards,
      pendingAlerts: pendingAlerts.map((a) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        message: a.message,
        locationName: a.location?.name || null,
        createdAt: a.createdAt,
      })),
      pendingTasks: pendingTasks.map((t) => ({
        id: t.id,
        text: t.text,
        locationName: t.location.name,
        assignedName: t.assignedName,
        color: t.color,
      })),
      checklistStats,
      recentPhotos: photos,
      locationSummary,
      yesterdaySummary,
      features: {
        writeOffsConfigured: false,
        attendanceConfigured: false,
        photoChecklistsUsed: hasPhotos,
      },
    }));
  } catch (err) {
    console.error("Dashboard owner error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── GET /api/dashboard/manager ──
router.get("/manager", async (req: Request, res: Response) => {
  try {
    const member = await getMember(req.orgId, req.authUser!.id);
    if (!member || !["MANAGER", "HEAD_BARISTA"].includes(member.taktRole)) {
      res.status(403).json(errResponse("FORBIDDEN", "Доступ только для менеджеров"));
      return;
    }

    const locationId = member.locationIds[0];
    if (!locationId) {
      res.json(okResponse({ noLocation: true }));
      return;
    }

    const today = todayStr();
    const weekAgo = daysAgoStr(7);

    const [location, todayShift, weekShifts, pendingAlerts, pendingTasks, staff, templates] =
      await Promise.all([
        rawDb.location.findUnique({ where: { id: locationId } }),
        rawDb.shift.findFirst({
          where: { orgId: req.orgId, locationId, date: today },
          include: { completions: true },
        }),
        rawDb.shift.findMany({
          where: { orgId: req.orgId, locationId, date: { gte: weekAgo } },
          include: { completions: true },
          orderBy: { date: "asc" },
        }),
        rawDb.alert.findMany({
          where: { orgId: req.orgId, locationId, resolved: false },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        rawDb.calendarTask.findMany({
          where: { orgId: req.orgId, locationId, date: today, done: false },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        rawDb.member.findMany({
          where: { organizationId: req.orgId, locationIds: { has: locationId } },
          include: { user: { select: { id: true, name: true } } },
        }),
        rawDb.checklistTemplate.findMany({ where: { orgId: req.orgId } }),
      ]);

    // Today's shift data
    let todayShiftData: any = null;
    if (todayShift) {
      const done = todayShift.completions.filter((c) => c.done).length;
      const total = todayShift.completions.length;
      todayShiftData = {
        id: todayShift.id,
        status: todayShift.status,
        openedAt: todayShift.openedAt,
        responsibleName: todayShift.responsibleName,
        completionRate: total > 0 ? done / total : 0,
        completionDone: done,
        completionTotal: total,
        staff: staff.map((m) => ({
          userId: m.user.id,
          name: m.user.name,
          taktRole: m.taktRole,
        })),
      };
    }

    // Checklists with progress
    const checklists = templates.map((tpl) => {
      const sections = (tpl.sections as any[]) || [];
      const allTasks = sections.flatMap((sec) => sec.tasks || []);
      const completions = todayShift?.completions || [];

      return {
        templateName: tpl.name,
        type: tpl.type,
        tasks: allTasks.map((t: any) => {
          const comp = completions.find((c) => c.taskKey === t.key);
          return {
            key: t.key,
            text: t.text,
            done: comp?.done || false,
            byName: comp?.byName || null,
            doneAt: comp?.doneAt || null,
          };
        }),
        completionRate:
          allTasks.length > 0
            ? allTasks.filter((t: any) => completions.find((c) => c.taskKey === t.key && c.done)).length / allTasks.length
            : 0,
      };
    });

    // Weekly stats
    const weeklyStats: { date: string; completionRate: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgoStr(i);
      const shift = weekShifts.find((s) => s.date === d);
      if (shift) {
        const done = shift.completions.filter((c) => c.done).length;
        const total = shift.completions.length;
        weeklyStats.push({ date: d, completionRate: total > 0 ? done / total : 0 });
      } else {
        weeklyStats.push({ date: d, completionRate: 0 });
      }
    }

    res.json(okResponse({
      locationId,
      locationName: location?.name || "",
      todayShift: todayShiftData,
      checklists,
      pendingActions: [
        ...pendingAlerts.map((a) => ({ id: a.id, type: "alert" as const, text: a.message, locationName: location?.name || "" })),
        ...pendingTasks.map((t) => ({ id: t.id, type: "task" as const, text: t.text, locationName: location?.name || "" })),
      ],
      weeklyStats,
      features: {
        writeOffsConfigured: false,
        shiftSwapsEnabled: false,
        inventoryEnabled: false,
      },
    }));
  } catch (err) {
    console.error("Dashboard manager error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── GET /api/dashboard/barista ──
router.get("/barista", async (req: Request, res: Response) => {
  try {
    const member = await getMember(req.orgId, req.authUser!.id);
    if (!member) {
      res.status(403).json(errResponse("FORBIDDEN", "Нет доступа"));
      return;
    }

    const userId = req.authUser!.id;
    const today = todayStr();
    const monthAgo = daysAgoStr(30);

    const [myLocations, todayShifts, monthShifts, myTasks, myCompletions, testAttempts, coworkers] =
      await Promise.all([
        rawDb.location.findMany({
          where: { orgId: req.orgId, id: { in: member.locationIds.length > 0 ? member.locationIds : [] } },
        }),
        rawDb.shift.findMany({
          where: {
            orgId: req.orgId,
            date: today,
            locationId: member.locationIds.length > 0 ? { in: member.locationIds } : undefined,
          },
          include: { location: { select: { name: true } }, completions: true },
        }),
        rawDb.shift.findMany({
          where: {
            orgId: req.orgId,
            date: { gte: monthAgo },
            locationId: member.locationIds.length > 0 ? { in: member.locationIds } : undefined,
          },
          include: { completions: true },
        }),
        rawDb.calendarTask.findMany({
          where: { orgId: req.orgId, assignedTo: userId, done: false },
          include: { location: { select: { name: true } } },
          orderBy: { date: "asc" },
          take: 10,
        }),
        rawDb.taskCompletion.findMany({
          where: { byUserId: userId, shift: { orgId: req.orgId, date: { gte: monthAgo } } },
        }),
        rawDb.testAttempt.findMany({
          where: { userId },
          orderBy: { startedAt: "desc" },
          take: 10,
        }),
        rawDb.member.findMany({
          where: {
            organizationId: req.orgId,
            locationIds: { hasSome: member.locationIds.length > 0 ? member.locationIds : [] },
            userId: { not: userId },
          },
          include: { user: { select: { id: true, name: true } } },
        }),
      ]);

    // Next/current shift
    let nextShift: any = null;
    const todayShift = todayShifts[0];
    if (todayShift) {
      nextShift = {
        id: todayShift.id,
        date: todayShift.date,
        locationName: todayShift.location.name,
        status: todayShift.status,
        responsibleName: todayShift.responsibleName,
        coworkers: coworkers.map((m) => ({ name: m.user.name, taktRole: m.taktRole })),
        canStart: todayShift.status === "OPEN",
      };
    }

    // My stats
    const totalMyComps = myCompletions.length;
    const doneMyComps = myCompletions.filter((c) => c.done).length;
    const shiftsWithMe = monthShifts.filter(
      (s) => s.completions.some((c) => c.byUserId === userId)
    );

    const myStats = {
      shiftsThisMonth: shiftsWithMe.length,
      totalCompletions: totalMyComps,
      completionRate: totalMyComps > 0 ? Math.round((doneMyComps / totalMyComps) * 100) : 0,
    };

    // Upcoming tasks
    const myUpcomingTasks = myTasks.map((t) => ({
      id: t.id,
      date: t.date,
      text: t.text,
      color: t.color,
      locationName: t.location.name,
    }));

    // Training (trainee only)
    const isTrainee = member.taktRole === "TRAINEE";
    let training: any = null;
    if (isTrainee) {
      training = {
        isTrainee: true,
        testsCompleted: testAttempts.filter((t) => t.finishedAt).length,
        testsPassed: testAttempts.filter((t) => t.passed).length,
        recentAttempts: testAttempts.slice(0, 5).map((t) => ({
          testKey: t.testKey,
          score: t.score,
          passed: t.passed,
          finishedAt: t.finishedAt,
        })),
      };
    }

    res.json(okResponse({
      nextShift,
      myStats,
      myUpcomingTasks,
      training,
      features: {
        availableShiftsPoolEnabled: false,
        trainingModuleConfigured: testAttempts.length > 0,
      },
    }));
  } catch (err) {
    console.error("Dashboard barista error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
