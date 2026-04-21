import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { query } from "../config/db.js";

dotenv.config();

const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "Password123!";

const users = [
  {
    employeeCode: "LM-001",
    fullName: "Layla Manager",
    email: "manager@ims.local",
    roleCode: "LINE_MANAGER",
    department: "Operations",
    managerEmail: null
  },
  {
    employeeCode: "EMP-001",
    fullName: "Ayaan Employee",
    email: "employee@ims.local",
    roleCode: "EMPLOYEE",
    department: "Operations",
    managerEmail: "manager@ims.local"
  },
  {
    employeeCode: "INV-001",
    fullName: "Inaya Inventory",
    email: "inventory@ims.local",
    roleCode: "INVENTORY_OFFICER",
    department: "Stores",
    managerEmail: null
  },
  {
    employeeCode: "PROC-001",
    fullName: "Omar Procurement",
    email: "procurement@ims.local",
    roleCode: "PROCUREMENT_OFFICER",
    department: "Procurement",
    managerEmail: null
  },
  {
    employeeCode: "FIN-001",
    fullName: "Sara Finance",
    email: "finance@ims.local",
    roleCode: "FINANCE",
    department: "Finance",
    managerEmail: null
  }
];

async function upsertUser(user, passwordHash) {
  const managerId =
    user.managerEmail === null
      ? null
      : (
          await query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [user.managerEmail])
        )[0]?.id ?? null;

  await query(
    `
      INSERT INTO users (
        employee_code,
        full_name,
        email,
        password_hash,
        role_code,
        department,
        manager_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        password_hash = VALUES(password_hash),
        role_code = VALUES(role_code),
        department = VALUES(department),
        manager_id = VALUES(manager_id),
        status = 'ACTIVE'
    `,
    [
      user.employeeCode,
      user.fullName,
      user.email,
      passwordHash,
      user.roleCode,
      user.department,
      managerId
    ]
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  for (const user of users) {
    await upsertUser(user, passwordHash);
  }

  console.log("Demo users are seeded.");
  console.log(`Default password: ${defaultPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
