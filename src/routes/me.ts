import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { okResponse } from "../schemas/common.js";

const router = Router();

/** GET /api/me — current user profile + org memberships */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = await req.db.user.findUnique({
      where: { id: req.authUser!.id },
      include: {
        members: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true, logo: true, plan: true, timezone: true },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }

    res.json(okResponse({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      memberships: user.members.map((m) => ({
        memberId: m.id,
        orgId: m.organizationId,
        orgName: m.organization.name,
        orgSlug: m.organization.slug,
        orgLogo: m.organization.logo,
        orgPlan: m.organization.plan,
        orgTimezone: m.organization.timezone,
        role: m.role,
        taktRole: m.taktRole,
        locationIds: m.locationIds,
      })),
    }));
  } catch (err) {
    console.error("GET /api/me error:", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: "Server error" } });
  }
});

export default router;
