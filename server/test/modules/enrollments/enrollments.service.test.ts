import { HttpError } from "../../../src/errors";
import type {
  Enrollment,
  EnrollmentRepository,
} from "../../../src/modules/enrollments/enrollments.repository";
import { EnrollmentsService } from "../../../src/modules/enrollments/enrollments.service";

// Data fixa para tornar os testes reproduzíveis.
const ENROLLED_AT = new Date("2025-03-10T12:00:00.000Z");

function buildEnrollment(studentRa = 123, courseId = 1): Enrollment {
  return { studentRa, courseId, enrolledAt: ENROLLED_AT };
}

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
function createRepositoryDouble(): jest.Mocked<EnrollmentRepository> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };
}

describe("EnrollmentsService", () => {
  let repository: jest.Mocked<EnrollmentRepository>;
  let service: EnrollmentsService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = createRepositoryDouble();
    service = new EnrollmentsService(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("cria a matrícula, retorna o registro e passa os argumentos separados 123 e 1, nessa ordem", async () => {
    const created = buildEnrollment(123, 1);
    repository.create.mockResolvedValue(created);

    const result = await service.create({ studentRa: 123, courseId: 1 });

    expect(result).toEqual(created);
    expect(result.enrolledAt).toBe(ENROLLED_AT);
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(123, 1);
  });

  test.each([
    ["studentRa inválido (0)", { studentRa: 0, courseId: 1 }],
    ["courseId inválido (0)", { studentRa: 123, courseId: 0 }],
  ])(
    "lança erro 400 para %s e não chama repository.create",
    async (_cenario, input) => {
      await expectHttpError(service.create(input), 400);

      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  test("traduz a violação de chave estrangeira (23503) em erro 404 para aluno ou disciplina inexistente", async () => {
    repository.create.mockRejectedValue({ code: "23503" });

    await expectHttpError(service.create({ studentRa: 123, courseId: 1 }), 404);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(123, 1);
  });

  test("traduz a violação de unicidade (23505) em erro 409 para matrícula duplicada", async () => {
    repository.create.mockRejectedValue({ code: "23505" });

    await expectHttpError(service.create({ studentRa: 123, courseId: 1 }), 409);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(123, 1);
  });

  test("lança erro 404 em findOne(123, 1) quando não há matrícula e encaminha os dois ids na ordem correta", async () => {
    repository.findOne.mockResolvedValue(undefined);

    await expectHttpError(service.findOne(123, 1), 404);

    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledWith(123, 1);
  });

  test("propaga a mesma instância de Error inesperado lançado por repository.create", async () => {
    const failure = new Error("falha inesperada no create");
    repository.create.mockRejectedValue(failure);

    await expect(
      service.create({ studentRa: 123, courseId: 1 }),
    ).rejects.toBe(failure);
  });

  test("retorna a lista de matrículas e chama repository.findAll uma vez, sem argumentos", async () => {
    const enrollments = [buildEnrollment(123, 1), buildEnrollment(456, 2)];
    repository.findAll.mockResolvedValue(enrollments);

    const result = await service.findAll();

    expect(result).toEqual(enrollments);
    expect(repository.findAll).toHaveBeenCalledTimes(1);
    expect(repository.findAll).toHaveBeenCalledWith();
  });

  test("retorna a matrícula existente e chama repository.findOne uma vez com ambos os identificadores", async () => {
    const enrollment = buildEnrollment(123, 1);
    repository.findOne.mockResolvedValue(enrollment);

    const result = await service.findOne(123, 1);

    expect(result).toEqual(enrollment);
    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledWith(123, 1);
  });
});
