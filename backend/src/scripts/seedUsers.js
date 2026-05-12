import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { closePool, query } from "../config/db.js";

dotenv.config();

const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? "Password123!";

const roles = [
  ["EMPLOYEE", "Employee"],
  ["LINE_MANAGER", "Line Manager"],
  ["INVENTORY_OFFICER", "Inventory Officer"],
  ["PROCUREMENT_OFFICER", "Procurement Officer"],
  ["FINANCE", "Finance"],
  ["HR_OFFICER", "HR Officer"],
  ["SUPER_ADMIN", "Super Admin"]
];

const users = [
  {
    employeeCode: "ADM-001",
    fullName: "Super Admin",
    email: "admin@company.com",
    roleCode: "SUPER_ADMIN",
    department: "Management",
    managerEmail: null,
    salary: 150000
  },
  {
    employeeCode: "MGR-001",
    fullName: "Kamran Malik",
    email: "kamran@company.com",
    roleCode: "LINE_MANAGER",
    department: "IT",
    managerEmail: null,
    salary: 120000
  },
  {
    employeeCode: "EMP-001",
    fullName: "Ahmad Raza",
    email: "ahmad@company.com",
    roleCode: "EMPLOYEE",
    department: "IT",
    managerEmail: "kamran@company.com",
    salary: 65000
  },
  {
    employeeCode: "EMP-002",
    fullName: "Bilal Ahmed",
    email: "bilal@company.com",
    roleCode: "EMPLOYEE",
    department: "IT",
    managerEmail: "kamran@company.com",
    salary: 70000
  },
  {
    employeeCode: "EMP-003",
    fullName: "Sara Khan",
    email: "sara@company.com",
    roleCode: "EMPLOYEE",
    department: "Finance",
    managerEmail: "kamran@company.com",
    salary: 68000
  },
  {
    employeeCode: "HR-001",
    fullName: "Nadia Hussain",
    email: "nadia@company.com",
    roleCode: "HR_OFFICER",
    department: "HR",
    managerEmail: null,
    salary: 95000
  },
  {
    employeeCode: "FIN-001",
    fullName: "Tariq Mehmood",
    email: "tariq@company.com",
    roleCode: "FINANCE",
    department: "Finance",
    managerEmail: null,
    salary: 100000
  },
  {
    employeeCode: "INV-001",
    fullName: "Zubair Hassan",
    email: "zubair@company.com",
    roleCode: "INVENTORY_OFFICER",
    department: "Warehouse",
    managerEmail: null,
    salary: 85000
  },
  {
    employeeCode: "PROC-001",
    fullName: "Asim Qureshi",
    email: "asim@company.com",
    roleCode: "PROCUREMENT_OFFICER",
    department: "Procurement",
    managerEmail: null,
    salary: 90000
  }
];

const inventoryItems = [
  ["LST-001", "Laptop Stand", "Adjustable aluminum stand", "pcs", 8, 5],
  ["USB-001", "USB Hub", "4-port USB-C hub", "pcs", 3, 10],
  ["CHR-001", "Office Chair", "Ergonomic office chair", "pcs", 12, 5],
  ["PAP-001", "Printer Paper", "A4 80gsm", "reams", 450, 100],
  ["MON-001", "Monitor", "24 inch LED", "pcs", 2, 3]
];

const vendors = [
  ["VND-101", "Tech Supplies Co", "IT hardware", "Raza Ali", "orders@techsupplies.local", "+92-300-1111111", "Karachi"],
  ["VND-102", "Office Mart", "Office supplies", "Hina Iqbal", "sales@officemart.local", "+92-300-2222222", "Lahore"],
  ["VND-103", "Stationery Hub", "Stationery", "Usman Tariq", "hello@stationeryhub.local", "+92-300-3333333", "Islamabad"]
];

async function upsertRoles() {
  for (const [code, label] of roles) {
    await query(
      `
        INSERT INTO roles (code, label)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE label = VALUES(label)
      `,
      [code, label]
    );
  }
}

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
        manager_id,
        basic_salary,
        joined_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
      ON DUPLICATE KEY UPDATE
        employee_code = VALUES(employee_code),
        full_name = VALUES(full_name),
        email = VALUES(email),
        password_hash = VALUES(password_hash),
        role_code = VALUES(role_code),
        department = VALUES(department),
        manager_id = VALUES(manager_id),
        basic_salary = VALUES(basic_salary),
        status = 'ACTIVE'
    `,
    [
      user.employeeCode,
      user.fullName,
      user.email,
      passwordHash,
      user.roleCode,
      user.department,
      managerId,
      user.salary
    ]
  );
}

async function findUser(email) {
  const rows = await query(
    `SELECT id, full_name, email FROM users WHERE email = ? LIMIT 1`,
    [email]
  );

  if (!rows[0]) {
    console.log(`⚠️ User not found: ${email}`);
    return null;
  }

  return rows[0];
}

async function seedLeaveBalances() {
  const allUsers = await query(`SELECT id FROM users WHERE email LIKE '%@company.com'`);
  const balances = [
    ["Annual Leave", 20],
    ["Sick Leave", 10],
    ["Casual Leave", 5],
    ["Maternity/Paternity", 0]
  ];

  for (const user of allUsers) {
    for (const [leaveType, total] of balances) {
      await query(
        `
          INSERT INTO leave_balances (user_id, leave_type, total_days, used_days)
          VALUES (?, ?, ?, 0)
          ON DUPLICATE KEY UPDATE total_days = VALUES(total_days)
        `,
        [user.id, leaveType, total]
      );
    }
  }
}

async function seedInventory() {
  for (const item of inventoryItems) {
    await query(
      `
        INSERT INTO inventory_stock (
          sku,
          item_name,
          specification,
          unit,
          quantity_on_hand,
          reorder_level
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          item_name = VALUES(item_name),
          specification = VALUES(specification),
          unit = VALUES(unit),
          quantity_on_hand = VALUES(quantity_on_hand),
          reorder_level = VALUES(reorder_level)
      `,
      item
    );
  }
}

async function seedVendors() {
  for (const vendor of vendors) {
    await query(
      `
        INSERT INTO vendors (
          vendor_code,
          vendor_name,
          category,
          contact_name,
          email,
          phone,
          address
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vendor_name = VALUES(vendor_name),
          category = VALUES(category),
          contact_name = VALUES(contact_name),
          email = VALUES(email),
          phone = VALUES(phone),
          address = VALUES(address),
          status = 'ACTIVE'
      `,
      vendor
    );
  }
}

async function seedAttendance() {
  const allUsers = await query(`SELECT id FROM users WHERE email LIKE '%@company.com'`);

  for (const user of allUsers) {
    let workingDayCount = 0;
    let offset = 1;

    while (workingDayCount < 20) {
      const weekdayRows = await query(
        `
          SELECT DAYOFWEEK(DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)) AS weekday
        `,
        [offset]
      );
      const weekday = Number(weekdayRows[0].weekday);

      if (![1, 7].includes(weekday)) {
        await query(
          `
            INSERT INTO attendance (
              user_id,
              attendance_date,
              sign_in_at,
              sign_out_at,
              status,
              source
            )
            VALUES (
              ?,
              DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY),
              TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY), '09:05:00'),
              TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY), '17:35:00'),
              'PRESENT',
              'SEED'
            )
            ON DUPLICATE KEY UPDATE status = VALUES(status)
          `,
          [user.id, offset, offset, offset]
        );
        workingDayCount += 1;
      }

      offset += 1;
    }
  }
}

async function seedLeaveRequests() {
  const ahmad = await findUser("ahmad@company.com");
  const bilal = await findUser("bilal@company.com");
  const kamran = await findUser("kamran@company.com");
  const nadia = await findUser("nadia@company.com");

  // ✅ Strict check based on your actual users
  if (!ahmad || !bilal || !kamran || !nadia) {
    console.log("⚠️ Skipping leave requests: required users missing");
    return;
  }

  // ✅ Avoid duplicate inserts
  const existing = await query(`
    SELECT id FROM leave_requests 
    WHERE user_id IN (?, ?) 
    LIMIT 1
  `, [ahmad.id, bilal.id]);

  if (existing.length) {
    console.log("ℹ️ Leave requests already seeded");
    return;
  }

  // Pending request
  await query(
    `
      INSERT INTO leave_requests (
        user_id,
        manager_id,
        leave_type,
        start_date,
        end_date,
        days,
        handover_person,
        reason,
        status
      )
      VALUES (?, ?, 'Annual Leave',
        DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
        DATE_ADD(CURRENT_DATE(), INTERVAL 9 DAY),
        3,
        'Bilal Ahmed',
        'Family commitment',
        'PENDING_MANAGER'
      )
    `,
    [ahmad.id, kamran.id]
  );

  // Approved request
  await query(
    `
      INSERT INTO leave_requests (
        user_id,
        manager_id,
        leave_type,
        start_date,
        end_date,
        days,
        handover_person,
        reason,
        status,
        manager_note,
        hr_note,
        manager_action_by,
        hr_action_by,
        manager_action_at,
        hr_action_at
      )
      VALUES (?, ?, 'Sick Leave',
        DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY),
        DATE_SUB(CURRENT_DATE(), INTERVAL 9 DAY),
        2,
        'Ahmad Raza',
        'Fever',
        'APPROVED',
        'Approved',
        'Approved',
        ?, ?, NOW(), NOW()
      )
    `,
    [bilal.id, kamran.id, kamran.id, nadia.id]
  );

  console.log("✅ Leave requests seeded");
}

async function seedRequisitions() {
  const ahmad = await findUser("ahmad@company.com");
  const bilal = await findUser("bilal@company.com");
  const kamran = await findUser("kamran@company.com");

  const existing = await query(`SELECT id FROM requisitions WHERE requisition_number IN ('REQ-SEED-001', 'REQ-SEED-002')`);
  if (existing.length) {
    return;
  }

  const requests = [
    ["REQ-SEED-001", ahmad.id, kamran.id, "Laptop Stand Request", "Need laptop stand for workstation", "SUBMITTED", "Laptop Stand", 1],
    ["REQ-SEED-002", bilal.id, kamran.id, "USB Hub Request", "Need USB hub for testing devices", "APPROVED", "USB Hub", 3]
  ];

  for (const [number, requesterId, managerId, title, justification, status, item, quantity] of requests) {
    const result = await query(
      `
        INSERT INTO requisitions (
          requisition_number,
          requested_by_user_id,
          manager_id,
          title,
          justification,
          status,
          approved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'APPROVED' THEN NOW() ELSE NULL END)
      `,
      [number, requesterId, managerId, title, justification, status, status]
    );

    await query(
      `
        INSERT INTO requisition_items (
          requisition_id,
          line_number,
          item_description,
          quantity_requested,
          unit
        )
        VALUES (?, 1, ?, ?, 'pcs')
      `,
      [result.insertId, item, quantity]
    );

    await query(
      `
        INSERT INTO approval_logs (
          requisition_id,
          actor_user_id,
          action,
          remarks
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        result.insertId,
        status === "APPROVED" ? managerId : requesterId,
        status === "APPROVED" ? "APPROVED" : "SUBMITTED",
        status === "APPROVED" ? "Seed approval for inventory queue." : justification
      ]
    );
  }
}

async function seedAnnouncements() {
  const hr = await findUser("nadia@company.com");

  await query(
    `
      INSERT INTO announcements (
        title,
        content,
        audience,
        created_by_user_id
      )
      SELECT ?, ?, 'All staff', ?
      WHERE NOT EXISTS (
        SELECT 1 FROM announcements WHERE title = ?
      )
    `,
    [
      "Office closed May 1 - Labour Day",
      "Office will remain closed on May 1 for Labour Day.",
      hr.id,
      "Office closed May 1 - Labour Day"
    ]
  );
}

async function seedFinanceRequests() {
  const ahmad = await findUser("ahmad@company.com");
  const sara = await findUser("sara@company.com");

  await query(
    `
      INSERT INTO advance_requests (user_id, amount, reason, repayment_months)
      SELECT ?, 25000, 'Medical emergency', 3
      WHERE NOT EXISTS (SELECT 1 FROM advance_requests WHERE user_id = ? AND reason = 'Medical emergency')
    `,
    [ahmad.id, ahmad.id]
  );

  await query(
    `
      INSERT INTO reimbursement_claims (
        user_id,
        claim_type,
        amount,
        expense_date,
        description,
        receipt_reference
      )
      SELECT ?, 'Travel', 4500, DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY), 'Client visit Lahore', 'RCPT-SEED-001'
      WHERE NOT EXISTS (SELECT 1 FROM reimbursement_claims WHERE receipt_reference = 'RCPT-SEED-001')
    `,
    [sara.id]
  );
}

async function seedTasks() {
  const ahmad = await findUser("ahmad@company.com");
  const tasks = [
    ["Prepare workstation inventory list", "TODO"],
    ["Update support ticket notes", "IN_PROGRESS"],
    ["Submit weekly status", "DONE"]
  ];

  for (const [title, column] of tasks) {
    await query(
      `
        INSERT INTO work_tasks (
          user_id,
          title,
          column_key,
          due_date
        )
        SELECT ?, ?, ?, DATE_ADD(CURRENT_DATE(), INTERVAL 3 DAY)
        WHERE NOT EXISTS (
          SELECT 1 FROM work_tasks WHERE user_id = ? AND title = ?
        )
      `,
      [ahmad.id, title, column, ahmad.id, title]
    );
  }
}

async function seedNotifications() {
  const allUsers = await query(`SELECT id, full_name, email FROM users WHERE email LIKE '%@company.com'`);
  const admin = await findUser("admin@company.com");

  for (const user of allUsers) {
    for (const index of [1, 2]) {
      const subject = index === 1 ? "Welcome to CompanyOS" : "Workflow notifications enabled";
      const existing = await query(
        `
          SELECT nr.id
          FROM notification_recipients nr
          INNER JOIN notifications n ON n.id = nr.notification_id
          WHERE nr.recipient_user_id = ?
            AND n.subject = ?
          LIMIT 1
        `,
        [user.id, subject]
      );

      if (existing[0]) {
        continue;
      }

      const result = await query(
        `
          INSERT INTO notifications (
            event_type,
            entity_type,
            template,
            subject,
            payload_json,
            triggered_by_user_id
          )
          VALUES ('SEED', 'SYSTEM', 'seed', ?, JSON_OBJECT('message', ?), ?)
        `,
        [
          subject,
          index === 1
            ? `Hello ${user.full_name}, your CompanyOS account is ready.`
            : "Approvals, stock, finance, and HR alerts will appear here.",
          admin.id
        ]
      );

      await query(
        `
          INSERT INTO notification_recipients (
            notification_id,
            recipient_user_id,
            recipient_email,
            recipient_name,
            channel
          )
          VALUES (?, ?, ?, ?, 'IN_APP')
        `,
        [result.insertId, user.id, user.email, user.full_name]
      );
    }
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await upsertRoles();

  for (const user of users) {
    await upsertUser(user, passwordHash);
  }

  await seedLeaveBalances();
  await seedInventory();
  await seedVendors();
  await seedAttendance();
  await seedLeaveRequests();
  await seedRequisitions();
  await seedAnnouncements();
  await seedFinanceRequests();
  await seedTasks();
  await seedNotifications();

  console.log("CompanyOS demo data is seeded.");
  console.log(`Default password: ${defaultPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
