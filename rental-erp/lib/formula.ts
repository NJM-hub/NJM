// 설정 화면에서 바꿀 수 있는 계산식을 안전하게 계산한다 (eval 을 쓰지 않음).
// 지원: 숫자, 한글/영문 변수, + - * / ( ), 단항 -, min(a,b) max(a,b)

type Token = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.,]/.test(src[j])) j++;
      const raw = src.slice(i, j).replaceAll(",", "");
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(raw)) throw new Error(`숫자 형식 오류: ${src.slice(i, j)}`);
      out.push({ t: "num", v: Number(raw) });
      i = j;
    } else if (/[가-힣A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[가-힣A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
    } else if ("+-*/(),×÷".includes(c)) {
      out.push({ t: "op", v: c === "×" ? "*" : c === "÷" ? "/" : c });
      i++;
    } else {
      throw new Error(`사용할 수 없는 문자: "${c}"`);
    }
  }
  return out;
}

type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "call"; fn: string; args: Node[] };

function parse(tokens: Token[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (v?: string) => {
    const tk = tokens[p];
    if (!tk || (v && !(tk.t === "op" && tk.v === v))) throw new Error(v ? `"${v}" 가 필요합니다` : "식이 끝났습니다");
    p++;
    return tk;
  };
  function expr(): Node {
    let a = term();
    while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = eat().v as string;
      a = { k: "bin", op, a, b: term() };
    }
    return a;
  }
  function term(): Node {
    let a = unary();
    while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = eat().v as string;
      a = { k: "bin", op, a, b: unary() };
    }
    return a;
  }
  function unary(): Node {
    if (peek()?.t === "op" && peek().v === "-") {
      eat();
      return { k: "neg", a: unary() };
    }
    if (peek()?.t === "op" && peek().v === "+") {
      eat();
      return unary();
    }
    return atom();
  }
  function atom(): Node {
    const tk = peek();
    if (!tk) throw new Error("식이 비어 있거나 끝이 잘렸습니다");
    if (tk.t === "num") {
      p++;
      return { k: "num", v: tk.v };
    }
    if (tk.t === "id") {
      p++;
      if (peek()?.t === "op" && peek().v === "(") {
        eat("(");
        const args: Node[] = [expr()];
        while (peek()?.t === "op" && peek().v === ",") {
          eat(",");
          args.push(expr());
        }
        eat(")");
        if (!["min", "max"].includes(tk.v)) throw new Error(`지원하지 않는 함수: ${tk.v}`);
        return { k: "call", fn: tk.v, args };
      }
      return { k: "var", name: tk.v };
    }
    if (tk.v === "(") {
      eat("(");
      const e = expr();
      eat(")");
      return e;
    }
    throw new Error(`예상치 못한 "${tk.v}"`);
  }
  const node = expr();
  if (p < tokens.length) throw new Error(`예상치 못한 "${String(tokens[p].v)}"`);
  return node;
}

function evalNode(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case "num":
      return n.v;
    case "var":
      if (!(n.name in vars)) throw new Error(`알 수 없는 항목: ${n.name}`);
      return vars[n.name];
    case "neg":
      return -evalNode(n.a, vars);
    case "call": {
      const xs = n.args.map((a) => evalNode(a, vars));
      return n.fn === "min" ? Math.min(...xs) : Math.max(...xs);
    }
    case "bin": {
      const a = evalNode(n.a, vars);
      const b = evalNode(n.b, vars);
      if (n.op === "+") return a + b;
      if (n.op === "-") return a - b;
      if (n.op === "*") return a * b;
      return b === 0 ? 0 : a / b;
    }
  }
}

const cache = new Map<string, Node>();

export function evaluate(src: string, vars: Record<string, number>): number {
  let node = cache.get(src);
  if (!node) {
    node = parse(tokenize(src));
    cache.set(src, node);
  }
  return evalNode(node, vars);
}

/** 설정 저장 전에 식 검사. 오류 메시지 또는 null */
export function checkFormula(src: string, allowed: readonly string[]): string | null {
  try {
    const vars = Object.fromEntries(allowed.map((k) => [k, 1]));
    evaluate(src, vars);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
