export function announceToScreenReader(message: string) {
  if (typeof window !== "undefined") {
    const event = new CustomEvent("a11y-announce", { detail: message });
    window.dispatchEvent(event);
  }
}
