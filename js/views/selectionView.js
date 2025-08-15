// views/selectionView.js
export function createSelectionView(onModelSelected) {
  const modelSelectionView = document.createElement('div');
  modelSelectionView.id = 'model-selection-view';

  const modelSelectionPanel = document.createElement('div');
  modelSelectionPanel.id = 'model-selection-panel';

  const selectStatusBar = document.createElement('h1');
  selectStatusBar.id = 'select-status-bar';
  selectStatusBar.textContent = 'Select My Body';

  const modelButtonsContainer = document.createElement('div');
  modelButtonsContainer.id = 'model-buttons-container';

  const returnSummaryButton = document.createElement('button');
  returnSummaryButton.textContent = '← Return to Summary';
  returnSummaryButton.classList.add('button', 'return-button');

  const addNewInstanceButton = document.createElement('button');
  addNewInstanceButton.id = 'add-new-instance-selection';
  addNewInstanceButton.textContent = 'Add a New Pain or Symptom';
  addNewInstanceButton.classList.add('button', 'button-primary');

  const selectionFooter = document.createElement('div');
  selectionFooter.id = 'footer-selection';
  selectionFooter.classList.add('footer');
  selectionFooter.appendChild(addNewInstanceButton);

  const models = [
    { name: 'Type 1', file: './assets/female_young_avgheight2.glb' },
    { name: 'Type 2', file: './assets/male_young_avgheight2.glb' }
  ];

  let selectedModelPath = models[0].file;

  models.forEach(model => {
    const button = document.createElement('button');
    button.classList.add('model-selection-button');

    const img = document.createElement('img');
    img.src = `./assets/preview_svg/${model.name}.svg`;
    img.alt = model.name;

    const label = document.createElement('div');
    label.classList.add('label');
    label.textContent = model.name;

    button.appendChild(img);
    button.appendChild(label);
    modelButtonsContainer.appendChild(button);

    button.addEventListener('click', () => {
      selectedModelPath = model.file;
      [...modelButtonsContainer.children].forEach(b => b.style.borderColor = 'transparent');
      button.style.borderColor = 'var(--primary-color)';
      if (onModelSelected) {
        onModelSelected(model);
      }
    });

    if (model === models[0]) {
      button.style.borderColor = 'var(--primary-color)';
    }
  });

  modelSelectionPanel.appendChild(returnSummaryButton);
  modelSelectionPanel.appendChild(selectStatusBar);
  modelSelectionPanel.appendChild(modelButtonsContainer);

  modelSelectionView.appendChild(modelSelectionPanel);
  modelSelectionView.appendChild(selectionFooter);

  return {
    root: modelSelectionView,
    modelSelectionPanel,
    selectionFooter,
    addNewInstanceButton,
    returnSummaryButton
  };
}