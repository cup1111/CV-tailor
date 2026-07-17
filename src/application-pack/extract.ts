/** Extract Experience Bullet sections marked with ||...|| */
export function extractExperienceBullets(response: string): string {
  const sections: string[] = [];
  const regex = /\|\|([\s\S]*?)\|\|/g;
  let match;
  while ((match = regex.exec(response)) !== null) {
    const content = match[1].trim();
    if (content) sections.push(content);
  }
  return sections.join('\n\n');
}
