import type { Database } from "../../../src/database/connection";
import {
  PgStudentRepository,
  type Student,
} from "../../../src/modules/students/students.repository";

// Remove diferenças de espaços e quebras de linha antes de comparar o SQL.
function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

describe("PgStudentRepository", () => {
  let query: jest.MockedFunction<Database["query"]>;
  let repository: PgStudentRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    query = jest.fn();
    const database: Database = { query };
    repository = new PgStudentRepository(database);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("create: insere ra e name com $1, $2, envia [ra, name] e retorna a linha de RETURNING ra, name", async () => {
    const row: Student = { ra: 123, name: "Ana" };
    query.mockResolvedValue({ rows: [row] });

    const result = await repository.create({ ra: 123, name: "Ana" });

    expect(result).toEqual(row);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      "INSERT INTO students (ra, name) VALUES ($1, $2) RETURNING ra, name",
    );
    expect(params).toEqual([123, "Ana"]);
  });

  test("findAll: retorna as linhas simuladas, seleciona ra, name com ORDER BY name e não envia parâmetros", async () => {
    const rows: Student[] = [
      { ra: 123, name: "Ana" },
      { ra: 456, name: "Bruno" },
    ];
    query.mockResolvedValue({ rows });

    const result = await repository.findAll();

    expect(result).toEqual(rows);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      "SELECT ra, name FROM students ORDER BY name",
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

  test("findOne: retorna a primeira linha, filtra por ra = $1 e envia [123]", async () => {
    const row: Student = { ra: 123, name: "Ana" };
    query.mockResolvedValue({ rows: [row] });

    const result = await repository.findOne(123);

    expect(result).toEqual(row);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      "SELECT ra, name FROM students WHERE ra = $1",
    );
    expect(params).toEqual([123]);
  });

  test("findOne: retorna undefined quando rows é []", async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await repository.findOne(123);

    expect(result).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("create: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no create");
    query.mockRejectedValue(failure);

    await expect(
      repository.create({ ra: 123, name: "Ana" }),
    ).rejects.toBe(failure);
  });

  test("findAll: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no findAll");
    query.mockRejectedValue(failure);

    await expect(repository.findAll()).rejects.toBe(failure);
  });

  test("findOne: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no findOne");
    query.mockRejectedValue(failure);

    await expect(repository.findOne(123)).rejects.toBe(failure);
  });
});
