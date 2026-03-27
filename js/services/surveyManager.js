// surveyManager.js
// Owns the SurveyJS instance lifecycle: model creation, rendering,
// validation, progress tracking, and data persistence.
//
// Custom onAfterRenderQuestion hooks extracted to surveyCustomRenderers.js.

import { applyCustomTheme, customTheme } from '../utils/surveyTheme.js';
import { areaSurveyJson } from '../utils/areaSurvey.js';
import { generalSurveyJson } from '../utils/generalSurvey.js';
import { applyRatingLayout, injectMedicationDescriptions } from './surveyCustomRenderers.js';
import AppState from '../app/state.js';
import SurveyKO from "https://cdn.skypack.dev/survey-knockout";

// ============================================================================
// MODULE STATE
// ============================================================================

let surveyInstance = null;

// Dependencies injected via initSurveyManager()
let surveyView = null;   // The survey view elements object
let renderer   = null;
let scene      = null;
let camera     = null;

// ============================================================================
// INITIALISATION
// ============================================================================

/**
 * Call once at startup to provide external dependencies.
 *
 * @param {Object} deps
 * @param {Object} deps.surveyView  - object returned by createSurveyViewElements()
 * @param {THREE.WebGLRenderer} deps.renderer
 * @param {THREE.Scene}          deps.scene
 * @param {THREE.Camera}         deps.camera
 */
export function initSurveyManager(deps) {
  surveyView = deps.surveyView;
  renderer   = deps.renderer;
  scene      = deps.scene;
  camera     = deps.camera;
}

// ============================================================================
// AREA SURVEY
// ============================================================================

/**
 * Build (or re-use) the area-specific SurveyJS model and render it
 * into the supplied container. Restores any previously saved answers.
 */
export function renderAreaSurvey(container) {
  applyCustomTheme(customTheme);

  container.classList.remove('survey-animated');
  container.style.opacity = '0';
  container.style.transform = 'translateX(50px)';

  if (!surveyInstance) {
    surveyInstance = new SurveyKO.Model(areaSurveyJson);
    surveyInstance.showTitle = false;
    surveyInstance.validationEnabled = false;

    surveyInstance.onValidateQuestion.add((_survey, options) => {
      if (options.value !== undefined && options.value !== null && options.value !== '') {
        options.error = null;
      }
    });

    surveyInstance.onValueChanged.add((_survey, options) => {
      updateSurveyProgress();
      if (options.name === 'mainArea') {
        updateMainAreaQuestion();
      }
    });

    surveyInstance.onAfterRenderSurvey.add(() => {
      setTimeout(() => container.classList.add('survey-animated'), 50);
    });

    // Custom rendering hooks (extracted to surveyCustomRenderers.js)
    surveyInstance.onAfterRenderQuestion.add(applyRatingLayout);
  }

  // Populate with any existing data for this instance
  const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
  const currentAreaNum  = AppState.currentSurveyIndex + 1;
  surveyInstance.title  = `Area #${currentAreaNum} Questionnaire`;

  if (currentInstance.questionnaireData) {
    surveyInstance.data = currentInstance.questionnaireData;
    surveyInstance.clearIncorrectValues();

    surveyInstance.getAllQuestions().forEach(question => {
      if (question.value !== undefined && question.value !== null && question.value !== '') {
        question.clearErrors();
      }
    });
    surveyInstance.validationEnabled = false;
  } else {
    surveyInstance.clear();
    surveyInstance.validationEnabled = false;
  }

  updateMainAreaQuestion();

  // Apply this instance's texture to the model
  if (AppState.skinMesh && currentInstance) {
    AppState.skinMesh.material.map = currentInstance.texture;
    AppState.skinMesh.material.needsUpdate = true;
    currentInstance.texture.needsUpdate = true;
  }

  surveyView.updateTitle();
  updateSurveyNavigationButtons();
  updateSurveyProgress();

  container.innerHTML = '';
  surveyInstance.render(container);

  renderer.render(scene, camera);
}

// ============================================================================
// GENERAL SURVEY
// ============================================================================

/**
 * Build (or re-use) the general SurveyJS model and render it
 * into the supplied container.
 */
export function renderGeneralSurvey(container) {
  applyCustomTheme(customTheme);

  container.classList.remove('survey-animated');
  container.style.opacity = '0';
  container.style.transform = 'translateX(50px)';

  if (!surveyInstance) {
    surveyInstance = new SurveyKO.Model(generalSurveyJson);
    surveyInstance.showTitle = false;
    surveyInstance.validationEnabled = false;

    surveyInstance.onValidateQuestion.add((_survey, options) => {
      if (options.question.getType() === 'matrix') {
        const medicationQuestion = _survey.getQuestionByName('medicationTable');
        const allRows = medicationQuestion.rows.map(r => r.value);

        const missingRows = [];
        for (const row of allRows) {
          if (!options.value || !options.value[row]) {
            missingRows.push(row);
          }
        }
        if (missingRows.length > 0) {
          options.error = `Please answer all rows in the medication table. Missing: ${missingRows.join(', ')}`;
          return;
        }
      }
      if (options.value !== undefined && options.value !== null && options.value !== '') {
        options.error = null;
      }
    });

    surveyInstance.onValueChanged.add(() => {
      updateSurveyProgress();
    });

    surveyInstance.onAfterRenderSurvey.add(() => {
      setTimeout(() => container.classList.add('survey-animated'), 50);
    });

    // Custom rendering hooks (extracted to surveyCustomRenderers.js)
    surveyInstance.onAfterRenderQuestion.add(injectMedicationDescriptions);
  }

  surveyView.editDrawingButton.style.display = 'none';

  container.innerHTML = '';
  surveyInstance.render(container);
  updateSurveyProgress();
  renderer.render(scene, camera);
}

// ============================================================================
// VALIDATION & DATA ACCESS
// ============================================================================

/**
 * Validate the current survey. If errors exist, scroll to the first one.
 * @returns {boolean} true when the survey is valid.
 */
export function validateAndScrollToErrors() {
  if (!surveyInstance) return false;

  surveyInstance.validationEnabled = true;
  surveyInstance.validate();

  const hasErrors = surveyInstance.hasErrors();
  if (!hasErrors) return true;

  // Scroll to the first question that has an error
  setTimeout(() => {
    const questions = surveyInstance.getAllQuestions();
    const firstBad  = questions.find(q => q.errors && q.errors.length > 0);
    if (!firstBad) return;

    const el = document.getElementById(firstBad.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const firstInput = el.querySelector('input:not(.sd-visuallyhidden), textarea, select');
      if (firstInput) setTimeout(() => firstInput.focus(), 400);
    }
  }, 100);

  return false;
}

/**
 * Save the current area survey data into the matching drawing instance.
 * Enables validation first — only persists if the survey is error-free.
 * @returns {boolean} true when data was saved successfully.
 */
export function saveCurrentSurveyData() {
  if (!surveyInstance) return false;

  surveyInstance.validationEnabled = true;
  const hasErrors = surveyInstance.hasErrors();

  if (!hasErrors) {
    const currentInstance = AppState.drawingInstances[AppState.currentSurveyIndex];
    currentInstance.questionnaireData = { ...surveyInstance.data };
    currentInstance.uvDrawingData     = currentInstance.canvas.toDataURL('image/png');

    surveyInstance.validationEnabled = false;
    return true;
  }

  surveyInstance.validate();
  return false;
}

/**
 * @returns {boolean} true when the active survey is the general questionnaire.
 */
export function isGeneralSurvey() {
  if (!surveyInstance) return false;
  return 'medicationTable' in surveyInstance.data;
}

/**
 * @returns {Object} A shallow copy of the current survey data.
 */
export function getCurrentSurveyData() {
  if (!surveyInstance) return {};
  return { ...surveyInstance.data };
}

/**
 * Destroy the current survey instance so a fresh one is created next time.
 */
export function clearSurveyInstance() {
  surveyInstance = null;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Count how many drawing instances are flagged as "main area". */
function countMainAreas() {
  return AppState.drawingInstances.filter(
    instance => instance.questionnaireData?.mainArea === 'Yes'
  ).length;
}

/** Update the "main area" question's title and enforce the 3-slot cap. */
function updateMainAreaQuestion() {
  if (!surveyInstance) return;

  const mainAreaQuestion = surveyInstance.getQuestionByName('mainArea');
  if (!mainAreaQuestion) return;

  const currentInstance    = AppState.drawingInstances[AppState.currentSurveyIndex];
  const currentMainAreaVal = currentInstance.questionnaireData?.mainArea;

  let mainAreaCount = countMainAreas();
  if (currentMainAreaVal === 'Yes') mainAreaCount--;

  const remainingSlots = 3 - mainAreaCount;

  surveyInstance.setVariable('remainingMainAreaSlots', remainingSlots);
  surveyInstance.setVariable('isCurrentlyMainArea', currentMainAreaVal === 'Yes');

  if (remainingSlots <= 0) {
    mainAreaQuestion.title = 'Is this your main area of pain or symptom? (Maximum 3 main areas reached)';
    mainAreaQuestion.value = 'No';
  } else if (remainingSlots === 3) {
    mainAreaQuestion.title = 'Is this your main area of pain or symptom? (You can indicate up to 3 main areas)';
  } else {
    mainAreaQuestion.title = `Is this your main area of pain or symptom? (${remainingSlots} main area${remainingSlots === 1 ? '' : 's'} remaining)`;
  }
}

/** Sync the progress bar in the survey header. */
function updateSurveyProgress() {
  if (!surveyInstance) return;

  const allQuestions     = surveyInstance.getAllQuestions();
  const visibleQuestions = allQuestions.filter(q => q.isVisible);
  const total            = visibleQuestions.length;

  let completed = 0;
  visibleQuestions.forEach(question => {
    const value = question.value;
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) ? value.length > 0 : true) {
        completed++;
      }
    }
  });

  surveyView.updateProgress(completed, total);
}

/** Configure the footer navigation button label / style. */
function updateSurveyNavigationButtons() {
  surveyView.completeButton.textContent = 'Done';
  surveyView.completeButton.style.background = '';
  surveyView.completeButton.classList.add('button-success');
}