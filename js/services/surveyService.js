import { surveyJson } from "../questionnaires.js";
import { customTheme, applyCustomTheme } from "../questionnaires_theme";
import AppState from '../app/state.js';
import SurveyKO from "https://cdn.skypack.dev/survey-knockout";

export function renderSurvey(container, onComplete) {
    const i = AppState.currentDrawingIndex;
    applyCustomTheme(customTheme);

    const survey = new SurveyKO.Model(surveyJson);
    container.innerHTML = "";
    survey.css = { ...survey.css, root: "sv-root-modern sv-root-plain"};
    survey.render(container);
    // survey.onAfterRenderQuestion.add(formatQuestionLayout);
    survey.onComplete.add(sender => {
        const canvas = AppState.drawingInstance[i].canvas;
        AppState.drawingInstances[i].uvDrawingData = canvas.toDataURL('image/png');
        AppState.drawingInstances[i].questionnaireData = sender.data;
        console.log(`Saved survey for Drawing ${i + 1}`);

        // Return to summary view
        onComplete();
    });
 }

// Reformat the intensity scale question to enhance readability 
export function formatQuestionLayout() { 
    if (options.question.name === "intensityScale") {
        const questionEl = options.htmlElement;
        const ratingContent = questionEl.querySelector(".sd-question__content");

        if (!ratingContent) return;
        const ratingRow = ratingContent.querySelector(".sd-rating");
        if (!ratingRow) return;

        const layoutRow = document.createElement("div");
        layoutRow.classList.add('rating-layout-row');

        const maxLabel = document.createElement("div");
        maxLabel.innerHTML = "Worst pain or<br>symptom imaginable";
        maxLabel.classList.add('rating-layout-label');

        const minLabel = document.createElement("div");
        minLabel.innerHTML = "No pain<br>or symptom";
        minLabel.classList.add('rating-layout-label');

        ratingContent.removeChild(ratingRow);

        layoutRow.appendChild(minLabel);
        layoutRow.appendChild(ratingRow);
        layoutRow.appendChild(maxLabel);

        ratingContent.appendChild(layoutRow);
    };
}