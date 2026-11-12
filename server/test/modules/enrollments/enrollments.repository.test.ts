import type { Database } from "../../../src/database/connection";
import {
  PgEnrollmentRepository,
  type Enrollment,
} from "../../../src/modules/enrollments/enrollments.repository";

// Colunas com alias em camelCase, usadas no RETURNING e nos SELECTs.
const ENROLLMENT_COLUMNS =
  'student_ra AS "studentRa", course_id AS "courseId", enrolled_at AS "enrolledAt"';

// Data fixa para tornar os testes reproduzíveis.
const ENROLLED_AT = new Date("2025-03-10T12:00:00.000Z");

function buildEnrollment(studentRa = 123, courseId = 7): Enrollment {
  return { studentRa, courseId, enrolledAt: ENROLLED_AT };
}

// Remove diferenças de espaços e quebras de linha antes de comparar o SQL.
function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

describe("PgEnrollmentRepository", () => {
  let query: jest.MockedFunction<Database["query"]>;
  let repository: PgEnrollmentRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    query = jest.fn();
    const database: Database = { query };
    repository = new PgEnrollmentRepository(database);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("create: insere student_ra e course_id com $1, $2, envia [123, 7] e retorna a linha com aliases camelCase", async () => {
    const row = buildEnrollment(123, 7);
    query.mockResolvedValue({ rows: [row] });

    const result = await repository.create(123, 7);

    expect(result).toEqual(row);
    expect(Object.keys(result)).toEqual(["studentRa", "courseId", "enrolledAt"]);
    expect(result.enrolledAt).toBe(ENROLLED_AT);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      "INSERT INTO enrollments (student_ra, course_id) VALUES ($1, $2) " +
        `RETURNING ${ENROLLMENT_COLUMNS}`,
    );
    expect(params).toEqual([123, 7]);
  });

  test("findAll: retorna as linhas simuladas, seleciona com aliases, usa ORDER BY student_ra, course_id e não envia parâmetros", async () => {
    const rows = [buildEnrollment(123, 1), buildEnrollment(123, 7)];
    query.mockResolvedValue({ rows });

    const result = await repository.findAll();

    expect(result).toEqual(rows);
    expect(result[0].enrolledAt).toBe(ENROLLED_AT);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      `SELECT ${ENROLLMENT_COLUMNS} FROM enrollments ORDER BY student_ra, course_id`,
    );
    expect(params).toBeUndefined();
    expect(query.mock.calls[0]).toHaveLength(1);
  });

  test("findAll: retorna lista vazia quando rows é []", async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await repository.findAll();

    expect(result).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("findOne: retorna a primeira linha, filtra por student_ra = $1 AND course_id = $2 e envia [123, 7]", async () => {
    const row = buildEnrollment(123, 7);
    query.mockResolvedValue({ rows: [row] });

    const result = await repository.findOne(123, 7);

    expect(result).toEqual(row);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      `SELECT ${ENROLLMENT_COLUMNS} FROM enrollments ` +
        "WHERE student_ra = $1 AND course_id = $2",
    );
    expect(params).toEqual([123, 7]);
  });

  test("findOne: retorna undefined quando rows é []", async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await repository.findOne(123, 7);

    expect(result).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("create: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no create");
    query.mockRejectedValue(failure);

    await expect(repository.create(123, 7)).rejects.toBe(failure);
  });

  test("findAll: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no findAll");
    query.mockRejectedValue(failure);

    await expect(repository.findAll()).rejects.toBe(failure);
  });

  test("findOne: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no findOne");
    query.mockRejectedValue(failure);

    await expect(repository.findOne(123, 7)).rejects.toBe(failure);
  });
});
