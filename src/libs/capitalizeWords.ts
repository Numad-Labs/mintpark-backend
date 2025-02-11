export function capitalizeWords(str: string): string {
  return str
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      if (/^\d+[a-zA-Z]*$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
