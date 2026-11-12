import { HttpError } from "../../../src/errors";
import type {
  Course,
  CourseRepository,
} from "../../../src/modules/courses/courses.repository";
import { CoursesService } from "../../../src/modules/courses/courses.service";

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
function createRepositoryDouble(): jest.Mocked<CourseRepository> {
  return {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };
}

describe("CoursesService", () => {
  let repository: jest.Mocked<CourseRepository>;
  let service: CoursesService;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = createRepositoryDouble();
    service = new CoursesService(repository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("create", () => {
    test("cria a disciplina, retorna o registro e chama repository.create uma vez com os dados", async () => {
      const created: Course = { id: 1, name: "Qualidade" };
      repository.create.mockResolvedValue(created);

      const result = await service.create({ name: "Qualidade" });

      expect(result).toEqual(created);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith({ name: "Qualidade" });
    });

    test.each([
      ["null", null],
      ["objeto vazio {}", {}],
      ['nome com 1 caractere ({ name: "A" })', { name: "A" }],
    ])(
      "rejeita %s com erro 400 e não chama repository.create",
      async (_cenario, input) => {
        await expectHttpError(service.create(input), 400);

        expect(repository.create).not.toHaveBeenCalled();
      },
    );

    test("traduz a violação de unicidade (23505) do repositório em erro 409", async () => {
      repository.create.mockRejectedValue({ code: "23505" });

      await expectHttpError(service.create({ name: "Qualidade" }), 409);

      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    test("propaga a mesma instância de Error inesperado lançado por repository.create", async () => {
      const failure = new Error("falha inesperada no create");
      repository.create.mockRejectedValue(failure);

      await expect(service.create({ name: "Qualidade" })).rejects.toBe(failure);
    });

    test("ignora campos extras e envia ao repositório somente { name }", async () => {
      repository.create.mockResolvedValue({ id: 1, name: "Qualidade" });

      await service.create({ name: "Qualidade", extra: true });

      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith({ name: "Qualidade" });
      expect(repository.create.mock.calls[0][0]).not.toHaveProperty("extra");
    });
  });

  describe("findAll", () => {
    test("stub: retorna a lista predefinida e consulta o repositório uma única vez", async () => {
      // STUB: resposta predefinida, sem interesse na lógica interna do repositório.
      const courses: Course[] = [
        { id: 1, name: "Qualidade" },
        { id: 2, name: "Banco de Dados" },
      ];
      repository.findAll.mockResolvedValue(courses);

      const result = await service.findAll();

      expect(result).toEqual(courses);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    test("propaga a mesma instância de Error inesperado lançado por repository.findAll", async () => {
      const failure = new Error("falha inesperada no findAll");
      repository.findAll.mockRejectedValue(failure);

      await expect(service.findAll()).rejects.toBe(failure);
    });
  });

  describe("findOne", () => {
    test("mock: retorna a disciplina existente e encaminha o id 123 ao repositório", async () => {
      // MOCK: além do retorno, verificamos a interação com o repositório.
      const course: Course = { id: 123, name: "Qualidade" };
      repository.findOne.mockResolvedValue(course);

      const result = await service.findOne(123);

      expect(result).toEqual(course);
      expect(repository.findOne).toHaveBeenCalledTimes(1);
      expect(repository.findOne).toHaveBeenCalledWith(123);
    });

    test("lança erro 404 quando o repositório retorna undefined", async () => {
      repository.findOne.mockResolvedValue(undefined);

      await expectHttpError(service.findOne(123), 404);

      expect(repository.findOne).toHaveBeenCalledWith(123);
    });

    test("lança erro 400 para id inválido (0) sem consultar o repositório", async () => {
      await expectHttpError(service.findOne(0), 400);

      expect(repository.findOne).not.toHaveBeenCalled();
    });

    test("propaga a mesma instância de Error inesperado lançado por repository.findOne", async () => {
      const failure = new Error("falha inesperada no findOne");
      repository.findOne.mockRejectedValue(failure);

      await expect(service.findOne(123)).rejects.toBe(failure);
    });

    test("spy: observa o findOne de um stub com jest.spyOn e confirma o identificador 1", async () => {
      // STUB com métodos assíncronos; o SPY observa o método sem trocar seu comportamento.
      const stubRepository: CourseRepository = {
        create: async (data) => ({ id: 1, ...data }),
        findAll: async () => [],
        findOne: async (id) => ({ id, name: "Qualidade" }),
      };
      const findOneSpy = jest.spyOn(stubRepository, "findOne");
      const serviceWithSpy = new CoursesService(stubRepository);

      const result = await serviceWithSpy.findOne(1);

      expect(result).toEqual({ id: 1, name: "Qualidade" });
      expect(findOneSpy).toHaveBeenCalledTimes(1);
      expect(findOneSpy).toHaveBeenCalledWith(1);
    });
  });
});
