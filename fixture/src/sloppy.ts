type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };

export function area(s: Shape): number {
  switch (s.kind) {
    case "circle":
      return Math.PI * s.r ** 2;
  }
  return 0;
}

export function load(raw: string) {
  const data = JSON.parse(raw) as { id: string };
  const x: any = data;
  return x!.id;
}

export async function save(id?: string) {
  fetch("/save/" + id);
  const el = document.getElementById("a")!;
  return el;
}

export function pick(a: string | undefined, b: string) {
  if (b === "") return b;
  return a || b;
}

export const settings: Record<string, unknown> = {};
export const __raw = JSON.parse("{}") as unknown as { id: string };
