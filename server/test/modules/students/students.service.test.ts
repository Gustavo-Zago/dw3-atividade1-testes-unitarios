import { HttpError } from "../../../src/errors";
import type {
  Student,
  StudentRepository,
} from "../../../src/modules/students/students.repository";
import { StudentsService } from "../../../src/modules/students/students.service";

// Aguarda a rejeição da promessa e confirma que é um HttpError com o status esperado.
async function expectHttpError(
  action: Promise<unknown>,
  statusCode: number,
): Promise<void> {
  const error = await action.then(
    () => {
      throw new Error("A operação deveria ser rejeitada, mas foi resolvida.");
    },
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).statusCode).toBe(statusCode);
}

// Dublê do repositório: cada método é uma função simulada controlada pelo teste.
function createRepositoryDouble(): jest.Mocked<StudentRepository> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };
}

describe("StudentsService", () => {
  let repository: jest.Mocked<StudentRepository>;
  let service: StudentsService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = createRepositoryDouble();
    service = new StudentsService(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("cria o aluno com { ra: 123, name: 'Ana' }, retorna o registro e encaminha os dados ao repositório", async () => {
    const created: Student = { ra: 123, name: "Ana" };
    repository.create.mockResolvedValue(created);

    const result = await service.create({ ra: 123, name: "Ana" });

    expect(result).toEqual(created);
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith({ ra: 123, name: "Ana" });
  });

  test("lança erro 400 para RA inválido (0) e não chama repository.create", async () => {
    await expectHttpError(service.create({ ra: 0, name: "Ana" }), 400);

    expect(repository.create).not.toHaveBeenCalled();
  });

  test("traduz a violação de unicidade (23505) em erro 409 para RA duplicado", async () => {
    repository.create.mockRejectedValue({ code: "23505" });

    await expectHttpError(service.create({ ra: 123, name: "Ana" }), 409);

    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  test("lança erro 404 quando o repositório não encontra o aluno de RA 123", async () => {
    repository.findOne.mockResolvedValue(undefined);

    await expectHttpError(service.findOne(123), 404);

    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledWith(123);
  });

  test("propaga a mesma instância de Error inesperado lançado por repository.create", async () => {
    const failure = new Error("falha inesperada no create");
    repository.create.mockRejectedValue(failure);

    await expect(service.create({ ra: 123, name: "Ana" })).rejects.toBe(failure);
  });

  test("retorna a lista de alunos e chama repository.findAll uma vez, sem argumentos", async () => {
    const students: Student[] = [
      { ra: 123, name: "Ana" },
      { ra: 456, name: "Bruno" },
    ];
    repository.findAll.mockResolvedValue(students);

    const result = await service.findAll();

    expect(result).toEqual(students);
    expect(repository.findAll).toHaveBeenCalledTimes(1);
    expect(repository.findAll).toHaveBeenCalledWith();
  });

  test("retorna o aluno existente e chama repository.findOne uma vez com o RA 123", async () => {
    const student: Student = { ra: 123, name: "Ana" };
    repository.findOne.mockResolvedValue(student);

    const result = await service.findOne(123);

    expect(result).toEqual(student);
    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledWith(123);
  });
});
