/**
 * Interactive checkbox prompt.
 * ↑↓ to move, space to toggle, enter to confirm, ctrl-c to cancel.
 * The active row is rendered with inverted colors (no extra symbols).
 */

/** Pure toggle logic — exported for testing. */
export function applyToggle(checked: Set<string>, items: CheckboxItem[], index: number): void {
  const item = items[index]!;
  const isWildcard = item.value.endsWith("/*");

  if (isWildcard) {
    if (checked.has(item.value)) {
      checked.delete(item.value);
    } else {
      checked.clear();
      checked.add(item.value);
    }
  } else {
    const wildcard = items.find((i) => i.value.endsWith("/*"));
    if (wildcard && checked.has(wildcard.value)) {
      // Wildcard was active — expand it to all individuals first, then toggle the target
      checked.delete(wildcard.value);
      for (const i of items) {
        if (!i.value.endsWith("/*")) checked.add(i.value);
      }
    }

    if (checked.has(item.value)) {
      checked.delete(item.value);
    } else {
      checked.add(item.value);
      // If all individuals are now checked, promote to wildcard
      const individuals = items.filter((i) => !i.value.endsWith("/*"));
      if (individuals.every((i) => checked.has(i.value))) {
        const wildcard = items.find((i) => i.value.endsWith("/*"));
        if (wildcard) {
          for (const i of individuals) checked.delete(i.value);
          checked.add(wildcard.value);
        }
      }
    }
  }
}

const UP    = "\x1b[A";
const DOWN  = "\x1b[B";
const SPACE = " ";
const ENTER = "\r";
const CTRL_C = "\x03";

const invert = (s: string) => `\x1b[7m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;

export type CheckboxItem = {
  label: string;
  value: string;
  checked?: boolean;
  dividerBefore?: boolean;
};

/**
 * Returns selected values, or null if the user cancelled (ctrl-c).
 */
export async function checkbox(
  message: string,
  items: CheckboxItem[],
): Promise<string[] | null> {
  const checked = new Set(items.filter((i) => i.checked).map((i) => i.value));
  let cursor = 0;

  process.stdout.write("\x1b[?25l"); // hide cursor

  function buildLines(): string[] {
    const wildcardActive = items.some((i) => i.value.endsWith("/*") && checked.has(i.value));
    const lines: string[] = [];
    lines.push(message);
    lines.push(dim("↑↓ to move  ·  space to toggle  ·  enter to confirm"));
    lines.push("");
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.dividerBefore) lines.push(dim("────"));
      const isChecked = wildcardActive || checked.has(item.value);
      const mark = isChecked ? green("✓") : red("✗");
      const label = i === cursor ? invert(` ${item.label}`) : ` ${item.label}`;
      lines.push(`${mark}${label}`);
    }
    lines.push("");
    return lines;
  }

  let lastLineCount = 0;

  function render() {
    const lines = buildLines();
    // Clear previous render
    for (let i = 0; i < lastLineCount; i++) {
      process.stdout.write("\x1b[1A\x1b[2K");
    }
    process.stdout.write(lines.join("\n") + "\n");
    lastLineCount = lines.length;
  }

  render();

  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeAllListeners("data");
      process.stdout.write("\x1b[?25h"); // restore cursor
    }

    function toggle(index: number) {
      applyToggle(checked, items, index);
    }

    process.stdin.on("data", (key: string) => {
      if (key.startsWith(UP)) {
        cursor = (cursor - 1 + items.length) % items.length;
        render();
      } else if (key.startsWith(DOWN)) {
        cursor = (cursor + 1) % items.length;
        render();
      } else if (key === SPACE) {
        toggle(cursor);
        render();
      } else if (key === ENTER || key === "\n") {
        cleanup();
        resolve([...checked]);
      } else if (key === CTRL_C) {
        cleanup();
        resolve(null);
      }
    });
  });
}
