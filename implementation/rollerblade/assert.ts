export function assert(cond: boolean, description='') {
  if (!cond) {
    throw new Error(`Assertion failed${description ? `: ${description}` : ''}`)
  }
}