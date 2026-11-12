import { HttpError } from "../src/errors";
import {
  parseId,
  positiveInteger,
  validateBody,
  validateName,
} from "../src/validation";

// Executa a função e devolve o erro lançado. Se ela não lançar, o teste falha
// com uma mensagem clara (evita falsos positivos em testes de rejeição).
function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("A função deveria lançar um erro, mas retornou normalmente.");
}

function expectBadRequest(action: () => unknown, fieldLabel?: string): void {
  const error = captureError(action);

  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).statusCode).toBe(400);
  if (fieldLabel) {
    expect((error as HttpError).message).toContain(fieldLabel);
  }
}

describe("positiveInteger", () => {
  test.each([
    ["limite inferior (1)", 1],
    ["limite superior (2147483647)", 2147483647],
  ])("retorna o próprio número para %s", (_cenario, value) => {
    expect(positiveInteger(value, "RA")).toBe(value);
  });

  test.each([
    ["0", 0],
    ["-1", -1],
    ["1.5", 1.5],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["2147483648 (acima do limite)", 2147483648],
    ['string numérica "123"', "123"],
    ["null", null],
    ["undefined", undefined],
  ])("rejeita %s com HttpError 400", (_cenario, value) => {
    expectBadRequest(() => positiveInteger(value, "RA"), "RA");
  });
});

describe("parseId", () => {
  test.each([
    ['"1"', "1", 1],
    ['"2147483647"', "2147483647", 2147483647],
  ])("converte a string %s para número", (_cenario, value, expected) => {
    expect(parseId(value, "RA")).toBe(expected);
  });

  test.each([
    ['"1abc" (conversão parcial)', "1abc"],
    ['"1.2" (decimal)', "1.2"],
    ['"1e2" (notação exponencial)', "1e2"],
    ['"" (vazia)', ""],
    ['"-1" (negativo)', "-1"],
    ['"0" (zero)', "0"],
    ['"2147483648" (acima do limite)', "2147483648"],
    ["o número 123 (não é string)", 123],
  ])("rejeita %s com HttpError 400", (_cenario, value) => {
    expectBadRequest(() => parseId(value, "RA"), "RA");
  });
});

describe("validateName", () => {
  test.each([
    ['"Ana"', "Ana"],
    ["string com 100 letras a (limite máximo)", "a".repeat(100)],
  ])("retorna o nome recebido para %s", (_cenario, value) => {
    expect(validateName(value)).toBe(value);
  });

  test.each([
    ['"" (vazio)', ""],
    ['"ab" (2 caracteres)', "ab"],
    ['"   " (só espaços)', "   "],
    ['" a " (espaços não completam o mínimo)', " a "],
    ["string com 101 letras a (acima do limite)", "a".repeat(101)],
    ["o número 123", 123],
    ["null", null],
    ["undefined", undefined],
  ])("rejeita %s com HttpError 400", (_cenario, value) => {
    expectBadRequest(() => validateName(value));
  });
});

describe("validateBody", () => {
  test("retorna a mesma referência de um objeto congelado, sem modificá-lo", () => {
    const body = Object.freeze({ name: "Ana" });

    const result = validateBody(body);

    expect(result).toBe(body);
    expect(result).toEqual({ name: "Ana" });
    expect(Object.isFrozen(body)).toBe(true);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["array vazio", []],
    ['string "Ana"', "Ana"],
    ["número 12", 12],
  ])("rejeita %s com HttpError 400", (_cenario, value) => {
    expectBadRequest(() => validateBody(value));
  });

  test("aceita campos extras e retorna a mesma referência sem alterar o objeto", () => {
    const body = { name: "Ana", extra: true };
    const copyBeforeCall = { ...body };

    const result = validateBody(body);

    expect(result).toBe(body);
    expect(body).toEqual(copyBeforeCall);
    expect(Object.keys(body)).toEqual(["name", "extra"]);
  });
});
