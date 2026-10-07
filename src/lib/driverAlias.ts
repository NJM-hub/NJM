/**
 * 같은 사람인데 이름이 다르게 적힌 기사를 한 이름으로 합친다.
 * 설정 형식: 한 줄에 "다른 이름 = 정산에 쓸 이름" (예: 김성원 = JACKY). 쉼표로 여러 이름도 가능 (김성원, Jacky = JACKY)
 */
export type DriverAliases = Map<string, string>;

const key = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export function parseDriverAliases(text: string | null | undefined): DriverAliases {
  const map: DriverAliases = new Map();
  for (const line of (text ?? "").split(/\r?\n/)) {
    const [left, right] = line.split(/=|→|->/).map((s) => s?.trim());
    if (!left || !right) continue;
    for (const alias of left.split(/[,，]/).map((s) => s.trim()).filter(Boolean)) map.set(key(alias), right);
    map.set(key(right), right);
  }
  return map;
}

/** 합칠 이름이면 정산에 쓸 이름으로, 아니면 그대로 */
export function canonicalDriver(name: string | null | undefined, aliases: DriverAliases): string | null {
  if (!name) return name ?? null;
  return aliases.get(key(name)) ?? name;
}
