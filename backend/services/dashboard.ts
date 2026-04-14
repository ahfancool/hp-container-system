import { listContainers, type ContainerRecord } from "./containers";
import type { AppEnv, AppRole } from "./env";
import {
  listStudents,
  type StudentLatestTransaction,
  type StudentListItem,
  type StudentPhoneStatus
} from "./students";
import { createServiceRoleClient } from "./supabase";

type RecentTransactionRow = {
  action: "IN" | "OUT";
  container_id: string;
  created_at: string;
  id: string;
  operator_id: string | null;
  student_id: string;
  timestamp: string;
  type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
};

type UserRow = {
  id: string;
  name: string;
  role: AppRole;
};

export type DashboardStudentStatus = {
  className: string;
  gradeLevel: string;
  id: string;
  latestTransaction: {
    action: "IN" | "OUT";
    containerId: string;
    containerLocation: string | null;
    containerName: string | null;
    timestamp: string;
    type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
  } | null;
  major: string | null;
  name: string;
  nextExpectedAction: "IN" | "OUT";
  nis: string;
  pendingApproval: StudentListItem["pendingApproval"];
  phoneStatus: StudentPhoneStatus;
  readyForTeacherOverride: boolean;
};

export type DashboardClassSummary = {
  className: string;
  emergencyReleaseCount: number;
  insideCount: number;
  notScannedCount: number;
  outsideCount: number;
  pendingApprovalCount: number;
  totalStudents: number;
};

export type DashboardContainerSummary = {
  id: string;
  insideCount: number;
  isActive: boolean;
  location: string;
  name: string;
};

export type DashboardRecentActivity = {
  action: "IN" | "OUT";
  container: {
    id: string;
    location: string | null;
    name: string | null;
  };
  id: string;
  operator: {
    id: string;
    name: string;
    role: AppRole;
  } | null;
  student: {
    className: string | null;
    id: string;
    name: string | null;
    nis: string | null;
  };
  timestamp: string;
  type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
};

export type DashboardStatusPayload = {
  authorizedRole: AppRole;
  classSummaries: DashboardClassSummary[];
  containerSummaries: DashboardContainerSummary[];
  emergencyReleases: DashboardStudentStatus[];
  generatedAt: string;
  recentActivities: DashboardRecentActivity[];
  students: {
    inside: DashboardStudentStatus[];
    notScanned: DashboardStudentStatus[];
    outside: DashboardStudentStatus[];
  };
  summary: {
    activeContainerCount: number;
    activeStudentCount: number;
    emergencyReleaseCount: number;
    insideCount: number;
    insideRate: number;
    notScannedCount: number;
    outsideCount: number;
    overrideOutCount: number;
    pendingApprovalCount: number;
    totalStudents: number;
  };
};

function sortStudents(items: StudentListItem[]): StudentListItem[] {
  return [...items].sort((left, right) => {
    const classCompare = left.className.localeCompare(right.className, "id");

    if (classCompare !== 0) {
      return classCompare;
    }

    return left.name.localeCompare(right.name, "id");
  });
}

function mapStudentStatus(
  student: StudentListItem,
  containerMap: Map<string, ContainerRecord>
): DashboardStudentStatus {
  const latestTransaction = student.latestTransaction
    ? mapLatestTransaction(student.latestTransaction, containerMap)
    : null;

  return {
    className: student.className,
    gradeLevel: student.gradeLevel,
    id: student.id,
    latestTransaction,
    major: student.major,
    name: student.name,
    nextExpectedAction: student.nextExpectedAction,
    nis: student.nis,
    pendingApproval: student.pendingApproval,
    phoneStatus: student.phoneStatus,
    readyForTeacherOverride: student.readyForTeacherOverride
  };
}

function mapLatestTransaction(
  transaction: Exclude<StudentLatestTransaction, null>,
  containerMap: Map<string, ContainerRecord>
) {
  const container = containerMap.get(transaction.containerId);

  return {
    action: transaction.action,
    containerId: transaction.containerId,
    containerLocation: container?.location ?? null,
    containerName: container?.name ?? null,
    timestamp: transaction.timestamp,
    type: transaction.type
  };
}

function buildClassSummaries(
  students: DashboardStudentStatus[]
): DashboardClassSummary[] {
  const classMap = new Map<string, DashboardClassSummary>();

  for (const student of students) {
    const current = classMap.get(student.className) ?? {
      className: student.className,
      emergencyReleaseCount: 0,
      insideCount: 0,
      notScannedCount: 0,
      outsideCount: 0,
      pendingApprovalCount: 0,
      totalStudents: 0
    };

    current.totalStudents += 1;

    if (student.phoneStatus === "INSIDE") {
      current.insideCount += 1;
    } else if (student.phoneStatus === "OUTSIDE") {
      current.outsideCount += 1;
    } else {
      current.notScannedCount += 1;
    }

    if (
      student.phoneStatus === "OUTSIDE" &&
      student.latestTransaction?.type === "DARURAT"
    ) {
      current.emergencyReleaseCount += 1;
    }

    if (student.pendingApproval) {
      current.pendingApprovalCount += 1;
    }

    classMap.set(student.className, current);
  }

  return [...classMap.values()].sort((left, right) =>
    left.className.localeCompare(right.className, "id")
  );
}

function buildContainerSummaries(
  containers: ContainerRecord[],
  insideStudents: DashboardStudentStatus[]
): DashboardContainerSummary[] {
  const countByContainer = new Map<string, number>();

  for (const student of insideStudents) {
    const containerId = student.latestTransaction?.containerId;

    if (!containerId) {
      continue;
    }

    countByContainer.set(containerId, (countByContainer.get(containerId) ?? 0) + 1);
  }

  return containers.map((container) => ({
    id: container.id,
    insideCount: countByContainer.get(container.id) ?? 0,
    isActive: container.isActive,
    location: container.location,
    name: container.name
  }));
}

async function listRecentActivities(
  env: AppEnv,
  students: DashboardStudentStatus[],
  containerMap: Map<string, ContainerRecord>
): Promise<DashboardRecentActivity[]> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("phone_transactions")
    .select(
      "id, student_id, container_id, action, type, timestamp, operator_id, created_at"
    )
    .order("timestamp", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`DASHBOARD_RECENT_FETCH_FAILED:${error.message}`);
  }

  const rows = (data ?? []) as RecentTransactionRow[];
  const operatorIds = rows
    .map((row) => row.operator_id)
    .filter((value): value is string => Boolean(value));
  const uniqueOperatorIds = [...new Set(operatorIds)];
  const operatorMap = new Map<string, UserRow>();

  if (uniqueOperatorIds.length > 0) {
    const { data: usersData, error: usersError } = await client
      .from("users")
      .select("id, name, role")
      .in("id", uniqueOperatorIds);

    if (usersError) {
      throw new Error(`DASHBOARD_OPERATORS_FETCH_FAILED:${usersError.message}`);
    }

    for (const row of usersData ?? []) {
      const user = row as UserRow;
      operatorMap.set(user.id, user);
    }
  }

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const missingStudentIds = [
    ...new Set(
      rows
        .map((row) => row.student_id)
        .filter((studentId) => !studentMap.has(studentId))
    )
  ];

  if (missingStudentIds.length > 0) {
    const { data: missingStudents, error: missingStudentsError } = await client
      .from("students")
      .select("id, name, nis, class_name")
      .in("id", missingStudentIds);

    if (missingStudentsError) {
      throw new Error(
        `DASHBOARD_STUDENTS_LOOKUP_FAILED:${missingStudentsError.message}`
      );
    }

    for (const row of missingStudents ?? []) {
      studentMap.set(row.id as string, {
        className: row.class_name as string,
        gradeLevel: "",
        id: row.id as string,
        latestTransaction: null,
        major: null,
        name: row.name as string,
        nextExpectedAction: "IN",
        nis: row.nis as string,
        pendingApproval: null,
        phoneStatus: "NOT_SCANNED",
        readyForTeacherOverride: false
      });
    }
  }

  return rows.map((row) => {
    const student = studentMap.get(row.student_id);
    const container = containerMap.get(row.container_id);
    const operator = row.operator_id ? operatorMap.get(row.operator_id) ?? null : null;

    return {
      action: row.action,
      container: {
        id: row.container_id,
        location: container?.location ?? null,
        name: container?.name ?? null
      },
      id: row.id,
      operator: operator
        ? {
            id: operator.id,
            name: operator.name,
            role: operator.role
          }
        : null,
      student: {
        className: student?.className ?? null,
        id: row.student_id,
        name: student?.name ?? null,
        nis: student?.nis ?? null
      },
      timestamp: row.timestamp,
      type: row.type
    };
  });
}

export async function getDashboardStatusData(
  env: AppEnv,
  role: AppRole
): Promise<DashboardStatusPayload> {
  const [studentItems, containers] = await Promise.all([
    listStudents(env, { includeInactive: false }),
    listContainers(env, true)
  ]);

  const sortedStudents = sortStudents(studentItems);
  const containerMap = new Map(containers.map((container) => [container.id, container]));
  const mappedStudents = sortedStudents.map((student) =>
    mapStudentStatus(student, containerMap)
  );

  const inside = mappedStudents.filter((student) => student.phoneStatus === "INSIDE");
  const outside = mappedStudents.filter((student) => student.phoneStatus === "OUTSIDE");
  const notScanned = mappedStudents.filter(
    (student) => student.phoneStatus === "NOT_SCANNED"
  );
  const emergencyReleases = outside.filter(
    (student) => student.latestTransaction?.type === "DARURAT"
  );
  const overrideOutCount = outside.filter(
    (student) => student.latestTransaction?.type !== "REGULAR"
  ).length;
  const pendingApprovalCount = mappedStudents.filter(
    (student) => student.pendingApproval
  ).length;

  const recentActivities = await listRecentActivities(env, mappedStudents, containerMap);
  const totalStudents = mappedStudents.length;

  return {
    authorizedRole: role,
    classSummaries: buildClassSummaries(mappedStudents),
    containerSummaries: buildContainerSummaries(containers, inside),
    emergencyReleases,
    generatedAt: new Date().toISOString(),
    recentActivities,
    students: {
      inside,
      notScanned,
      outside
    },
    summary: {
      activeContainerCount: containers.filter((container) => container.isActive).length,
      activeStudentCount: totalStudents - notScanned.length,
      emergencyReleaseCount: emergencyReleases.length,
      insideCount: inside.length,
      insideRate:
        totalStudents === 0
          ? 0
          : Number(((inside.length / totalStudents) * 100).toFixed(1)),
      notScannedCount: notScanned.length,
      outsideCount: outside.length,
      overrideOutCount,
      pendingApprovalCount,
      totalStudents
    }
  };
}
