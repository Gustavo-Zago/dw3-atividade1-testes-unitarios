import type { Database } from "../../../src/database/connection";
import {
  PgCourseRepository,
  type Course,
} from "../../../src/modules/courses/courses.repository";

// Remove diferenças de espaços e quebras de linha antes de comparar o SQL.
function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

describe("PgCourseRepository", () => {
  let query: jest.MockedFunction<Database["query"]>;
  let repository: PgCourseRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    query = jest.fn();
    const database: Database = { query };
    repository = new PgCourseRepository(database);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("create: insere o nome com $1, envia [name] e retorna a linha de RETURNING id, name", async () => {
    const row: Course = { id: 7, name: "Qualidade" };
    query.mockResolvedValue({ rows: [row] });

    const result = await repository.create({ name: "Qualidade" });

    expect(result).toEqual(row);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      "INSERT INTO courses (name) VALUES ($1) RETURNING id, name",
    );
    expect(params).toEqual(["Qualidade"]);
  });

  test("findAll: retorna as linhas simuladas, seleciona id, name com ORDER BY id e não envia parâmetros", async () => {
    const rows: Course[] = [
      { id: 1, name: "Banco de Dados" },
      { id: 2, name: "Qualidade" },
    ];
    query.mockResolvedValue({ rows });

    const result = await repository.findAll();

    expect(result).toEqual(rows);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe("SELECT id, name FROM courses ORDER BY id");
    expect(params).toBeUndefined();
    expect(query.mock.calls[0]).toHaveLength(1);
  });

  test("findAll: retorna lista vazia quando rows é []", async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await repository.findAll();

    expect(result).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("findOne: retorna a primeira linha, filtra por id = $1 e envia [7]", async () => {
    const row: Course = { id: 7, name: "Qualidade" };
    query.mockResolvedValue({ rows: [row] });

    const result = await repository.findOne(7);

    expect(result).toEqual(row);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(normalizeSql(sql)).toBe(
      "SELECT id, name FROM courses WHERE id = $1",
    );
    expect(params).toEqual([7]);
  });

  test("findOne: retorna undefined quando rows é []", async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await repository.findOne(7);

    expect(result).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("create: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no create");
    query.mockRejectedValue(failure);

    await expect(repository.create({ name: "Qualidade" })).rejects.toBe(failure);
  });

  test("findAll: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no findAll");
    query.mockRejectedValue(failure);

    await expect(repository.findAll()).rejects.toBe(failure);
  });

  test("findOne: propaga a mesma instância de Error rejeitada por query", async () => {
    const failure = new Error("falha do banco no findOne");
    query.mockRejectedValue(failure);

    await expect(repository.findOne(7)).rejects.toBe(failure);
  });
});
