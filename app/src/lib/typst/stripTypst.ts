export function stripTypst(source: string) {
  return source
    .replace(/#\w+\([^\)]*\)/g, ' ')
    .replace(/[{}#\[\]]/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
