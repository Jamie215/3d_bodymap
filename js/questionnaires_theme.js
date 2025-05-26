export const customTheme = {
  themeName: "custom",
  isPanelless: true,
  colorPalette: "light",
  headerView: "advanced",
  cssVariables: {
    // Brand Colors
    "--sjs-primary-backcolor": "var(--primary-color)", // #0277BD
    "--sjs-primary-backcolor-dark": "#005f99",         // hover state
    "--sjs-primary-backcolor-light": "rgba(2, 119, 189, 0.1)",
    "--sjs-primary-forecolor": "#ffffff",

    "--sjs-general-backcolor": "#f0f0f0",               // app background
    "--sjs-question-background": "var(--panel-background)", // white
    "--sjs-questionpanel-backcolor": "#f0f0f0",
    "--sjs-questionpanel-cornerRadius": "8px",

    // Text Colors
    "--sjs-general-forecolor": "#333333",
    "--sjs-font-questiontitle-color": "#1f2328", // darker than general text
    "--sjs-font-editorfont-color": "#21252a",
    "--sjs-font-editorfont-placeholdercolor": "#6e7781",

    // Font & Spacing
    "--sjs-font-family": "'Inter', sans-serif",
    "--sjs-font-size": "20px",
    "--sjs-base-unit": "6px",
    "--sjs-corner-radius": "8px",

    // Borders & Shadows
    // "--sjs-border-light": "#e0e0e0",
    // "--sjs-border-default": "#e0e0e0",
    // "--sjs-shadow-small": "0 1px 3px rgba(0,0,0,0.1)",

    // Header Style
    "--sjs-header-backcolor": "var(--primary-color)",
    "--sjs-font-headertitle-color": "#ffffff",
    "--sjs-font-headerdescription-color": "#ffffff",
  }
};

export function applyCustomTheme(theme) {
  const vars = theme?.cssVariables || {};
  const root = document.documentElement;

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}