import { query } from "../../config/db.js";
import { ApiError } from "../../utils/apiError.js";
import { sendAnnouncementNotification } from "../notifications/notifications.service.js";

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    message: row.content,
    audience: row.audience,
    owner: row.owner_name,
    createdByUserId: row.created_by_user_id,
    date: row.created_at,
    createdAt: row.created_at,
    isActive: Boolean(row.is_active)
  };
}

export async function listAnnouncements({ includeInactive = false } = {}) {
  const rows = await query(
    `
      SELECT
        a.*,
        u.full_name AS owner_name
      FROM announcements a
      INNER JOIN users u ON u.id = a.created_by_user_id
      WHERE ? = TRUE OR a.is_active = TRUE
      ORDER BY a.created_at DESC, a.id DESC
    `,
    [Boolean(includeInactive)]
  );

  return rows.map(mapAnnouncement);
}

export async function createAnnouncement(user, payload) {
  const title = String(payload.title ?? "").trim();
  const content = String(payload.content ?? payload.message ?? "").trim();
  const audience = String(payload.audience ?? "All staff").trim() || "All staff";

  if (!title || title.length > 180) {
    throw new ApiError(400, "Announcement title is required and must be 180 characters or fewer.");
  }

  if (!content || content.length > 5000) {
    throw new ApiError(400, "Announcement content is required and must be 5000 characters or fewer.");
  }

  const result = await query(
    `
      INSERT INTO announcements (
        title,
        content,
        audience,
        created_by_user_id
      )
      VALUES (?, ?, ?, ?)
    `,
    [title, content, audience, user.id]
  );

  const announcement = (await listAnnouncements({ includeInactive: true })).find(
    (item) => item.id === result.insertId
  );

  await sendAnnouncementNotification({
    subject: title,
    message: content,
    audience,
    announcementId: result.insertId,
    triggeredByUserId: user.id
  });

  return announcement;
}

export async function deleteAnnouncement(announcementId) {
  await query(
    `
      UPDATE announcements
      SET is_active = FALSE
      WHERE id = ?
    `,
    [announcementId]
  );
}
