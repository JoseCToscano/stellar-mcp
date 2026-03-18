// src/components/ThemeScript.tsx
//
// Prevents FOUC (flash of unstyled content) by applying dark mode 
// before React hydration.

export function ThemeScript() {
  const code = `
    (function() {
      try {
        const stored = localStorage.getItem('sw:theme');
        const supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (stored === 'dark' || (!stored && supportDark)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
