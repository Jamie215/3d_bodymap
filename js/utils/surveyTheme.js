export const customTheme = {
  themeName: "custom",
  isPanelless: true,
  colorPalette: "light",
  headerView: "advanced",
  cssVariables: {
    // Brand Colors
    "--sjs-primary-backcolor": "#2AA3E6",
    "--sjs-primary-backcolor-dark": "#005f99",         // hover state
    "--sjs-primary-backcolor-light": "rgba(2, 119, 189, 0.1)",
    "--sjs-primary-forecolor": "#ffffff",

    "--sjs-general-backcolor": "#f0f0f0",               // app background
    "--sjs-question-background": "var(--panel-background)", // white
    "--sjs-questionpanel-backcolor": "#ffffff",
    "--sjs-questionpanel-cornerRadius": "8px",

    // Text Colors
    "--sjs-general-forecolor": "#333333",
    "--sjs-font-questiontitle-color": "#1f2328", // darker than general text
    "--sjs-font-editorfont-color": "#21252a",
    "--sjs-font-editorfont-placeholdercolor": "#6e7781",

    // Font & Spacing
    "--sjs-font-family": "'Inter', sans-serif",
    "--sjs-font-size": "22px",
    "--sjs-base-unit": "8px",
  }
};

export const matrixStyles = `
  /* Matrix answer columns have fixed equal width */
  .sd-table__cell.sd-table__cell--header {
    width: 20% !important;
  }
  
  .sd-table-wrapper,
  .sd-matrix,
  .sd-question--table {
    overflow: visible !important;
  }

  /* Sticky header - target thead cells */
  .sd-matrix__table thead{
    position: sticky !important;
    top: 0 !important;
    z-index: 100 !important;
    background-color: #ffffff !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

`;

export function applyCustomTheme(theme) {
  const vars = theme?.cssVariables || {};
  const root = document.documentElement;

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // Inject matrix styles if not already present
  if (!document.getElementById('matrix-custom-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'matrix-custom-styles';
    styleEl.textContent = matrixStyles;
    document.head.appendChild(styleEl);
  }
}