export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // Class, id and custom-property names are referenced from the JS sources (ui.js, modals.js),
    // so they keep their camelCase / short names rather than the kebab-case the standard config expects.
    "selector-class-pattern": null,
    "selector-id-pattern": null,
    "custom-property-pattern": null,
    // Font family names in the --font-* custom properties keep their conventional capitalisation.
    "value-keyword-case": ["lower", { ignoreProperties: ["/^--font-/"] }],
    // Layout is Prettier's job. styles.css is written one rule per line, which these rules would reject.
    "declaration-block-single-line-max-declarations": null,
    "at-rule-empty-line-before": null,
    "comment-empty-line-before": null,
    "rule-empty-line-before": null,
    // Selector order in styles.css is deliberate (later rules override earlier ones on purpose).
    "no-descending-specificity": null,
  },
};
